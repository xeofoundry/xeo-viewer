export type ToolMode = 'select' | 'hide' | 'measure' | 'slice'

const toolMode = ref<ToolMode | null>('select')

export const useToolMode = () => toolMode

export function useSliceMode() {
  const tool = useToolMode()

  return computed(() => tool.value === 'slice')
}
