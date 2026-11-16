<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ScopeBar from './components/ScopeBar.vue'
import FilterBar from './components/FilterBar.vue'
import DatasetList from './components/DatasetList.vue'
import DatasetCreateDialog from './components/DatasetCreateDialog.vue'
import DatasetFilesView from './components/DatasetFilesView.vue'
import DatasetUploadView from './components/DatasetUploadView.vue'
import DataPager from './components/DataPager.vue'
import {
  DATASET_TYPES,
  deleteDataset,
  fetchDatasets,
} from '@/api/dataset'
import { fetchProjects } from '@/api/project'
import { t } from '@/i18n'
import '@/styles/system-dialog.css'

const pageSize = 10
const scope = ref('personal')
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const createOpen = ref(false)
/** list | files | upload */
const view = ref('list')
const uploadFrom = ref('list')
const activeDataset = ref(null)
const filesViewRef = ref(null)
const projects = ref([])
const datasets = ref([])
const currentUserId = computed(() => localStorage.getItem('userId') || '')

const filters = reactive({
  projectId: '',
  year: '',
  location: '',
  collectionDate: '',
  sensor: '',
})

const projectMap = computed(() => {
  const map = new Map()
  projects.value.forEach((item) => map.set(String(item.id), item))
  return map
})

function typeLabel(dataType) {
  const hit = DATASET_TYPES.find((item) => item.value === dataType)
  return hit ? t(hit.labelKey) : dataType
}

function normalizePage(pageData) {
  if (!pageData) return { records: [], total: 0 }
  if (Array.isArray(pageData)) return { records: pageData, total: pageData.length }
  const records = pageData.records || pageData.list || pageData.content || []
  const totalCount = pageData.total ?? pageData.totalElements ?? records.length
  return { records, total: Number(totalCount) || 0 }
}

function decorate(row) {
  const project = projectMap.value.get(String(row.projectId))
  const mine = String(row.ownerId || '') === String(currentUserId.value)
  return {
    ...row,
    projectName: project?.name || '',
    location: project?.location || row.location || '',
    dataTypeLabel: typeLabel(row.dataType),
    ownerLabel: mine ? t('data.me') : row.ownerId,
    sharedLabel: mine ? t('data.owned') : t('data.sharedToMe'),
    canUpload: mine,
    canDelete: mine,
    canDownload: false,
  }
}

const rows = computed(() => {
  const list = datasets.value.map(decorate)
  if (scope.value === 'personal') {
    return list.filter((item) => String(item.ownerId || '') === String(currentUserId.value))
  }
  if (scope.value === 'public') {
    return list.filter((item) => String(item.ownerId || '') !== String(currentUserId.value))
  }
  return list
})

const pageHint = computed(() => {
  if (view.value === 'files') return t('data.filesHintPage')
  if (view.value === 'upload') return t('data.uploadHintPage')
  return scope.value === 'personal' ? t('data.personalHint') : t('data.publicHint')
})

async function loadProjects() {
  try {
    const pageData = await fetchProjects({ page: 1, pageSize: 100 })
    projects.value = normalizePage(pageData).records
  } catch {
    projects.value = []
  }
}

async function loadDatasets() {
  loading.value = true
  try {
    const year = String(filters.year || '').trim()
    const pageData = await fetchDatasets({
      projectId: filters.projectId || undefined,
      year: year ? Number(year) : undefined,
      location: filters.location || undefined,
      collectionDate: filters.collectionDate || undefined,
      sensor: filters.sensor || undefined,
      page: page.value,
      pageSize,
    })
    const normalized = normalizePage(pageData)
    datasets.value = normalized.records
    total.value = normalized.total
  } catch {
    datasets.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  loadDatasets()
}

function resetFilters() {
  filters.projectId = ''
  filters.year = ''
  filters.location = ''
  filters.collectionDate = ''
  filters.sensor = ''
  page.value = 1
  loadDatasets()
}

function openFiles(row) {
  activeDataset.value = row
  view.value = 'files'
}

function startUpload(row) {
  activeDataset.value = row
  uploadFrom.value = view.value === 'files' ? 'files' : 'list'
  view.value = 'upload'
}

function backToList() {
  view.value = 'list'
  activeDataset.value = null
  uploadFrom.value = 'list'
}

function backFromUpload() {
  if (uploadFrom.value === 'files' && activeDataset.value) {
    view.value = 'files'
    return
  }
  backToList()
}

function onUploaded() {
  view.value = 'files'
  uploadFrom.value = 'files'
  filesViewRef.value?.reload?.()
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(t('data.deleteConfirm', { name: row.name }), t('data.remove'), {
      type: 'warning',
      customClass: 'system-message-box',
    })
    await deleteDataset(row.id)
    ElMessage.success(t('data.deleted'))
    loadDatasets()
  } catch {
    // cancelled
  }
}

watch(scope, () => {
  page.value = 1
})

watch(page, () => {
  if (view.value === 'list') loadDatasets()
})

onMounted(async () => {
  await loadProjects()
  await loadDatasets()
})
</script>

<template>
  <div class="page">
    <header class="heading">
      <h1>{{ t('nav.data') }}</h1>
      <p>{{ pageHint }}</p>
    </header>

    <el-card class="board" shadow="never">
      <template v-if="view === 'list'">
        <div class="toolbar">
          <ScopeBar :active="scope" @change="scope = $event" />
          <button type="button" class="upload" @click="createOpen = true">{{ t('data.create') }}</button>
        </div>

        <FilterBar
          v-model:project-id="filters.projectId"
          v-model:year="filters.year"
          v-model:location="filters.location"
          v-model:collection-date="filters.collectionDate"
          v-model:sensor="filters.sensor"
          :projects="projects"
          @search="search"
          @reset="resetFilters"
        />

        <DatasetList
          :rows="rows"
          :loading="loading"
          @open="openFiles"
          @upload="startUpload"
          @remove="remove"
        />
        <DataPager :page="page" :total="total" :page-size="pageSize" @update:page="page = $event" />
      </template>

      <DatasetFilesView
        v-else-if="view === 'files' && activeDataset"
        ref="filesViewRef"
        :dataset="activeDataset"
        @back="backToList"
        @upload="startUpload"
      />

      <DatasetUploadView
        v-else-if="view === 'upload' && activeDataset"
        :dataset="activeDataset"
        @back="backFromUpload"
        @uploaded="onUploaded"
      />
    </el-card>

    <DatasetCreateDialog v-model="createOpen" @created="search" />
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
</style>
