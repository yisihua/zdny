<script setup>
import { computed, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppHead from '@/components/head/index.vue'
import MapPanel from '@/components/map/MapPanel.vue'
import { mapPanelKey } from '@/components/map/context.js'

const route = useRoute()
const layers = ref([])
const cover = ref(false)
const fitLayerId = ref('')

const mapOpen = computed(() => layers.value.length > 0)

function layerDupeKey(item) {
  if (item?.wmsUrl) return `wms:${item.wmsUrl}`
  if (item?.mapUrl) return `map:${item.mapUrl}`
  if (item?.geojson) return `geojson:${item.fileName || ''}:${item.ext || ''}`
  return `file:${item?.id || item?.fileName || ''}`
}

function openMap(next) {
  if (!next) return
  const key = layerDupeKey(next)
  const existing = layers.value.find((item) => layerDupeKey(item) === key)
  if (existing) {
    fitLayerId.value = existing.id
    cover.value = false
    return
  }

  const id = String(next.id || next.layerId || `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
  layers.value = [
    ...layers.value,
    {
      id,
      fileName: next.fileName || next.name || 'layer',
      ext: next.ext || '',
      geojson: next.geojson || null,
      mapUrl: next.mapUrl || '',
      wmsUrl: next.wmsUrl || '',
      wmsLayer: next.wmsLayer || '',
      visible: true,
    },
  ]
  fitLayerId.value = id
  cover.value = false
}

function closeMap() {
  layers.value = []
  fitLayerId.value = ''
  cover.value = false
}

function removeLayer(id) {
  layers.value = layers.value.filter((item) => item.id !== id)
  if (!layers.value.length) {
    closeMap()
    return
  }
  if (fitLayerId.value === id) fitLayerId.value = layers.value[layers.value.length - 1]?.id || ''
}

function setLayerVisible(id, visible) {
  layers.value = layers.value.map((item) =>
    item.id === id ? { ...item, visible: Boolean(visible) } : item,
  )
}

function moveLayer(id, direction) {
  const list = [...layers.value]
  const index = list.findIndex((item) => item.id === id)
  if (index < 0) return
  const target = direction === 'up' ? index + 1 : index - 1
  if (target < 0 || target >= list.length) return
  const tmp = list[index]
  list[index] = list[target]
  list[target] = tmp
  layers.value = list
}

function fitLayer(id) {
  if (!id) return
  fitLayerId.value = ''
  requestAnimationFrame(() => {
    fitLayerId.value = id
  })
}

provide(mapPanelKey, {
  layers,
  openMap,
  closeMap,
  removeLayer,
  setLayerVisible,
  moveLayer,
  fitLayer,
})

watch(() => route.path, closeMap)
</script>

<template>
  <div class="layout">
    <AppHead />
    <div class="body">
      <main class="main">
        <router-view />
      </main>
      <MapPanel
        v-if="mapOpen"
        :layers="layers"
        :fit-layer-id="fitLayerId"
        :cover="cover"
        @close="closeMap"
        @cover="cover = true"
        @restore="cover = false"
        @remove-layer="removeLayer"
        @toggle-layer="({ id, visible }) => setLayerVisible(id, visible)"
        @move-layer="({ id, direction }) => moveLayer(id, direction)"
        @fit-layer="fitLayer"
      />
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.body {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
}

.main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 20px;
  color: #edfff6;
  background:
    radial-gradient(90% 50% at 12% 0%, rgba(40, 140, 90, 0.22), transparent 46%),
    #04140f;
}

.main :deep(.el-card) {
  border: 1px solid rgba(140, 220, 175, 0.22);
  background: rgba(8, 36, 28, 0.72);
  color: #edfff6;
  box-shadow: none;
  backdrop-filter: blur(14px);
}

.main :deep(.el-card__header) {
  border-bottom-color: rgba(140, 220, 175, 0.18);
  color: #edfff6;
}

.main :deep(.el-input__wrapper),
.main :deep(.el-textarea__inner) {
  color: #f3fff8;
  background: rgba(3, 18, 14, 0.55);
  box-shadow: 0 0 0 1px rgba(138, 214, 176, 0.32) inset;
}

.main :deep(.el-input__inner),
.main :deep(.el-textarea__inner) {
  color: #f3fff8;
}

.main :deep(.el-input__inner::placeholder),
.main :deep(.el-textarea__inner::placeholder) {
  color: rgba(198, 224, 210, 0.55);
}

.main :deep(.el-table) {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: rgba(255, 255, 255, 0.04);
  --el-table-row-hover-bg-color: rgba(80, 200, 140, 0.12);
  --el-table-text-color: #edfff6;
  --el-table-header-text-color: rgba(214, 245, 228, 0.82);
  --el-fill-color-lighter: rgba(255, 255, 255, 0.04);
  --el-table-border-color: rgba(140, 220, 175, 0.16);
  background: transparent;
}

.main :deep(.el-empty__description p) {
  color: rgba(214, 245, 228, 0.72);
}
</style>
