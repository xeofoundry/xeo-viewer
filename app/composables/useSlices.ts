interface SlicesOwner {
  count: () => number
  clear: () => void
}

// Slices.vue owns the section planes, so the scene menu reads and clears them through what it registers here
let owner: SlicesOwner = { count: () => 0, clear: () => {} }

export function useSlices() {
  return {
    count: () => owner.count(),
    clear: () => owner.clear(),
    register: (slices: SlicesOwner) => {
      owner = slices
    },
  }
}
