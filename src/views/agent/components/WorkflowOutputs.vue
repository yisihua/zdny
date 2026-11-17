<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, View } from '@element-plus/icons-vue'
import {
  TABLE_PREVIEW_LIMIT,
  canPreviewFile,
  downloadDatasetFile,
  fileExt,
  previewDatasetFile,
} from '@/api/dataset'
import { toProxiedArtifactUrl } from '@/api/workflowOutputs'
import { useMapPanel } from '@/components/map/context.js'
import { t } from '@/i18n'

function isGeoJsonFile(file) {
  const ext = fileExt(file)
  if (ext === 'geojson') return true
  // 名称或路径带 .geojson 时也按矢量预览（避免入库后 ext 异常）
  const name = String(file?.originalName || file?.name || file?.relativePath || '').toLowerCase()
  return name.endsWith('.geojson')
}

async function fetchJsonWithAuth(url) {
  const raw = String(url || '').trim()
  if (!raw) throw new Error('缺少预览地址')
  const token = localStorage.getItem('token')
  const response = await fetch(raw, {
    headers: raw.startsWith('/api/') && token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!response.ok) throw new Error(`预览失败（${response.status}）`)
  return response.json()
}

const props = defineProps({
  files: { type: Array, default: () => [] },
})

const { openMap } = useMapPanel()

const previewingId = ref('')
const downloadingId = ref('')
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

function hasFileUrl(file) {
  return Boolean(file?.url || file?.sourceUrl || file?.fileUrl || file?.previewUrl)
}

function fileWmsUrl(file) {
  if (file?.wmsUrl) return String(file.wmsUrl)
  const server = file?.serverFile
  if (server?.wmsUrl) return String(server.wmsUrl)
  const meta = file?.metadata || server?.metadata
  if (meta && typeof meta === 'object' && meta.wmsUrl) return String(meta.wmsUrl)
  return ''
}

function canOpenOnMap(file) {
  return Boolean(fileWmsUrl(file) || file?.mapUrl || file?.serverFile?.mapUrl)
}

function isRasterMapExt(file) {
  return ['tif', 'tiff', 'geotiff'].includes(fileExt(file))
}

function fileBadge(file) {
  const ext = fileExt(file)
  if (ext) return ext.toUpperCase()
  return hasFileUrl(file) ? 'FILE' : 'VAL'
}

/** 预览/下载统一走代理地址；数据集鉴权地址保持原样 */
function withProxiedFetchUrl(file) {
  const datasetUrl = file?.previewUrl || file?.fileUrl
  if (datasetUrl && String(datasetUrl).startsWith('/api/')) return file
  const raw = file?.sourceUrl || file?.url || datasetUrl || ''
  const proxied = toProxiedArtifactUrl(raw)
  if (!proxied) return file
  return {
    ...file,
    url: proxied,
    sourceUrl: proxied,
    previewUrl: file.previewUrl && String(file.previewUrl).startsWith('/api/') ? file.previewUrl : proxied,
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

/** GeoJSON：保持原模式，拉取 JSON 后矢量绘制到地图（不走 WMS） */
async function previewGeoJsonOnMap(file) {
  const artifactUrl = toProxiedArtifactUrl(file.sourceUrl || file.url || '')
  const datasetUrl = [file.previewUrl, file.fileUrl, file.serverFile?.previewUrl, file.serverFile?.fileUrl]
    .map((item) => String(item || '').trim())
    .find((item) => item.startsWith('/api/'))
  const candidates = [artifactUrl, datasetUrl].filter(Boolean)
  if (!candidates.length) throw new Error('缺少预览地址')

  let data = null
  let lastError = null
  for (const url of candidates) {
    try {
      data = await fetchJsonWithAuth(url)
      break
    } catch (error) {
      lastError = error
    }
  }
  if (!data) throw lastError || new Error('预览失败')

  openMap({
    fileName: file.originalName || file.name || 'geojson',
    ext: 'GeoJSON',
    geojson: data,
    mapUrl: '',
    wmsUrl: '',
  })
}

/** TIF 等栅格：与数据管理「加载到地图」相同，走 GeoServer WMS / mapUrl */
function previewRasterOnMap(file) {
  if (!canOpenOnMap(file)) {
    ElMessage.warning(t('workflow.previewUnsupported'))
    return
  }
  openMap({
    fileName: file.originalName || file.name || String(file.id),
    ext: String(file.ext || file.serverFile?.ext || 'TIF').toUpperCase(),
    mapUrl: file.mapUrl || file.serverFile?.mapUrl || '',
    wmsUrl: fileWmsUrl(file),
    geojson: null,
  })
}

async function onPreview(file) {
  if (previewingId.value || !hasFileUrl(file)) return
  previewingId.value = String(file.id || file.name)
  try {
    closePreview()
    const ext = fileExt(file)
    // geojson 始终矢量上图；tif 才走 WMS
    if (isGeoJsonFile(file)) {
      await previewGeoJsonOnMap(file)
      return
    }
    if (isRasterMapExt(file)) {
      previewRasterOnMap(file)
      return
    }
    if (!canPreviewFile(file) && !['json'].includes(ext)) {
      ElMessage.warning(t('workflow.previewUnsupported'))
      return
    }
    const result = await previewDatasetFile(withProxiedFetchUrl(file))
    const rows = result.rows || []
    preview.value = {
      open: true,
      kind: result.kind || '',
      url: result.objectUrl || '',
      name: file.originalName || file.name || String(file.id),
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

async function onDownload(file) {
  if (downloadingId.value || !hasFileUrl(file)) return
  downloadingId.value = String(file.id || file.name)
  try {
    if (file.fileUrl && String(file.fileUrl).startsWith('/api/')) {
      await downloadDatasetFile(file)
      return
    }
    const proxied = withProxiedFetchUrl(file)
    const url = proxied.previewUrl || proxied.sourceUrl || proxied.url
    const response = await fetch(url)
    if (!response.ok) throw new Error(`下载失败（${response.status}）`)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = file.originalName || file.name || 'download'
    link.click()
    URL.revokeObjectURL(objectUrl)
  } catch (error) {
    if (error?.message) ElMessage.error(error.message)
  } finally {
    downloadingId.value = ''
  }
}

onBeforeUnmount(closePreview)
</script>

<template>
  <div class="outputs">
    <h3>{{ t('workflow.outputsTitle') }}</h3>
    <ul v-if="files.length" class="files">
      <li v-for="file in files" :key="file.id || file.name">
        <div class="meta">
          <em>{{ fileBadge(file) }}</em>
          <div class="text">
            <strong>{{ file.originalName || file.name }}</strong>
            <small v-if="file.nodeName">{{ t('workflow.outputFrom', { name: file.nodeName }) }}</small>
            <small
              v-if="!hasFileUrl(file) && (file.value || file.display)"
              class="value"
              :title="file.value || file.display"
            >
              {{ file.value || file.display }}
            </small>
          </div>
        </div>
        <div v-if="hasFileUrl(file)" class="ops">
          <button
            type="button"
            class="preview"
            :disabled="previewingId === String(file.id || file.name)"
            @click="onPreview(file)"
          >
            <el-icon><View /></el-icon>{{ t('data.preview') }}
          </button>
          <button
            type="button"
            class="download"
            :disabled="downloadingId === String(file.id || file.name)"
            @click="onDownload(file)"
          >
            <el-icon><Download /></el-icon>{{ t('data.download') }}
          </button>
        </div>
      </li>
    </ul>
    <p v-else class="empty">{{ t('workflow.outputsEmpty') }}</p>

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
.outputs {
  display: grid;
  gap: 8px;
}

h3,
p {
  margin: 0;
}

h3 {
  color: #f3fff8;
  font-size: 15px;
}

.files {
  display: grid;
  gap: 8px;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}

.files li {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border: 1px solid rgba(140, 220, 175, 0.16);
  border-radius: 10px;
  background: rgba(8, 36, 28, 0.55);
}

.meta {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.meta em {
  flex: 0 0 auto;
  min-width: 52px;
  padding: 2px 6px;
  border-radius: 6px;
  color: #8cf0ae;
  background: rgba(47, 191, 106, 0.14);
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-align: center;
}

.text {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.text strong {
  overflow: hidden;
  color: #edfff6;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text small {
  overflow: hidden;
  color: rgba(214, 245, 228, 0.55);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text .value {
  color: rgba(214, 245, 228, 0.78);
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.ops {
  display: flex;
  flex: 0 0 auto;
  gap: 6px;
}

.preview,
.download {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.preview {
  border: 1px solid transparent;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
}

.download {
  border: 1px solid rgba(140, 220, 175, 0.28);
  color: #d8ffe9;
  background: transparent;
}

.preview:disabled,
.download:disabled {
  opacity: 0.55;
  cursor: wait;
}

.empty {
  color: rgba(214, 245, 228, 0.55);
  font-size: 13px;
}

.lightbox {
  position: fixed;
  inset: 0;
  z-index: 40;
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
</style>
