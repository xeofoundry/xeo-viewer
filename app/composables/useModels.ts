import { PhongMaterial, XKTLoaderPlugin, type SceneModel, type Viewer } from '@xeokit/xeokit-sdk'

interface LoadedModel {
  id: string
  name: string
}

const pending = ref(0)
const models = ref<LoadedModel[]>([])

export const loadedModels = readonly(models)

// Costly on large models, so it is built on first read and rebuilt only after models load or unload
export const propertyIndex = computed(() => {
  const viewer = useViewer().value

  return viewer && models.value.length ? buildPropertyIndex(viewer) : undefined
})

let loader: XKTLoaderPlugin | undefined

const capMaterials = new Map<string, PhongMaterial>()

// A new viewer (HMR remount of the scene) starts empty, and loads still pending in the old one never settle
watch(useViewer(), () => {
  models.value = []
  pending.value = 0
  capMaterials.clear()
}, { flush: 'sync' })

const stem = (name: string) => name.replace(/\.[^.]*$/, '').toLowerCase()

function fileName(url: string) {
  const name = new URL(url, location.href).pathname.split('/').pop()

  if (!name) return url

  try {
    return decodeURIComponent(name)
  }
  catch {
    return name
  }
}

async function fetchOk(url: string) {
  const response = await fetch(url)

  if (!response.ok) throw new Error(`${response.status} ${response.statusText} ${url}`)

  return response
}

function parse(viewer: Viewer, xkt: ArrayBuffer, metaModelData: unknown) {
  if (loader?.viewer !== viewer) loader = new XKTLoaderPlugin(viewer)

  // Off the MetaScene, xeokit puts the sidecar JSON, or the XKT's embedded metadata when there is none, on SceneModel.metadata
  const model = loader.load({ xkt, metaModelData, edges: true, loadIntoMetaScene: false })

  return new Promise<SceneModel>((resolve, reject) => {
    // xeokit only logs parse failures and still fires 'loaded', so an empty model means a bad file
    model.on('loaded', () => {
      if (Object.keys(model.objects).length) return resolve(model)

      model.destroy()
      reject(new Error('The file contains no objects, it may not be a valid XKT file.'))
    })
  })
}

// The object color comes from its IfcMaterial style. Must run before the model is listed, while grouping has not colorized it yet.
// Transparent objects (glass, IfcSpace) get no caps, or a cut would fill rooms and panes.
function setCapMaterials(viewer: Viewer, model: SceneModel) {
  for (const entity of Object.values(model.objects)) {
    if (entity.opacity < 1) continue

    const color = [...entity.colorize]
    const key = color.join()
    let material = capMaterials.get(key)

    if (!material) capMaterials.set(key, material = new PhongMaterial(viewer.scene, { diffuse: color, backfaces: true }))

    entity.capMaterial = material
  }
}

export function useModels() {
  const viewer = useViewer()
  const toast = useToast()

  async function load(name: string, read: () => Promise<[ArrayBuffer, unknown]>) {
    const instance = viewer.value

    if (!instance) return

    pending.value++

    try {
      // Parsing blocks the main thread for seconds on big models, so the spinner has to be painted before it starts
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve)))

      const model = await parse(instance, ...await read())

      if (viewer.value !== instance) return

      setCapMaterials(instance, model)
      models.value = [...models.value, { id: String(model.id), name }]
      fitView(instance)
    }
    catch (error) {
      toast.add({ title: `Could not load ${name}`, description: error instanceof Error ? error.message : String(error), color: 'error', icon: 'i-lucide-circle-alert' })
    }
    finally {
      if (viewer.value === instance) pending.value--
    }
  }

  function loadFiles(files: File[]) {
    const xkts = files.filter(file => /\.xkt$/i.test(file.name))
    const jsons = files.filter(file => /\.json$/i.test(file.name))

    if (!xkts.length) {
      toast.add({ title: 'No .xkt file', description: 'Add at least one .xkt model file.', color: 'warning', icon: 'i-lucide-triangle-alert' })
      return
    }

    for (const xkt of xkts) {
      // A single .xkt with a single .json is one model even when their names differ
      const json = jsons.find(file => stem(file.name) === stem(xkt.name))
        ?? (xkts.length === 1 && jsons.length === 1 ? jsons[0] : undefined)

      load(xkt.name, async () => [await xkt.arrayBuffer(), json && JSON.parse(await json.text())])
    }
  }

  function loadUrl(xktUrl: string, jsonUrl?: string) {
    load(fileName(xktUrl), () => Promise.all([
      fetchOk(xktUrl).then(response => response.arrayBuffer()),
      jsonUrl && fetchOk(jsonUrl).then(response => response.json()),
    ]))
  }

  function loadBuffer(xkt: ArrayBuffer, json?: ArrayBuffer) {
    load('model', async () => [xkt, json && JSON.parse(new TextDecoder().decode(json))])
  }

  return {
    models: loadedModels,
    loading: computed(() => pending.value > 0),
    hasModels: computed(() => models.value.length > 0),
    loadFiles,
    loadUrl,
    loadBuffer,
  }
}
