import type { Viewer } from '@xeokit/xeokit-sdk'

interface BufferHooks {
  bindBuffer?: (target: number, buffer: WebGLBuffer | null) => void
  bufferSubData?: (target: number, offset: number, data: ArrayBufferView, ...rest: number[]) => void
}

const MIN_WRITES_TO_MERGE = 8

// xeokit uploads entity flags with one bufferSubData per mesh. Thousands of them following a pick stall the GPU
// process for seconds, so the writes made inside `run` are merged into a single upload per buffer.
export function batchFlagUploads<T>(viewer: Viewer, run: () => T): T {
  const gl = viewer.scene.canvas.gl as WebGL2RenderingContext

  if (typeof gl.getBufferSubData !== 'function') return run()

  const proto = WebGL2RenderingContext.prototype
  const hooks = gl as unknown as BufferHooks
  const pending = new Map<WebGLBuffer, { offset: number, data: Float32Array }[]>()
  let bound: WebGLBuffer | null = null

  hooks.bindBuffer = (target, buffer) => {
    if (target === gl.ARRAY_BUFFER) bound = buffer

    proto.bindBuffer.call(gl, target, buffer)
  }

  hooks.bufferSubData = (target, offset, data, ...rest) => {
    if (target !== gl.ARRAY_BUFFER || !bound || !(data instanceof Float32Array) || rest.length) {
      return (proto.bufferSubData as NonNullable<BufferHooks['bufferSubData']>).call(gl, target, offset, data, ...rest)
    }

    const writes = pending.get(bound) ?? []

    // xeokit reuses one scratch array for every write
    writes.push({ offset, data: data.slice() })
    pending.set(bound, writes)
  }

  try {
    return run()
  }
  finally {
    delete hooks.bindBuffer
    delete hooks.bufferSubData

    for (const [buffer, writes] of pending) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)

      if (writes.length < MIN_WRITES_TO_MERGE) {
        for (const write of writes) gl.bufferSubData(gl.ARRAY_BUFFER, write.offset, write.data)

        continue
      }

      let start = Infinity
      let end = 0

      for (const write of writes) {
        start = Math.min(start, write.offset)
        end = Math.max(end, write.offset + write.data.byteLength)
      }

      // The gaps between the writes hold other meshes' flags, so the span is read back before it is overwritten
      const span = new Float32Array((end - start) / Float32Array.BYTES_PER_ELEMENT)

      gl.getBufferSubData(gl.ARRAY_BUFFER, start, span)

      for (const write of writes) span.set(write.data, (write.offset - start) / Float32Array.BYTES_PER_ELEMENT)

      gl.bufferSubData(gl.ARRAY_BUFFER, start, span)
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, bound)
  }
}
