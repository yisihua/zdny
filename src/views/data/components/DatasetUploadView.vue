<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { fetchDatasetFiles, importDatasetFiles } from '@/api/dataset'
import { t } from '@/i18n'
import '@/styles/system-dialog.css'

const props = defineProps({
  dataset: { type: Object, required: true },
})

const emit = defineEmits(['back', 'uploaded'])

const picker = ref(null)
const submitting = ref(false)
const files = ref([])
const progress = ref(0)
const phase = ref('idle')

const phaseText = computed(() => {
  if (phase.value === 'upload') return t('data.uploadProgress', { n: progress.value })
  if (phase.value === 'processing') return t('data.uploadProcessing')
  if (phase.value === 'done') return t('data.uploadDone')
  return ''
})

function resetProgress() {
  progress.value = 0
  phase.value = 'idle'
}

function reset() {
  files.value = []
  resetProgress()
  if (picker.value) picker.value.value = ''
}

function onPick(event) {
  const next = Array.from(event.target.files || [])
  event.target.value = ''
  if (!next.length) return
  const map = new Map(files.value.map((file) => [file.webkitRelativePath || file.name, file]))
  next.forEach((file) => map.set(file.webkitRelativePath || file.name, file))
  files.value = Array.from(map.values())
}

function removeFile(index) {
  if (submitting.value) return
  files.value = files.value.filter((_, i) => i !== index)
}

function normalizePage(pageData) {
  if (!pageData) return []
  if (Array.isArray(pageData)) return pageData
  return pageData.records || pageData.list || pageData.content || []
}

async function buildExpectedRevisions(datasetId, fileList) {
  const existing = normalizePage(await fetchDatasetFiles(datasetId, { page: 1, pageSize: 100 }))
  const byPath = new Map()
  existing.forEach((item) => {
    if (item.relativePath) byPath.set(item.relativePath, item)
    if (item.originalName) byPath.set(item.originalName, item)
  })
  const revisions = {}
  fileList.forEach((file) => {
    const path = file.webkitRelativePath || file.name
    const hit = byPath.get(path) || byPath.get(file.name)
    if (hit?.id != null) revisions[String(hit.id)] = Number(hit.revision) || 0
  })
  return revisions
}

function onProgress(event) {
  phase.value = event.phase || 'upload'
  progress.value = Number(event.percent) || 0
}

async function uploadWithConfirm(datasetId, fileList) {
  try {
    return await importDatasetFiles(datasetId, {
      files: fileList,
      overwrite: false,
      expectedRevisions: {},
      onProgress,
    })
  } catch (error) {
    if (error?.code !== 409) throw error
    await ElMessageBox.confirm(error.message || t('data.overwriteConfirm'), t('data.overwriteTitle'), {
      type: 'warning',
      confirmButtonText: t('data.overwrite'),
      cancelButtonText: t('system.cancel'),
      customClass: 'system-message-box',
    })
    const expectedRevisions = await buildExpectedRevisions(datasetId, fileList)
    resetProgress()
    return importDatasetFiles(datasetId, {
      files: fileList,
      overwrite: true,
      expectedRevisions,
      onProgress,
    })
  }
}

async function submit() {
  if (submitting.value || !props.dataset?.id) return
  if (!files.value.length) {
    ElMessage.warning(t('data.filesRequired'))
    return
  }
  submitting.value = true
  resetProgress()
  phase.value = 'upload'
  try {
    const uploaded = await uploadWithConfirm(props.dataset.id, files.value)
    const count = Array.isArray(uploaded) ? uploaded.length : files.value.length
    phase.value = 'done'
    progress.value = 100
    ElMessage.success(t('data.appendSuccess', { n: count }))
    emit('uploaded', { dataset: props.dataset, files: uploaded })
    reset()
  } catch (error) {
    resetProgress()
    if (error === 'cancel' || error?.toString?.() === 'cancel' || error?.name === 'AbortError') return
    if (error?.message) ElMessage.error(error.message)
  } finally {
    submitting.value = false
  }
}

watch(
  () => props.dataset?.id,
  () => reset(),
)
</script>

