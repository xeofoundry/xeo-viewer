interface PanelConfig {
  id: string
  title: string
  icon: string
  column: 'left' | 'right'
  defaultWidth: number
  minHeight?: number
}

export const panels: PanelConfig[] = [
  { id: 'explorer', title: 'Explorer', icon: 'i-lucide-network', column: 'left', defaultWidth: 380, minHeight: 320 },
  { id: 'properties', title: 'Properties', icon: 'i-lucide-clipboard-list', column: 'right', defaultWidth: 380 },
  { id: 'filters', title: 'Filters', icon: 'i-lucide-filter', column: 'right', defaultWidth: 360 },
  { id: 'grouping', title: 'Grouping', icon: 'i-lucide-layout-panel-top', column: 'right', defaultWidth: 340 },
]

export const useOpenPanels = () => useState<Partial<Record<string, boolean>>>('open-panels', () => ({}))
