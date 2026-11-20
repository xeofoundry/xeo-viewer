import type { TickEvent, Viewer } from '@xeokit/xeokit-sdk'

type Vec3 = [number, number, number]

const BODY_HEIGHT = 1.8
const BODY_RADIUS = 0.3
const EYE_HEIGHT = 1.7
const WALK_SPEED = 1.6
const RUN_SPEED = 4.5
const LOOK_SENSITIVITY = 0.0025
const MAX_PITCH = Math.PI / 2 - 0.05
const MAX_LOOK_DELTA = 100
const GRAVITY = 9.81
const STEP_HEIGHT = 0.6
const MAX_FRAME_SECONDS = 0.1
const JETPACK_ACCELERATION = 18
const JETPACK_MAX_SPEED = 4
const FLY_SPEED = 5
const FLY_FAST_SPEED = 14
const TARGET_REACH = 2.5
const TARGET_SCAN_INTERVAL = 0.15
const SNAP_INTERVAL = 80
const SNAP_REACH = 8
const OFFSET_EPSILON = 0.002
const HELD_SMOOTHING = 14
const DOOR_PASS_MARGIN = 0.6

const DOOR_TYPES = new Set(['ifcdoor', 'doors'])
const OBSTRUCTING_TYPES = new Set(['ifcspace', 'ifcopeningelement', 'ifcannotation', 'rooms'])
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight'])
const LEGEND_KEYS = new Map([
  ['KeyW', 'W'],
  ['KeyA', 'A'],
  ['KeyS', 'S'],
  ['KeyD', 'D'],
  ['ShiftLeft', 'Shift'],
  ['ShiftRight', 'Shift'],
  ['Space', 'Space'],
  ['ControlLeft', 'Ctrl'],
  ['ControlRight', 'Ctrl'],
  ['KeyF', 'F'],
  ['KeyG', 'G'],
  ['KeyN', 'N'],
  ['KeyP', 'P'],
  ['KeyQ', 'Q'],
  ['KeyR', 'R'],
])

export type WalkModeTarget = 'door' | 'hide' | 'move' | 'place' | null

export interface WalkModeState {
  target: WalkModeTarget
  hideMode: boolean
  moveMode: boolean
  flying: boolean
  snap: boolean
  pressedKeys: string[]
}

const distance = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!)

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    && (target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
}

// First-person walking with gravity, door passing, a jetpack, free flight and hiding or moving objects.
// Movement runs in a walk frame (horizontal, horizontal, up) that is a right-handed rotation of the world
// axes, so the same logic works for Y-up and Z-up scenes.
export class WalkMode {
  readonly viewer: Viewer

  private readonly state: WalkModeState
  private readonly onExit: () => void
  private readonly position: Vec3 = [0, 0, 0]
  private readonly pressedKeys = new Set<string>()
  private axes: Vec3 = [0, 1, 2]
  private tickSubId: string | undefined
  private cullGuardSubId: string | undefined
  private listeners: AbortController | undefined
  private typeByEntityId = new Map<string, string>()
  private hiddenEntityIds: string[] = []
  private manuallyHiddenIds: string[] = []
  private movedEntityIds = new Set<string>()
  private groundLevel = 0
  private targetEntityId: string | undefined
  private targetPoint: number[] | undefined
  private heldEntityId: string | undefined
  private heldStartOffset = [0, 0, 0]
  private heldGrabPoint = [0, 0, 0]
  private heldBaseAabb = [0, 0, 0, 0, 0, 0]
  private heldOffset = [0, 0, 0]
  private heldDistance = 0
  private snapPlacement: { point: number[], normal: number[] } | undefined
  private snapDue = 0
  private targetScanDue = 0
  private viewChanged = true
  private yaw = 0
  private pitch = 0
  private verticalSpeed = 0
  private grounded = true
  private active = false

