interface SlicesOwner {
  count: () => number
  clear: () => void
}

// Slices.vue owns the section planes, so the scene menu reads and clears them through what it registers here
const owner = shallowRef<SlicesOwner>({ count: () => 0, clear: () => {} })

export function useSlices() {
  return {
    count: () => owner.value.count(),
    clear: () => owner.value.clear(),
    register: (slices: SlicesOwner) => {
      owner.value = slices
    },
  }
}
