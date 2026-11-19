export type ToolMode = 'select' | 'hide' | 'measure' | 'slice'

export const useToolMode = () => useState<ToolMode | null>('tool-mode', () => 'select')

export function useSliceMode() {
  const tool = useToolMode()

  return computed(() => tool.value === 'slice')
}