  private readonly keyActions: Record<string, () => void> = {
    KeyF: () => this.enterDoor(),
    KeyQ: () => this.toggleHideMode(),
    KeyG: () => this.setFlying(!this.state.flying),
    KeyP: () => this.setMoveMode(!this.state.moveMode),
    KeyN: () => this.toggleSnap(),
    KeyR: () => this.resetChanges(),
  }

  constructor(viewer: Viewer, state: WalkModeState, onExit: () => void) {
    this.viewer = viewer
    this.state = state
    this.onExit = onExit
  }

  activate() {
    if (this.active) return
    this.active = true

    const { camera } = this.viewer

    // Assumes the world up axis points along +X, +Y or +Z
    const up = camera.worldUp.map(Math.abs)
    const upAxis = up.indexOf(Math.max(...up))
    this.axes = [(upAxis + 1) % 3, (upAxis + 2) % 3, upAxis]

    const eye = this.toWalk(camera.eye)
    const look = this.toWalk(camera.look)
    this.yaw = Math.atan2(look[1] - eye[1], look[0] - eye[0])
    this.pitch = 0
    this.verticalSpeed = 0
    this.grounded = false
    this.typeByEntityId = objectTypes(this.viewer)
    this.hideObstructingObjects()
    this.groundLevel = this.resolveGroundLevel()

    this.position[0] = look[0]
    this.position[1] = look[1]
    this.position[2] = Math.max(this.groundLevel, look[2])

    this.viewer.cameraControl.active = false
    camera.up = [...camera.worldUp]

    this.listeners = new AbortController()
    const { signal } = this.listeners
    const canvas = this.getCanvas()

    canvas.addEventListener('mousedown', this.lockPointer, { signal })
    canvas.addEventListener('mousedown', this.handlePrimaryDown, { signal })
    document.addEventListener('mouseup', this.releaseHeld, { signal })
    document.addEventListener('mousemove', this.handleMouseMove, { signal })
    window.addEventListener('keydown', this.handleKeyDown, { signal })
    window.addEventListener('keyup', this.handleKeyUp, { signal })
    window.addEventListener('blur', this.releaseKeys, { signal })
    document.addEventListener('pointerlockchange', this.handlePointerLockChange, { signal })

    this.tickSubId = this.viewer.scene.on('tick', this.handleTick)

    this.syncCamera()
    this.lockPointer()
  }

  deactivate() {
    if (!this.active) return
    this.active = false

    this.listeners?.abort()
    this.listeners = undefined
    this.releaseKeys()

    if (this.tickSubId !== undefined) {
      this.viewer.scene.off(this.tickSubId)
      this.tickSubId = undefined
    }

    if (document.pointerLockElement) document.exitPointerLock()

    this.setTarget(undefined)
    this.releaseHeld()

    this.state.hideMode = false
    if (this.state.moveMode) this.setMoveMode(false)
    if (this.state.flying) this.setFlying(false)

    this.viewer.scene.setObjectsVisible(this.hiddenEntityIds, true)
    this.hiddenEntityIds = []
    this.typeByEntityId = new Map()

    this.viewer.cameraControl.active = true
  }

  private toWorld(walk: Vec3) {
    const world = [0, 0, 0]
    this.axes.forEach((axis, index) => world[axis] = walk[index]!)
    return world
  }

  private toWalk(world: ArrayLike<number>): Vec3 {
    return [world[this.axes[0]]!, world[this.axes[1]]!, world[this.axes[2]]!]
  }

  private castRay(origin: Vec3, direction: Vec3) {
    const worldPos = this.viewer.scene.pick({
      origin: this.toWorld(origin),
      direction: this.toWorld(direction),
      pickSurface: true,
      pickSurfaceNormal: false,
    })?.worldPos

    return worldPos ? this.toWalk(worldPos) : undefined
  }

  private castDown(fromHeight: number) {
    return this.castRay([this.position[0], this.position[1], fromHeight], [0, 0, -1])?.[2]
  }

