export default defineAppConfig({
  ui: {
    colors: {
      primary: 'violet',
      neutral: 'zinc',
    },
    button: {
      // The default dark-mode text on primary is near black, invisible on the dark #060729 accent
      compoundVariants: [{ color: 'primary', variant: 'solid', class: 'text-white' }],
    },
    checkbox: {
      slots: { indicator: 'text-white' },
    },
    // Floating content is portaled to the body without a z-index, so measurement labels drew over it
    dropdownMenu: {
      slots: { content: 'z-100' },
    },
    contextMenu: {
      slots: { content: 'z-100' },
    },
    tooltip: {
      slots: { content: 'z-100' },
    },
    tabs: {
      compoundVariants: [{ color: 'primary', variant: 'pill', class: { trigger: 'data-[state=active]:text-white' } }],
    },
  },
})
