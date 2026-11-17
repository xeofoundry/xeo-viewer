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
  },
})