  private moveAxis(axis: 0 | 1, step: number) {
    const reach = BODY_RADIUS + Math.abs(step)
    const direction: Vec3 = [0, 0, 0]
    direction[axis] = Math.sign(step)

    const hit = this.castRay([this.position[0], this.position[1], this.position[2] + BODY_HEIGHT / 2], direction)
    if (hit && Math.abs(hit[axis] - this.position[axis]) <= reach) return

    this.position[axis] += step
  }

  private resolveGroundLevel() {
    const { scene } = this.viewer
    const level = scene.getAABB(scene.visibleObjectIds)[this.axes[2]]

    return Number.isFinite(level) ? level! : 0
  }

  private entityType(entityId: string) {
    return this.typeByEntityId.get(entityId)?.toLowerCase() ?? ''
  }

  private hideObstructingObjects() {
    this.hiddenEntityIds = this.viewer.scene.visibleObjectIds.filter(id => OBSTRUCTING_TYPES.has(this.entityType(id)))
    this.viewer.scene.setObjectsVisible(this.hiddenEntityIds, false)
  }

  private setTarget(entityId: string | undefined) {
    if (entityId === this.targetEntityId) return

    const { objects } = this.viewer.scene
    const previous = this.targetEntityId ? objects[this.targetEntityId] : undefined
    if (previous) previous.highlighted = false

    const next = entityId ? objects[entityId] : undefined
    if (next) next.highlighted = true

    this.targetEntityId = entityId

    if (!entityId) this.state.target = null
    else if (this.state.moveMode) this.state.target = 'move'
    else if (this.state.hideMode) this.state.target = 'hide'
    else this.state.target = 'door'
  }

  private handlePrimaryDown = (event: MouseEvent) => {
    if (event.button !== 0) return
    if (this.state.hideMode) return this.hideTarget()
    if (!this.state.moveMode || this.heldEntityId) return

    const entityId = this.targetEntityId
    const entity = entityId ? this.viewer.scene.objects[entityId] : undefined
    const grabPoint = this.targetPoint
    if (!entityId || !entity || !grabPoint) return

    this.heldEntityId = entityId
    this.movedEntityIds.add(entityId)
    this.guardMovedVisibility()
    this.heldStartOffset = [...(entity.offset ?? [0, 0, 0])]
    this.heldBaseAabb = [...entity.aabb]
    this.heldGrabPoint = grabPoint
    this.heldOffset = [...this.heldStartOffset]
    this.snapPlacement = undefined
    this.snapDue = 0
    this.heldDistance = distance(grabPoint, this.viewer.camera.eye)

    entity.pickable = false
    this.state.target = 'place'
  }

  private releaseHeld = () => {
    const entity = this.heldEntityId ? this.viewer.scene.objects[this.heldEntityId] : undefined
    if (!entity) return

    this.snapDue = 0
    this.updateHeldObject()

    entity.pickable = true
    this.heldEntityId = undefined

    this.viewChanged = true
    this.targetScanDue = 0
    this.state.target = this.targetEntityId ? 'move' : null
  }

  private viewDirection() {
    const { eye, look } = this.viewer.camera
    const length = distance(look, eye) || 1

    return [0, 1, 2].map(axis => (look[axis]! - eye[axis]!) / length)
  }

