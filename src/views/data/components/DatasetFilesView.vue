<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Delete, Download, MapLocation, Upload, View } from '@element-plus/icons-vue'
import DataPager from './DataPager.vue'
import {
  TABLE_PREVIEW_LIMIT,
  canPreviewFile,
  deleteDatasetFile,
  downloadDatasetFile,
  fetchDatasetFiles,
  previewDatasetFile,
} from '@/api/dataset'
import { useMapPanel } from '@/components/map/context.js'
import { t } from '@/i18n'
import '@/styles/system-dialog.css'

const { openMap } = useMapPanel()

const props = defineProps({
  dataset: { type: Object, required: true },
})

const emit = defineEmits(['back', 'upload'])

const pageSize = 10
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const downloadingId = ref('')
const previewingId = ref('')
const files = ref([])
const preview = ref({
  open: false,
  kind: '',
  url: '',
  name: '',
  text: '',
  rows: [],
  truncated: false,
  totalRows: 0,
  sheetName: '',
  showAll: false,
})

const previewTableRows = computed(() => {
  const rows = preview.value.rows || []
  if (preview.value.showAll || !preview.value.truncated) return rows
  return rows.slice(0, TABLE_PREVIEW_LIMIT)
})

const canManage = computed(() => {
  const me = String(localStorage.getItem('userId') || '')
  return me && String(props.dataset?.ownerId || '') === me
})

function normalizePage(pageData) {
  if (!pageData) return { records: [], total: 0 }
  if (Array.isArray(pageData)) return { records: pageData, total: pageData.length }
  const records = pageData.records || pageData.list || pageData.content || []
  const totalCount = pageData.total ?? pageData.totalElements ?? records.length
  return { records, total: Number(totalCount) || 0 }
}

function formatSize(size) {
  const n = Number(size)
  if (!Number.isFinite(n) || n < 0) return '-'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').replace(/\.\d+.*$/, '')
}

function publishLabel(row) {
  const status = row.publishStatus
  if (!status || status === 'SKIPPED') return ''
  if (status === 'SUCCESS') return t('data.publishOk')
  if (status === 'PENDING') return t('data.publishPending')
  if (status === 'FAILED') return t('data.publishFail')
  return status
}

function fileWmsUrl(row) {
  if (row?.wmsUrl) return String(row.wmsUrl)
  const meta = row?.metadata
  if (meta && typeof meta === 'object' && meta.wmsUrl) return String(meta.wmsUrl)
  return ''
}

function hasMapUrl(row) {
  return Boolean(fileWmsUrl(row) || row?.mapUrl)
}

function onLoadMap(row) {
  if (!hasMapUrl(row)) return
  openMap({
    fileName: row.originalName || row.relativePath || String(row.id),
    ext: String(row.ext || 'TIF').toUpperCase(),
    mapUrl: row.mapUrl || '',
    wmsUrl: fileWmsUrl(row),
  })
}

