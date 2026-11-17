<script setup>
import { computed } from 'vue'
import { Aim, Bottom, Delete, Top, View, Hide } from '@element-plus/icons-vue'
import SatelliteMap from './SatelliteMap.vue'
import { t } from '@/i18n'

const props = defineProps({
  layers: { type: Array, default: () => [] },
  fitLayerId: { type: String, default: '' },
  cover: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'cover', 'restore', 'remove-layer', 'toggle-layer', 'move-layer', 'fit-layer'])

const titleName = computed(() => {
  const list = props.layers || []
  if (!list.length) return ''
  if (list.length === 1) return list[0].fileName
  return t('map.layerCount', { n: list.length })
})

/** 列表展示：顶层在上 */
const displayLayers = computed(() => [...(props.layers || [])].reverse())

function layerType(item) {
  if (item?.wmsUrl || item?.mapUrl) return 'WMS'
  if (item?.geojson || String(item?.ext || '').toUpperCase().includes('GEOJSON')) return 'GEOJSON'
  return String(item?.ext || 'LAYER').toUpperCase()
}

function canMoveUp(item) {
  const list = props.layers || []
  const index = list.findIndex((row) => row.id === item.id)
  return index >= 0 && index < list.length - 1
}

function canMoveDown(item) {
  const list = props.layers || []
  const index = list.findIndex((row) => row.id === item.id)
  return index > 0
}
</script>

<template>
  <aside class="drawer" :class="{ 'is-cover': cover }" role="dialog" :aria-label="titleName">
    <header>
      <div>
        <h2>{{ t('map.title') }}</h2>
        <p>{{ titleName }}</p>
      </div>
      <div class="actions">
        <button type="button" class="ghost" @click="cover ? emit('restore') : emit('cover')">
          {{ cover ? t('map.shrink') : t('map.enlarge') }}
        </button>
        <button type="button" @click="emit('close')">{{ t('map.close') }}</button>
      </div>
    </header>

    <div class="map-wrap">
      <SatelliteMap :layers="layers" :fit-layer-id="fitLayerId" />

      <section v-if="layers.length" class="layer-panel" :aria-label="t('map.layers')">
        <header class="layer-head">
          <strong>{{ t('map.layers') }}</strong>
          <em>{{ layers.length }}</em>
        </header>
        <ul class="layer-list">
          <li v-for="item in displayLayers" :key="item.id" :class="{ off: item.visible === false }">
            <div class="layer-meta">
              <em>{{ layerType(item) }}</em>
              <span :title="item.fileName">{{ item.fileName }}</span>
            </div>
            <div class="layer-ops">
              <button
                type="button"
                :title="item.visible === false ? t('map.show') : t('map.hide')"
                @click="emit('toggle-layer', { id: item.id, visible: item.visible === false })"
              >
                <el-icon>
                  <View v-if="item.visible !== false" />
                  <Hide v-else />
                </el-icon>
              </button>
              <button type="button" :title="t('map.jump')" @click="emit('fit-layer', item.id)">
                <el-icon><Aim /></el-icon>
              </button>
              <button
                type="button"
                :title="t('map.moveUp')"
                :disabled="!canMoveUp(item)"
                @click="emit('move-layer', { id: item.id, direction: 'up' })"
              >
                <el-icon><Top /></el-icon>
              </button>
              <button
                type="button"
                :title="t('map.moveDown')"
                :disabled="!canMoveDown(item)"
                @click="emit('move-layer', { id: item.id, direction: 'down' })"
              >
                <el-icon><Bottom /></el-icon>
              </button>
              <button type="button" class="danger" :title="t('map.remove')" @click="emit('remove-layer', item.id)">
                <el-icon><Delete /></el-icon>
              </button>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.drawer {
  display: flex;
  flex: 0 0 clamp(320px, 42vw, 560px);
  flex-direction: column;
  width: clamp(320px, 42vw, 560px);
  min-width: 0;
  min-height: 0;
  height: 100%;
  border-left: 1px solid rgba(140, 220, 175, 0.28);
  background: #071910;
}

.drawer.is-cover {
  position: absolute;
  inset: 0;
  z-index: 8;
  flex: none;
  width: auto;
  border-left: none;
}

header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
}

h2,
p {
  margin: 0;
}

h2 {
  font-size: 16px;
}

p {
  margin-top: 4px;
  color: rgba(214, 245, 228, 0.66);
  font-size: 13px;
}

.actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
}

button {
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 8px;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.ghost {
  color: #e7fff4;
  background: transparent;
  border: 1px solid rgba(140, 220, 175, 0.45);
  font-weight: 600;
}

.map-wrap {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
}

.map-wrap :deep(.map) {
  flex: 1;
  min-height: 0;
}

.layer-panel {
  position: absolute;
  right: auto;
  bottom: 12px;
  left: 12px;
  z-index: 4;
  display: grid;
  gap: 8px;
  width: min(280px, calc(100% - 24px));
  max-height: min(42%, 280px);
  padding: 10px;
  border: 1px solid rgba(140, 220, 175, 0.35);
  border-radius: 12px;
  background: rgba(4, 24, 18, 0.88);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(10px);
}

.layer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 2px;
}

.layer-head strong {
  font-size: 13px;
}

.layer-head em {
  color: rgba(214, 245, 228, 0.7);
  font-style: normal;
  font-size: 12px;
}

.layer-list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.layer-list li {
  display: grid;
  gap: 6px;
  padding: 8px;
  border: 1px solid rgba(140, 220, 175, 0.18);
  border-radius: 10px;
  background: rgba(8, 36, 28, 0.72);
}

.layer-list li.off {
  opacity: 0.55;
}

.layer-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.layer-meta em {
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: 999px;
  color: #8dffc8;
  background: rgba(140, 240, 174, 0.12);
  font-style: normal;
  font-size: 10px;
  font-weight: 700;
}

.layer-meta span {
  overflow: hidden;
  min-width: 0;
  color: #edfff6;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layer-ops {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.layer-ops button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid rgba(140, 220, 175, 0.28);
  border-radius: 8px;
  color: #d8ffe9;
  background: rgba(4, 24, 18, 0.55);
}

.layer-ops button:hover:not(:disabled) {
  border-color: rgba(140, 240, 174, 0.75);
}

.layer-ops button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.layer-ops button.danger {
  color: #ffb4b4;
  border-color: rgba(224, 112, 112, 0.45);
}
</style>