  private updateHeldObject(seconds?: number) {
    const entity = this.heldEntityId ? this.viewer.scene.objects[this.heldEntityId] : undefined
    if (!entity) return

    const { eye } = this.viewer.camera
    const direction = this.viewDirection()
    const snap = this.snapSurface()
    const base = this.heldBaseAabb
    const halfExtent = (axis: number) => (base[axis + 3]! - base[axis]!) / 2

    // Push the object out along the surface normal by its half size, so it rests on the surface instead of in it
    const push = snap ? [0, 1, 2].reduce((sum, axis) => sum + Math.abs(snap.normal[axis]!) * halfExtent(axis), 0) : 0

    const target = [0, 1, 2].map(axis => snap
      ? snap.point[axis]! + snap.normal[axis]! * push - (base[axis]! + base[axis + 3]!) / 2
      : this.heldStartOffset[axis]! + eye[axis]! + direction[axis]! * this.heldDistance - this.heldGrabPoint[axis]!,
    )

    const blend = seconds === undefined ? 1 : 1 - Math.exp(-HELD_SMOOTHING * seconds)
    const offset = [0, 1, 2].map(axis => this.heldOffset[axis]! + (target[axis]! - this.heldOffset[axis]!) * blend)

    if (offset.every((value, axis) => Math.abs(value - this.heldOffset[axis]!) < OFFSET_EPSILON)) return

    this.heldOffset = offset
    entity.offset = offset
  }

  private toggleSnap() {
    this.state.snap = !this.state.snap
    this.snapPlacement = undefined
    this.snapDue = 0
  }

  private snapSurface() {
    if (!this.state.snap) return undefined

    const now = performance.now()
    if (now < this.snapDue) return this.snapPlacement

    this.snapDue = now + SNAP_INTERVAL

    const eye = [...this.viewer.camera.eye]
    const direction = this.viewDirection()
    const hit = this.viewer.scene.pick({ origin: eye, direction, pickSurface: true })
    const worldPos = hit?.worldPos

    this.snapPlacement = worldPos && distance(worldPos, eye) <= SNAP_REACH
      ? { point: [...worldPos], normal: this.facingNormal(hit?.worldNormal, direction) }
      : undefined

    return this.snapPlacement
  }

  // Unit surface normal flipped to face the viewer, or world up when the pick has no usable normal
  private facingNormal(worldNormal: number[] | null | undefined, rayDirection: number[]) {
    const length = worldNormal ? Math.hypot(worldNormal[0]!, worldNormal[1]!, worldNormal[2]!) : 0
    if (!worldNormal || length < 1e-6) return [...this.viewer.camera.worldUp]

    const sign = worldNormal.reduce((dot, value, axis) => dot + value * rayDirection[axis]!, 0) > 0 ? -1 : 1

    return [...worldNormal].map(value => (sign * value) / length)
  }

  private setMoveMode(active: boolean) {
    // Moving objects relies on Entity offsets, which DTX-encoded models do not support
    if (active && this.viewer.scene.dtxEnabled) return

    this.state.moveMode = active
    if (active && this.state.hideMode) this.toggleHideMode()
    if (!active) this.releaseHeld()

    this.setTarget(undefined)
    this.viewChanged = true
    this.targetScanDue = 0
  }

  private setFlying(active: boolean) {
    this.state.flying = active
    this.verticalSpeed = 0
    this.grounded = false
  }

  private toggleHideMode() {
    this.state.hideMode = !this.state.hideMode
    if (this.state.hideMode && this.state.moveMode) this.setMoveMode(false)

    this.setTarget(undefined)
    this.viewChanged = true
    this.targetScanDue = 0
  }

  private scanForTarget(seconds: number) {
    if (!this.viewChanged || this.heldEntityId) return

    this.targetScanDue -= seconds
    if (this.targetScanDue > 0) return

    this.targetScanDue = TARGET_SCAN_INTERVAL
    this.viewChanged = false

    const canvas = this.getCanvas()
    const hit = this.viewer.scene.pick({
      canvasPos: [canvas.clientWidth / 2, canvas.clientHeight / 2],
      pickSurface: true,
    })

    const entityId = hit?.entity ? String(hit.entity.id) : undefined
    const reach = hit?.worldPos ? distance(hit.worldPos, this.viewer.camera.eye) : Infinity

    const interactive = !!entityId && reach <= TARGET_REACH
      && (this.state.moveMode || this.state.hideMode || (!this.state.flying && DOOR_TYPES.has(this.entityType(entityId))))

    this.targetPoint = interactive && hit?.worldPos ? [...hit.worldPos] : undefined
    this.setTarget(interactive ? entityId : undefined)
  }

