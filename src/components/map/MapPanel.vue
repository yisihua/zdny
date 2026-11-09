<script setup>
import SatelliteMap from './SatelliteMap.vue'
import { t } from '@/i18n'

defineProps({
  file: { type: Object, required: true },
  cover: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'cover', 'restore'])
</script>

<template>
  <aside class="drawer" :class="{ 'is-cover': cover }" role="dialog" :aria-label="file.fileName">
    <header>
      <div>
        <h2>{{ t('map.title') }}</h2>
        <p>{{ file.fileName }}</p>
      </div>
      <div class="actions">
        <button type="button" class="ghost" @click="cover ? emit('restore') : emit('cover')">
          {{ cover ? t('map.shrink') : t('map.enlarge') }}
        </button>
        <button type="button" @click="emit('close')">{{ t('map.close') }}</button>
      </div>
    </header>
    <SatelliteMap :file-name="file.fileName" :kind="file.ext" />
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

.drawer :deep(.map) {
  flex: 1;
  min-height: 0;
}
</style>