async function loadFiles() {
  if (!props.dataset?.id) {
    files.value = []
    total.value = 0
    return
  }
  loading.value = true
  try {
    const pageData = await fetchDatasetFiles(props.dataset.id, {
      page: page.value,
      pageSize,
    })
    const normalized = normalizePage(pageData)
    files.value = normalized.records
    total.value = normalized.total
  } catch {
    files.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function closePreview() {
  if (preview.value.url) URL.revokeObjectURL(preview.value.url)
  preview.value = {
    open: false,
    kind: '',
    url: '',
    name: '',
    text: '',
    rows: [],
    truncated: false,
    totalRows: 0,
    sheetName: '',
    showAll: false,
  }
}

function togglePreviewAll() {
  preview.value.showAll = !preview.value.showAll
}

async function onPreview(row) {
  if (previewingId.value || !canPreviewFile(row)) return
  previewingId.value = String(row.id)
  try {
    closePreview()
    const result = await previewDatasetFile(row)
    const rows = result.rows || []
    preview.value = {
      open: true,
      kind: result.kind || '',
      url: result.objectUrl || '',
      name: row.originalName || row.relativePath || String(row.id),
      text: result.text || '',
      rows,
      truncated: Boolean(result.truncated) || rows.length > TABLE_PREVIEW_LIMIT,
      totalRows: result.totalRows || rows.length,
      sheetName: result.sheetName || '',
      showAll: false,
    }
  } catch (error) {
    if (error?.message) ElMessage.error(error.message)
  } finally {
    previewingId.value = ''
  }
}

async function onDownload(row) {
  if (downloadingId.value) return
  downloadingId.value = String(row.id)
  try {
    await downloadDatasetFile(row)
  } catch (error) {
    if (error?.message) ElMessage.error(error.message)
  } finally {
    downloadingId.value = ''
  }
}

async function onRemove(row) {
  try {
    await ElMessageBox.confirm(
      t('data.deleteFileConfirm', { name: row.originalName || row.relativePath || row.id }),
      t('data.remove'),
      {
        type: 'warning',
        customClass: 'system-message-box',
      },
    )
    await deleteDatasetFile(row.id)
    ElMessage.success(t('data.fileDeleted'))
    if (files.value.length <= 1 && page.value > 1) page.value -= 1
    else await loadFiles()
  } catch {
    // cancelled
  }
}

watch(
  () => props.dataset?.id,
  () => {
    page.value = 1
    loadFiles()
  },
  { immediate: true },
)

watch(page, () => {
  loadFiles()
})

onBeforeUnmount(closePreview)

defineExpose({ reload: loadFiles })
</script>

<template>
  <div class="files-view">
    <header class="top">
      <button type="button" class="back" @click="$emit('back')">
        <el-icon><ArrowLeft /></el-icon>{{ t('data.back') }}
      </button>
      <div class="title">
        <h2>{{ dataset?.name || t('data.filesTitle') }}</h2>
        <p>
          {{ dataset?.dataTypeLabel || dataset?.dataType || '-' }}
          · {{ t('data.fileTotal', { n: total }) }}
        </p>
      </div>
      <button v-if="canManage" type="button" class="upload" @click="$emit('upload', dataset)">
        <el-icon><Upload /></el-icon>{{ t('data.appendUpload') }}
      </button>
    </header>

    <div class="scroll">
      <p v-if="loading" class="empty">{{ t('system.loading') }}</p>
      <p v-else-if="!files.length" class="empty">{{ t('data.noFiles') }}</p>
      <ul v-else class="list">
        <li v-for="row in files" :key="row.id">
          <div class="main">
            <strong>{{ row.originalName || row.relativePath || row.id }}</strong>
            <p>
              {{ row.relativePath || '-' }}
              · {{ (row.ext || '-').toUpperCase() }}
              · {{ formatSize(row.fileSize) }}
              · rev {{ row.revision ?? 0 }}
              · {{ formatTime(row.updatedAt || row.createdAt) }}
            </p>
            <p v-if="publishLabel(row)" class="sub">
              {{ publishLabel(row) }}
              <template v-if="row.publishMessage"> · {{ row.publishMessage }}</template>
            </p>
          </div>
          <div class="ops">
            <button
              v-if="hasMapUrl(row)"
              type="button"
              class="map-btn"
              @click="onLoadMap(row)"
            >
              <el-icon><MapLocation /></el-icon>{{ t('data.load') }}
            </button>
            <button
              v-if="canPreviewFile(row)"
              type="button"
              :disabled="previewingId === String(row.id)"
              @click="onPreview(row)"
            >
              <el-icon><View /></el-icon>{{ t('data.preview') }}
            </button>
            <button type="button" :disabled="downloadingId === String(row.id)" @click="onDownload(row)">
              <el-icon><Download /></el-icon>{{ t('data.download') }}
            </button>
            <button v-if="canManage" type="button" @click="onRemove(row)">
              <el-icon><Delete /></el-icon>{{ t('data.remove') }}
            </button>
          </div>
        </li>
      </ul>
    </div>

    <DataPager :page="page" :total="total" :page-size="pageSize" @update:page="page = $event" />

    <Teleport to="body">
      <div v-if="preview.open" class="lightbox" @click.self="closePreview">
        <div class="lightbox-panel" :class="{ wide: preview.kind === 'table' || preview.kind === 'pdf' }">
          <header>
            <strong>{{ preview.name }}</strong>
            <button type="button" @click="closePreview">{{ t('data.closePreview') }}</button>
          </header>

          <img v-if="preview.kind === 'image'" :src="preview.url" :alt="preview.name" />

          <iframe
            v-else-if="preview.kind === 'pdf'"
            class="pdf-frame"
            :src="preview.url"
            :title="preview.name"
          />

          <div v-else-if="preview.kind === 'table'" class="table-wrap">
            <div class="table-meta">
              <p v-if="preview.sheetName" class="tip">{{ t('data.previewSheet', { name: preview.sheetName }) }}</p>
              <p v-if="preview.truncated && !preview.showAll" class="tip">
                {{ t('data.previewTruncated', { total: preview.totalRows }) }}
                <button type="button" class="link-btn" @click="togglePreviewAll">{{ t('data.previewShowAll') }}</button>
              </p>
              <p v-else-if="preview.truncated && preview.showAll" class="tip">
                {{ t('data.previewShowingAll', { total: preview.totalRows }) }}
                <button type="button" class="link-btn" @click="togglePreviewAll">{{ t('data.previewShowLess') }}</button>
              </p>
            </div>
            <table>
              <tbody>
                <tr v-for="(row, rowIndex) in previewTableRows" :key="rowIndex" :class="{ head: rowIndex === 0 }">
                  <td v-for="(cell, cellIndex) in row" :key="`${rowIndex}-${cellIndex}`">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <pre v-else-if="preview.kind === 'json' || preview.kind === 'text'" class="text-preview">{{ preview.text }}</pre>
          <p v-else class="tip">{{ t('data.previewEmpty') }}</p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.files-view {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.top {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.back {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(140, 220, 175, 0.32);
  border-radius: 8px;
  color: #e7fff4;
  background: rgba(3, 18, 14, 0.55);
  font: inherit;
  cursor: pointer;
}

.back:hover {
  border-color: rgba(140, 220, 175, 0.55);
  background: rgba(4, 26, 20, 0.75);
}

.title {
  min-width: 0;
  flex: 1;
}

.title h2 {
  margin: 0;
  color: #f3fff8;
  font-size: 18px;
}

.title p {
  margin: 4px 0 0;
  color: rgba(214, 245, 228, 0.62);
  font-size: 12px;
}

.upload {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  height: 34px;
  margin-left: auto;
  padding: 0 14px;
  border: none;
  border-radius: 8px;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0 8px 0 0;
  list-style: none;
}

li {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid rgba(140, 220, 175, 0.18);
  border-radius: 10px;
  background: rgba(3, 18, 14, 0.45);
}

.main {
  min-width: 0;
  flex: 1;
}

.main strong {
  display: block;
  color: #f3fff8;
  font-size: 14px;
}

.main p,
.empty {
  margin: 5px 0 0;
  color: rgba(214, 245, 228, 0.62);
  font-size: 12px;
  word-break: break-all;
}

.sub {
  color: rgba(214, 245, 228, 0.48) !important;
}

.lightbox {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(2, 12, 9, 0.78);
  backdrop-filter: blur(4px);
}

.lightbox-panel {
  display: grid;
  gap: 10px;
  width: min(920px, 100%);
  max-height: min(86vh, 900px);
  padding: 12px;
  overflow: auto;
  border: 1px solid rgba(140, 220, 175, 0.28);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(12, 48, 36, 0.96), rgba(5, 24, 18, 0.98));
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.42);
}

.lightbox-panel.wide {
  width: min(1100px, 100%);
}

.lightbox-panel header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.lightbox-panel strong {
  min-width: 0;
  overflow: hidden;
  color: #f3fff8;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lightbox-panel header button {
  flex: 0 0 auto;
  height: 30px;
  padding: 0 12px;
  border: 1px solid rgba(140, 220, 175, 0.32);
  border-radius: 8px;
  color: #e7fff4;
  background: rgba(3, 18, 14, 0.55);
  font: inherit;
  cursor: pointer;
}

.lightbox-panel img {
  display: block;
  width: 100%;
  max-height: calc(86vh - 80px);
  object-fit: contain;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.28);
}

.pdf-frame {
  display: block;
  width: 100%;
  height: calc(86vh - 90px);
  min-height: 480px;
  border: 1px solid rgba(140, 220, 175, 0.18);
  border-radius: 8px;
  background: #111;
}

.table-wrap {
  overflow: auto;
  max-height: calc(86vh - 90px);
  border: 1px solid rgba(140, 220, 175, 0.18);
  border-radius: 8px;
}

.table-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 8px 10px;
  background: rgba(8, 40, 30, 0.96);
}