  private hideTarget() {
    const entityId = this.targetEntityId
    const target = entityId ? this.viewer.scene.objects[entityId] : undefined
    if (!entityId || !target) return

    this.setTarget(undefined)
    target.visible = false
    this.manuallyHiddenIds.push(entityId)
  }

  private resetChanges() {
    this.viewer.scene.setObjectsVisible(this.manuallyHiddenIds, true)
    this.manuallyHiddenIds = []

    for (const entityId of this.movedEntityIds) {
      const entity = this.viewer.scene.objects[entityId]
      if (entity) entity.offset = [0, 0, 0]
    }
    this.movedEntityIds.clear()
    this.releaseCullGuard()

    this.setTarget(undefined)
    this.viewChanged = true
    this.targetScanDue = 0
  }

  // View culling works from the original bounds, so a moved object could be culled while it is in view
  private guardMovedVisibility() {
    if (this.cullGuardSubId !== undefined) return

    this.cullGuardSubId = this.viewer.scene.on('tick', this.keepMovedVisible)
  }

  private releaseCullGuard() {
    if (this.cullGuardSubId === undefined) return

    this.viewer.scene.off(this.cullGuardSubId)
    this.cullGuardSubId = undefined
  }

  private keepMovedVisible = () => {
    for (const entityId of this.movedEntityIds) {
      const entity = this.viewer.scene.objects[entityId]
      if (entity?.culled) entity.culled = false
    }
  }

  // Steps through the targeted door along the view direction and lands just behind it
  private enterDoor() {
    if (this.state.flying) return

    const entityId = this.targetEntityId
    const door = entityId ? this.viewer.scene.objects[entityId] : undefined
    if (!entityId || !door || !DOOR_TYPES.has(this.entityType(entityId))) return

    const doorOffset = door.offset ?? [0, 0, 0]
    const aabb = door.aabb.map((value, index) => value + doorOffset[index % 3]!)
    const min = this.toWalk(aabb.slice(0, 3))
    const max = this.toWalk(aabb.slice(3))
    const dirX = Math.cos(this.yaw)
    const dirY = Math.sin(this.yaw)
    const reach = (Math.abs(dirX) * (max[0] - min[0]) + Math.abs(dirY) * (max[1] - min[1])) / 2
      + BODY_RADIUS
      + DOOR_PASS_MARGIN

    this.position[0] = (min[0] + max[0]) / 2 + dirX * reach
    this.position[1] = (min[1] + max[1]) / 2 + dirY * reach
    this.position[2] = Math.max(this.groundLevel, min[2])
    this.verticalSpeed = 0
    this.grounded = false

    this.setTarget(undefined)
    this.syncCamera()
  }

  private applyGravity(seconds: number) {
    this.verticalSpeed -= GRAVITY * seconds

    const floorLevel = this.castDown(this.position[2] + STEP_HEIGHT)
    const ground = Math.max(this.groundLevel, floorLevel ?? this.groundLevel)
    const nextHeight = this.position[2] + this.verticalSpeed * seconds

    if (nextHeight <= ground) {
      this.position[2] = ground
      this.verticalSpeed = 0
      this.grounded = true
    }
    else {
      this.position[2] = nextHeight
      this.grounded = false
    }
  }

  private syncCamera() {
    const { camera } = this.viewer
    const cosPitch = Math.cos(this.pitch)
    const eye: Vec3 = [this.position[0], this.position[1], this.position[2] + EYE_HEIGHT]

    camera.eye = this.toWorld(eye)
    camera.look = this.toWorld([
      eye[0] + cosPitch * Math.cos(this.yaw),
      eye[1] + cosPitch * Math.sin(this.yaw),
      eye[2] + Math.sin(this.pitch),
    ])

    this.viewChanged = true
  }

