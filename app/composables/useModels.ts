import { XKTLoaderPlugin, type SceneModel, type Viewer } from '@xeokit/xeokit-sdk'

interface LoadedModel {
  id: string
  name: string
}

const pending = ref(0)
const models = ref<LoadedModel[]>([])

let loader: XKTLoaderPlugin | undefined

// A new viewer (HMR remount of the scene) starts empty, and loads still pending in the old one never settle
watch(useViewer(), () => {
  models.value = []
  pending.value = 0
}, { flush: 'sync' })

const stem = (name: string) => name.replace(/\.[^.]*$/, '').toLowerCase()

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

export function useModels() {
  const viewer = useViewer()
  const toast = useToast()

  async function load(name: string, read: () => Promise<[ArrayBuffer, unknown]>) {
    const instance = viewer.value

    if (!instance) return

    pending.value++

    try {
      const model = await parse(instance, ...await read())

      if (viewer.value !== instance) return

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
    load(xktUrl, () => Promise.all([
      fetchOk(xktUrl).then(response => response.arrayBuffer()),
      jsonUrl && fetchOk(jsonUrl).then(response => response.json()),
    ]))
  }

  function removeModel(id: string) {
    viewer.value?.scene.models[id]?.destroy()
    models.value = models.value.filter(model => model.id !== id)
  }

  return {
    models: readonly(models),
    loading: computed(() => pending.value > 0),
    hasModels: computed(() => models.value.length > 0),
    loadFiles,
    loadUrl,
    removeModel,
  }
}