<template>
  <div class="upload-view" :class="{ 'is-uploading': submitting }">
    <header class="top">
      <button type="button" class="back" :disabled="submitting" @click="$emit('back')">
        <el-icon><ArrowLeft /></el-icon>{{ t('data.back') }}
      </button>
      <div class="title">
        <h2>{{ t('data.appendUploadTitle') }}</h2>
        <p>{{ dataset?.name }} · {{ dataset?.dataTypeLabel || dataset?.dataType || '' }}</p>
      </div>
    </header>

    <div class="drop" :class="{ disabled: submitting }" @click="!submitting && picker?.click()">
      <button type="button" class="pick" :disabled="submitting" @click.stop="!submitting && picker?.click()">
        {{ t('data.chooseFiles') }}
      </button>
      <p>{{ files.length ? t('data.fileCount', { n: files.length }) : t('data.filesHint') }}</p>
      <input
        ref="picker"
        type="file"
        multiple
        hidden
        accept=".tif,.tiff,.jpg,.jpeg,.png,.shp,.zip,.csv,.json,.xlsx,.txt,.pdf,.npy,.npz"
        @change="onPick"
      />
    </div>

    <ul v-if="files.length" class="file-list">
      <li v-for="(file, index) in files" :key="`${file.name}-${index}`">
        <span>{{ file.webkitRelativePath || file.name }}</span>
        <em>{{ Math.max(1, Math.round(file.size / 1024)) }} KB</em>
        <button type="button" :disabled="submitting" @click="removeFile(index)">{{ t('data.removeFile') }}</button>
      </li>
    </ul>

    <section v-if="submitting" class="progress-card">
      <div class="progress-head">
        <div class="spinner" aria-hidden="true">
          <i /><i /><i />
        </div>
        <div>
          <strong>{{ t('data.uploading') }}</strong>
          <p>{{ phaseText }}</p>
        </div>
        <em>{{ progress }}%</em>
      </div>
      <div class="bar" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100">
        <i :style="{ width: `${progress}%` }" />
      </div>
    </section>

    <footer class="footer">
      <button type="button" class="ghost" :disabled="submitting" @click="$emit('back')">{{ t('system.cancel') }}</button>
      <button type="button" class="primary" :disabled="submitting || !files.length" @click="submit">
        <span v-if="submitting" class="btn-spin" aria-hidden="true"></span>
        {{ submitting ? t('data.uploading') : t('data.submitUpload') }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.upload-view {
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

.back:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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

.drop {
  display: grid;
  gap: 8px;
  justify-items: center;
  padding: 28px 16px;
  border: 1px dashed rgba(140, 220, 175, 0.36);
  border-radius: 12px;
  background: rgba(4, 28, 22, 0.45);
  cursor: pointer;
}

.drop:hover:not(.disabled) {
  border-color: rgba(140, 240, 174, 0.7);
  background: rgba(8, 40, 30, 0.55);
}

.drop.disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.pick {
  height: 34px;
  padding: 0 16px;
  border: none;
  border-radius: 8px;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.pick:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.drop p {
  margin: 0;
  color: rgba(214, 245, 228, 0.68);
  font-size: 13px;
}

.file-list {
  display: grid;
  gap: 6px;
  max-height: 30vh;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.file-list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid rgba(140, 220, 175, 0.16);
  border-radius: 8px;
  color: #edfff6;
  background: rgba(3, 18, 14, 0.5);
  font-size: 12px;
}

.file-list span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-list em {
  color: rgba(214, 245, 228, 0.55);
  font-style: normal;
}

.file-list button {
  padding: 0;
  border: 0;
  color: #8dffc8;
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.file-list button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.progress-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(140, 220, 175, 0.28);
  border-radius: 12px;
  background: rgba(8, 40, 30, 0.55);
}

.progress-head {
  display: flex;
  gap: 12px;
  align-items: center;
}

.progress-head strong {
  display: block;
  color: #f3fff8;
  font-size: 14px;
}

.progress-head p {
  margin: 4px 0 0;
  color: rgba(214, 245, 228, 0.68);
  font-size: 12px;
}

.progress-head em {
  margin-left: auto;
  color: #8dffc8;
  font-style: normal;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.spinner {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.spinner i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #8cf0ae;
  opacity: 0.35;
  animation: upload-bounce 1s infinite ease-in-out;
}

.spinner i:nth-child(2) {
  animation-delay: 0.15s;
}

.spinner i:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes upload-bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.28;
  }
  40% {
    transform: translateY(-5px);
    opacity: 1;
  }
}

.bar {
  overflow: hidden;
  height: 8px;
  border-radius: 999px;
  background: rgba(140, 220, 175, 0.16);
}

.bar > i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #5ec8e8, #8cf0ae 45%, #2fbf6a);
  background-size: 200% 100%;
  animation: upload-shine 1.2s linear infinite;
  transition: width 0.2s ease;
}

@keyframes upload-shine {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
}

.ghost,
.primary {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  font: inherit;
  cursor: pointer;
}

.ghost {
  border: 1px solid rgba(140, 220, 175, 0.32);
  color: #f3fff8;
  background: rgba(3, 18, 14, 0.55);
}

.primary {
  border: none;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
}

.primary:disabled,
.ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-spin {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(4, 33, 23, 0.25);
  border-top-color: #042117;
  border-radius: 50%;
  animation: upload-spin 0.7s linear infinite;
}

@keyframes upload-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