  private handleTick = (tickEvent: TickEvent) => {
    const seconds = Math.min(Number(tickEvent.deltaTime) / 1000, MAX_FRAME_SECONDS)

    this.scanForTarget(seconds)

    if (this.heldEntityId) this.updateHeldObject(seconds)

    const keys = this.pressedKeys
    const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0)
    const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0)
    const ascending = keys.has('Space')
    const descending = keys.has('ControlLeft') || keys.has('ControlRight')
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight')
    const resting = this.grounded && this.verticalSpeed === 0

    if (this.state.flying) {
      this.flyStep(seconds, forward, strafe, (ascending ? 1 : 0) - (descending ? 1 : 0), running ? FLY_FAST_SPEED : FLY_SPEED)
      return
    }

    if (!forward && !strafe && !ascending && resting) return

    if (forward || strafe) {
      const step = ((running ? RUN_SPEED : WALK_SPEED) * seconds) / Math.hypot(forward, strafe)
      const sin = Math.sin(this.yaw)
      const cos = Math.cos(this.yaw)

      this.moveAxis(0, (cos * forward + sin * strafe) * step)
      this.moveAxis(1, (sin * forward - cos * strafe) * step)
    }

    if (ascending) {
      this.verticalSpeed = Math.min(this.verticalSpeed + JETPACK_ACCELERATION * seconds, JETPACK_MAX_SPEED)
    }

    this.applyGravity(seconds)
    this.syncCamera()
  }

  private flyStep(seconds: number, forward: number, strafe: number, lift: number, speed: number) {
    if (!forward && !strafe && !lift) return

    if (forward || strafe) {
      const step = (speed * seconds) / Math.hypot(forward, strafe)
      const sin = Math.sin(this.yaw)
      const cos = Math.cos(this.yaw)
      const cosPitch = Math.cos(this.pitch)

      this.position[0] += (cos * forward * cosPitch + sin * strafe) * step
      this.position[1] += (sin * forward * cosPitch - cos * strafe) * step
      this.position[2] += Math.sin(this.pitch) * forward * step
    }

    this.position[2] += lift * speed * seconds

    this.syncCamera()
  }

  private handleMouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== this.getCanvas()) return

    const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value))

    this.yaw -= clamp(event.movementX, MAX_LOOK_DELTA) * LOOK_SENSITIVITY
    this.pitch = clamp(this.pitch - clamp(event.movementY, MAX_LOOK_DELTA) * LOOK_SENSITIVITY, MAX_PITCH)

    this.syncCamera()
  }

  private handlePointerLockChange = () => {
    if (!this.active || document.pointerLockElement) return

    this.onExit()
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.altKey || isTypingTarget(event.target)) return
    if (event.ctrlKey && !MOVE_KEYS.has(event.code)) return

    if (LEGEND_KEYS.has(event.code) && !this.pressedKeys.has(event.code)) {
      this.pressedKeys.add(event.code)
      this.emitPressedKeys()
    }

    if (event.code === 'Escape') return this.onExit()

    const action = this.keyActions[event.code]

    if (action) {
      if (!event.repeat) action()
      event.preventDefault()
    }
    else if (MOVE_KEYS.has(event.code)) {
      event.preventDefault()
    }
  }

  private handleKeyUp = (event: KeyboardEvent) => {
    if (this.pressedKeys.delete(event.code)) this.emitPressedKeys()
  }

  private releaseKeys = () => {
    if (!this.pressedKeys.size) return

    this.pressedKeys.clear()
    this.emitPressedKeys()
  }

  private emitPressedKeys() {
    this.state.pressedKeys = [...new Set([...this.pressedKeys].map(code => LEGEND_KEYS.get(code)!))]
  }

  private lockPointer = () => {
    void Promise.resolve(this.getCanvas().requestPointerLock()).catch(() => {})
  }

  private getCanvas() {
    // Scene.canvas is typed as a bare Component in the SDK
    return (this.viewer.scene.canvas as unknown as { canvas: HTMLCanvasElement }).canvas
  }
}
