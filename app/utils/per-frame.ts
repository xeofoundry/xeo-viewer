// Scene events fire once per entity, so a bulk change is coalesced into one run per frame
export function perFrame(run: () => void) {
  let scheduled = false

  return () => {
    if (scheduled) return

    scheduled = true

    requestAnimationFrame(() => {
      scheduled = false
      run()
    })
  }
}
