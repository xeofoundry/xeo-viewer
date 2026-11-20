import type { AppConfigInput } from 'nuxt/schema'

// Nuxt UI's opaque zinc fills, rings and hovers clash with the translucent purple-tinted panels, tint overlays blend in
const field = {
  variants: { variant: { outline: 'bg-tint/5 ring-tint/15 hover:bg-tint/10 disabled:bg-tint/5' } },
}

// Floating content is portaled to the body without a z-index, so measurement labels drew over it
const menu = {
  content: 'z-100 bg-surface ring-tint/15',
  separator: 'bg-tint/15',
}

const menuHighlight = {
  active: { false: { item: 'data-highlighted:before:bg-tint/10 data-[state=open]:before:bg-tint/10' } },
}

const selectItem = 'data-highlighted:not-data-disabled:before:bg-tint/10'

// Plain object, so the web component's Vite config can import it outside Nuxt
export const ui = {
  colors: {
    primary: 'violet',
    neutral: 'zinc',
  },
  button: {
    compoundVariants: [
      // Dark mode puts near-black text on primary, which reads poorly on violet-600
      { color: 'primary', variant: 'solid', class: 'text-white' },
      { color: 'neutral', variant: 'ghost', class: 'hover:bg-tint/10 active:bg-tint/15' },
    ],
  },
  checkbox: {
    slots: { indicator: 'text-white' },
  },
  input: field,
  select: { ...field, slots: { ...menu, item: selectItem } },
  selectMenu: { ...field, slots: { ...menu, item: selectItem } },
  inputMenu: { ...field, slots: { ...menu, item: selectItem } },
  dropdownMenu: { slots: menu, variants: menuHighlight },
  contextMenu: { slots: menu, variants: menuHighlight },
  popover: {
    slots: { content: menu.content },
  },
  tooltip: {
    slots: { content: 'z-100' },
  },
  tabs: {
    compoundVariants: [{ color: 'primary', variant: 'pill', class: { list: 'bg-tint/5', trigger: 'data-[state=active]:text-white' } }],
  },
} satisfies AppConfigInput['ui']
