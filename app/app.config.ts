// Nuxt UI's opaque zinc fills, rings and hovers clash with the translucent purple-tinted panels, white tints blend in
const field = {
  variants: { variant: { outline: 'bg-white/5 ring-white/15 hover:bg-white/10 disabled:bg-white/5' } },
}

// Floating content is portaled to the body without a z-index, so measurement labels drew over it
const menu = {
  content: 'z-100 bg-surface ring-white/15',
  separator: 'bg-white/15',
}

const menuHighlight = {
  active: { false: { item: 'data-highlighted:before:bg-white/10 data-[state=open]:before:bg-white/10' } },
}

const selectItem = 'data-highlighted:not-data-disabled:before:bg-white/10'

export default defineAppConfig({
  ui: {
    colors: {
      primary: 'violet',
      neutral: 'zinc',
    },
    button: {
      compoundVariants: [
        // Dark mode puts near-black text on primary, which reads poorly on violet-600
        { color: 'primary', variant: 'solid', class: 'text-white' },
        { color: 'neutral', variant: 'ghost', class: 'hover:bg-white/10 active:bg-white/15' },
      ],
    },
    checkbox: {
      slots: { indicator: 'text-white' },
    },
    input: field,
    select: { ...field, slots: { ...menu, item: selectItem } },
    selectMenu: { ...field, slots: { ...menu, item: selectItem } },
    dropdownMenu: { slots: menu, variants: menuHighlight },
    contextMenu: { slots: menu, variants: menuHighlight },
    popover: {
      slots: { content: menu.content },
    },
    tooltip: {
      slots: { content: 'z-100' },
    },
    tabs: {
      compoundVariants: [{ color: 'primary', variant: 'pill', class: { list: 'bg-white/5', trigger: 'data-[state=active]:text-white' } }],
    },
  },
})
