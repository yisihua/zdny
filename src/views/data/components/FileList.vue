<script setup>
import { ref } from 'vue'
import { Delete, Download, MapLocation } from '@element-plus/icons-vue'
import { canLoadMap } from '../records.js'
import { t } from '@/i18n'

defineProps({
  rows: { type: Array, required: true },
  status: { type: String, required: true },
})

defineEmits(['load', 'download', 'remove'])

const checked = ref([])

function toggle(id) {
  checked.value = checked.value.includes(id)
    ? checked.value.filter((item) => item !== id)
    : [...checked.value, id]
}

function when(row) {
  return `${row.updatedAt.replaceAll('-', '/')} ${row.time}`
}
</script>

<template>
  <div class="scroll">
  <p v-if="!rows.length" class="empty">{{ t('data.empty') }}</p>
  <ul v-else class="list">
    <li v-for="row in rows" :key="row.id">
      <input type="checkbox" :checked="checked.includes(row.id)" :aria-label="row.fileName" @change="toggle(row.id)" />
      <div class="main">
        <strong>{{ row.fileName }}</strong>
        <p>{{ t('data.meta', { id: row.sessionId, ext: row.ext, status, size: row.sizeKb, time: when(row) }) }}</p>
      </div>
      <div class="ops">
        <button v-if="canLoadMap(row.ext)" type="button" @click="$emit('load', row)"><el-icon><MapLocation /></el-icon>{{ t('data.load') }}</button>
        <button type="button" @click="$emit('download', row)"><el-icon><Download /></el-icon>{{ t('data.download') }}</button>
        <button type="button" @click="$emit('remove', row)"><el-icon><Delete /></el-icon>{{ t('data.remove') }}</button>
      </div>
    </li>
  </ul>
  </div>
</template>

<style scoped>
.scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: #3dca78 rgba(8, 36, 28, 0.72);
}

.scroll::-webkit-scrollbar {
  width: 8px;
}

.scroll::-webkit-scrollbar-track {
  margin: 4px 0;
  border-radius: 999px;
  background: rgba(8, 36, 28, 0.72);
}

.scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: linear-gradient(180deg, #8cf0ae, #1f8a52);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0 8px 0 0;
  list-style: none;
}

li {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid rgba(140, 220, 175, 0.18);
  border-radius: 12px;
  background: rgba(3, 18, 14, 0.45);
}

input {
  width: 16px;
  height: 16px;
  accent-color: #2fbf6a;
}

.main {
  min-width: 0;
  flex: 1;
}

strong {
  display: block;
  font-size: 15px;
}

p,
.empty {
  margin: 6px 0 0;
  color: rgba(214, 245, 228, 0.62);
  font-size: 13px;
}

.empty {
  margin: 8px 0 0;
}

.ops {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid rgba(140, 220, 175, 0.32);
  border-radius: 8px;
  color: #e7fff4;
  background: transparent;
  font: inherit;
  cursor: pointer;
}

@media (max-width: 800px) {
  li {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .ops {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
