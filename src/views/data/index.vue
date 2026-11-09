<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import ScopeBar from './components/ScopeBar.vue'
import FilterBar from './components/FilterBar.vue'
import FileList from './components/FileList.vue'
import DataPager from './components/DataPager.vue'
import { useMapPanel } from '@/components/map/context.js'
import { t } from '@/i18n'
import { canLoadMap, createPersonalRecords, createPublicRecords, extOf } from './records.js'

const pageSize = 5
const scope = ref('personal')
const searchBy = ref('file')
const keyword = ref('')
const ext = ref('all')
const order = ref('new')
const page = ref(1)
const personal = ref(createPersonalRecords())
const publicRecords = ref(createPublicRecords())
const picker = ref(null)
const { file: preview, openMap, closeMap } = useMapPanel()

const current = computed(() => (scope.value === 'personal' ? personal.value : publicRecords.value))

const filtered = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  const list = current.value.filter((item) => {
    const field = searchBy.value === 'session' ? item.sessionId : item.fileName
    const hitText = !text || field.toLowerCase().includes(text)
    const hitExt = ext.value === 'all' || item.ext === ext.value
    return hitText && hitExt
  })
  return list.sort((a, b) => {
    const delta = a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : 0
    return order.value === 'new' ? -delta : delta
  })
})

const paged = computed(() => {
  const start = (page.value - 1) * pageSize
  return filtered.value.slice(start, start + pageSize)
})

watch([keyword, searchBy, ext, order, scope], () => {
  page.value = 1
})

watch(filtered, (list) => {
  const max = Math.max(1, Math.ceil(list.length / pageSize))
  if (page.value > max) page.value = max
})

function upload() {
  picker.value?.click()
}

function onPick(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const now = new Date()
  personal.value.unshift({
    id: `up-${now.getTime()}`,
    fileName: file.name,
    sessionId: `s-${now.getTime().toString().slice(-4)}`,
    ext: extOf(file.name),
    sizeKb: Math.max(1, Math.round(file.size / 1024)),
    time: now.toTimeString().slice(0, 5),
    code: `P-${String(personal.value.length + 1).padStart(4, '0')}`,
    name: file.name.replace(/\.[^.]+$/, ''),
    crop: '上传',
    trait: '本地上传',
    updatedAt: now.toISOString().slice(0, 10),
  })
  scope.value = 'personal'
  searchBy.value = 'file'
  keyword.value = ''
  ext.value = 'all'
  order.value = 'new'
  ElMessage.success(t('data.uploaded'))
}

function loadMap(row) {
  if (canLoadMap(row.ext)) openMap(row)
}

function download(row) {
  const blob = new Blob([`${row.fileName}\n${t('data.session')}: ${row.sessionId}\n`], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = row.fileName
  link.click()
  URL.revokeObjectURL(url)
}

function remove(row) {
  const list = scope.value === 'personal' ? personal : publicRecords
  list.value = list.value.filter((item) => item.id !== row.id)
  if (preview.value?.id === row.id) closeMap()
}
</script>

<template>
  <div class="page">
    <header class="heading">
      <h1>{{ t('nav.data') }}</h1>
      <p>{{ scope === 'personal' ? t('data.personalHint') : t('data.publicHint') }}</p>
    </header>

    <el-card class="board" shadow="never">
      <div class="toolbar">
        <ScopeBar :active="scope" @change="scope = $event" />
        <button type="button" class="upload" @click="upload">{{ t('data.upload') }}</button>
        <input
          ref="picker"
          type="file"
          hidden
          accept=".tif,.tiff,.shp,.png,.zip,.csv,.geojson,.json,.txt,.pdf"
          @change="onPick"
        />
      </div>
      <FilterBar
        :search-by="searchBy"
        :keyword="keyword"
        :ext="ext"
        :order="order"
        @update:search-by="searchBy = $event"
        @update:keyword="keyword = $event"
        @update:ext="ext = $event"
        @update:order="order = $event"
      />
      <FileList
        :rows="paged"
        :status="scope === 'personal' ? t('data.personalStatus') : t('data.published')"
        @load="loadMap"
        @download="download"
        @remove="remove"
      />
      <DataPager :page="page" :total="filtered.length" :page-size="pageSize" @update:page="page = $event" />
    </el-card>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: calc(100vh - 104px);
  min-height: 420px;
  overflow: hidden;
}

.board {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.board :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.heading h1 {
  margin: 0;
  font-size: 22px;
}

.heading p {
  margin: 8px 0 0;
  color: rgba(214, 245, 228, 0.72);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.upload {
  height: 36px;
  margin-left: auto;
  padding: 0 18px;
  border: none;
  border-radius: 8px;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 800px) {
  .upload {
    margin-left: 0;
  }
}
</style>