.link-btn {
  margin-left: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #7be3b0;
  font-size: 12px;
  cursor: pointer;
}

.link-btn:hover {
  text-decoration: underline;
}

.table-wrap table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  color: #edfff6;
  font-size: 12px;
}

.table-wrap td {
  max-width: 240px;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(140, 220, 175, 0.12);
  border-right: 1px solid rgba(140, 220, 175, 0.08);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-wrap tr.head td {
  position: sticky;
  top: 0;
  color: #8dffc8;
  background: rgba(8, 40, 30, 0.96);
  font-weight: 700;
}

.table-wrap tr:nth-child(even) td {
  background: rgba(3, 18, 14, 0.35);
}

.text-preview {
  margin: 0;
  max-height: calc(86vh - 90px);
  padding: 12px;
  overflow: auto;
  border: 1px solid rgba(140, 220, 175, 0.18);
  border-radius: 8px;
  color: #edfff6;
  background: rgba(3, 18, 14, 0.55);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.tip {
  margin: 0;
  color: rgba(214, 245, 228, 0.68);
  font-size: 12px;
}

.ops {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ops button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid rgba(140, 220, 175, 0.32);
  border-radius: 8px;
  color: #e7fff4;
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.ops button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ops .map-btn {
  border-color: transparent;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
}

@media (max-width: 720px) {
  li {
    align-items: flex-start;
    flex-direction: column;
  }

  .upload {
    margin-left: 0;
  }
}
</style>
