<script setup>
import { t } from '@/i18n'

defineProps({
  searchBy: { type: String, required: true },
  keyword: { type: String, required: true },
  ext: { type: String, required: true },
  order: { type: String, required: true },
})

defineEmits(['update:searchBy', 'update:keyword', 'update:ext', 'update:order'])

const modes = [
  { id: 'file', key: 'data.fileName' },
  { id: 'session', key: 'data.session' },
]
const types = ['TIF', 'SHP', 'PNG', 'ZIP', 'CSV', 'GeoJSON', 'JSON', 'TXT', 'PDF']
</script>

<template>
  <div class="filters">
    <p class="caption">{{ t('data.caption') }}</p>
    <div class="search-row">
      <div class="modes" role="tablist" :aria-label="t('data.searchField')">
        <button
          v-for="item in modes"
          :key="item.id"
          type="button"
          :class="{ 'is-active': item.id === searchBy }"
          @click="$emit('update:searchBy', item.id)"
        >
          {{ t(item.key) }}
        </button>
      </div>
      <el-input
        :model-value="keyword"
        clearable
        :placeholder="searchBy === 'file' ? t('data.fileName') : t('data.session')"
        class="search"
        @update:model-value="$emit('update:keyword', $event)"
      />
    </div>
    <div class="option-row">
      <div class="group">
        <span>{{ t('data.type') }}</span>
        <button type="button" :class="{ 'is-active': ext === 'all' }" @click="$emit('update:ext', 'all')">{{ t('data.all') }}</button>
        <button
          v-for="item in types"
          :key="item"
          type="button"
          :class="{ 'is-active': item === ext }"
          @click="$emit('update:ext', item)"
        >
          {{ item }}
        </button>
      </div>
      <div class="group">
        <span>{{ t('data.time') }}</span>
        <button type="button" :class="{ 'is-active': order === 'new' }" @click="$emit('update:order', 'new')">{{ t('data.newest') }}</button>
        <button type="button" :class="{ 'is-active': order === 'old' }" @click="$emit('update:order', 'old')">{{ t('data.oldest') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.caption {
  margin: 0;
  color: rgba(214, 245, 228, 0.62);
  font-size: 13px;
}

.search-row,
.option-row,
.group,
.modes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.option-row {
  justify-content: space-between;
}

.search {
  width: min(420px, 100%);
}

.group span {
  color: rgba(214, 245, 228, 0.72);
}

button {
  height: 32px;
  padding: 0 12px;
  border: 1px solid rgba(140, 220, 175, 0.28);
  border-radius: 8px;
  color: #e7fff4;
  background: rgba(3, 18, 14, 0.45);
  font: inherit;
  cursor: pointer;
}

button.is-active {
  border-color: transparent;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
}
</style>
