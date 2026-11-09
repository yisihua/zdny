import { inject } from 'vue'

export const mapPanelKey = Symbol('map-panel')

export function useMapPanel() {
  const panel = inject(mapPanelKey)
  if (!panel) throw new Error('地图面板未就绪')
  return panel
}
