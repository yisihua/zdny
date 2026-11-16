<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import DataPager from '@/views/data/components/DataPager.vue'
import { fetchOperationLogs } from '@/api/audit'
import { fetchUsers } from '@/api/user'
import { t } from '@/i18n'
import '@/styles/system-dialog.css'

const ROW_HEIGHT = 48
const MIN_PAGE_SIZE = 5
const MAX_PAGE_SIZE = 100

const panelRef = ref(null)
const headerRef = ref(null)
const filtersRef = ref(null)
const noteRef = ref(null)
const loading = ref(false)
const logs = ref([])
const userOptions = ref([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const detailVisible = ref(false)
const current = ref(null)
const ready = ref(false)

const filters = reactive({
  actorId: '',
  range: [],
})

let resizeObserver = null
let resizeTimer = 0

const pageTotal = computed(() => {
  const value = Number(total.value)
  return Number.isFinite(value) ? value : 0
})

function calcPageSize() {
  const panel = panelRef.value
  if (!panel) return pageSize.value || 10

  const panelHeight = panel.clientHeight
  const headerHeight = headerRef.value?.offsetHeight || 0
  const filtersHeight = filtersRef.value?.offsetHeight || 0
  const noteHeight = noteRef.value?.offsetHeight || 0
  const pagerHeight = 46
  const tableHeadHeight = 44
  const gaps = 28
  const available = panelHeight - headerHeight - filtersHeight - noteHeight - pagerHeight - tableHeadHeight - gaps
  const rows = Math.floor(available / ROW_HEIGHT)
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, rows))
}

function syncPageSize({ reload = false } = {}) {
  const next = calcPageSize()
  if (next === pageSize.value) return false
  pageSize.value = next
  if (reload) {
    page.value = 1
    loadLogs()
  }
  return true
}

function scheduleFit() {
  window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    syncPageSize({ reload: ready.value })
  }, 120)
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function toIsoOffset(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

function formatTime(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').replace(/\.\d+.*/, '').replace(/([+-]\d{2}:\d{2}|Z)$/, '')
}

function actorText(log) {
  if (!log?.actorId) return t('system.logAnonymous')
  const user = userOptions.value.find((item) => String(item.id) === String(log.actorId))
  return user ? user.username : String(log.actorId)
}

function statusClass(status) {
  const code = Number(status)
  if (code >= 200 && code < 300) return 'ok'
  if (code >= 400 && code < 500) return 'warn'
  if (code >= 500) return 'deny'
  return ''
}

function durationText(value) {
  if (value == null || value === '') return '-'
  const ms = Number(value)
  if (!Number.isFinite(ms)) return String(value)
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)} s`
}

function actionClass(action) {
  const key = String(action || '').toUpperCase()
  if (key === 'POST') return 'method-post'
  if (key === 'PUT' || key === 'PATCH') return 'method-put'
  if (key === 'DELETE') return 'method-delete'
  return 'method-other'
}

async function loadUsers() {
  try {
    const records = []
    let pageNo = 1
    let totalPages = 1
    do {
      const data = await fetchUsers({ page: pageNo, pageSize: 100 })
      const pageRecords = Array.isArray(data?.records) ? data.records : []
      records.push(...pageRecords)
      const totalCount = Number(data?.total)
      const size = Number(data?.pageSize) || 100
      totalPages = Number.isFinite(totalCount) && totalCount > 0 ? Math.ceil(totalCount / size) : 1
      pageNo += 1
    } while (pageNo <= totalPages && pageNo <= 20)
    userOptions.value = records
  } catch {
    userOptions.value = []
  }
}

async function loadLogs() {
  loading.value = true
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value,
    }
    if (filters.actorId) params.actorId = filters.actorId
    const range = Array.isArray(filters.range) ? filters.range : []
    const start = toIsoOffset(range[0])
    const end = toIsoOffset(range[1])
    if (start) params.start = start
    if (end) params.end = end

    const data = await fetchOperationLogs(params)
    logs.value = Array.isArray(data?.records) ? data.records : []
    total.value = data?.total != null ? Number(data.total) : logs.value.length
  } catch {
    logs.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  loadLogs()
}

function resetFilters() {
  filters.actorId = ''
  filters.range = []
  page.value = 1
  loadLogs()
}

function changePage(next) {
  page.value = next
  loadLogs()
}

function openDetail(log) {
  current.value = log
  detailVisible.value = true
}

function closeDetail() {
  detailVisible.value = false
  current.value = null
}

onMounted(async () => {
  await nextTick()
  syncPageSize()
  if (panelRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => scheduleFit())
    resizeObserver.observe(panelRef.value)
  } else {
    window.addEventListener('resize', scheduleFit)
  }
  await Promise.all([loadUsers(), loadLogs()])
  ready.value = true
  await nextTick()
  if (syncPageSize()) await loadLogs()
})

onBeforeUnmount(() => {
  ready.value = false
  window.clearTimeout(resizeTimer)
  resizeObserver?.disconnect?.()
  window.removeEventListener('resize', scheduleFit)
})
</script>

<template>
  <section ref="panelRef" class="panel">
    <header ref="headerRef">
      <div>
        <h1>{{ t('system.log') }}</h1>
        <p class="hint">{{ t('system.logHint') }}</p>
      </div>
    </header>

    <div ref="filtersRef" class="filters">
      <el-select
        v-model="filters.actorId"
        class="filter-select"
        clearable
        filterable
        :placeholder="t('system.logActorPh')"
        popper-class="system-select-dropdown"
      >
        <el-option
          v-for="user in userOptions"
          :key="user.id"
          :label="user.displayName ? `${user.username}（${user.displayName}）` : user.username"
          :value="String(user.id)"
        />
      </el-select>

      <el-date-picker
        v-model="filters.range"
        class="filter-range"
        type="datetimerange"
        unlink-panels
        :start-placeholder="t('system.logStart')"
        :end-placeholder="t('system.logEnd')"
        popper-class="system-date-popper"
      />

      <button type="button" class="ghost" @click="resetFilters">{{ t('system.reset') }}</button>
      <button type="button" class="primary" :disabled="loading" @click="search">{{ t('system.query') }}</button>
    </div>

    <div v-if="loading" class="state">{{ t('system.loading') }}</div>
    <div v-else-if="!logs.length" class="state">{{ t('system.logEmpty') }}</div>
    <template v-else>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t('system.logTime') }}</th>
              <th>{{ t('system.logActor') }}</th>
              <th>{{ t('system.logMethod') }}</th>
              <th>{{ t('system.logResource') }}</th>
              <th>{{ t('system.logTarget') }}</th>
              <th>{{ t('system.logStatus') }}</th>
              <th>{{ t('system.logDuration') }}</th>
              <th>{{ t('system.action') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in logs" :key="item.id">
              <td>{{ formatTime(item.createdAt) }}</td>
              <td>{{ actorText(item) }}</td>
              <td>
                <span class="method" :class="actionClass(item.action)">{{ item.action || '-' }}</span>
              </td>
              <td class="resource" :title="item.resource">{{ item.resource || '-' }}</td>
              <td>{{ item.targetId || '-' }}</td>
              <td>
                <span class="status" :class="statusClass(item.httpStatus)">{{ item.httpStatus ?? '-' }}</span>
              </td>
              <td>{{ durationText(item.durationMs) }}</td>
              <td>
                <button type="button" @click="openDetail(item)">{{ t('system.detail') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <DataPager :page="page" :page-size="pageSize" :total="pageTotal" @update:page="changePage" />
    </template>

    <p ref="noteRef" class="note">{{ t('system.logNote') }}</p>

    <el-dialog
      v-model="detailVisible"
      class="system-dialog"
      modal-class="system-dialog-modal"
      :title="t('system.logDetail')"
      width="560px"
      append-to-body
      destroy-on-close
      align-center
      @closed="closeDetail"
    >
      <dl v-if="current" class="detail">
        <div>
          <dt>{{ t('system.logTime') }}</dt>
          <dd>{{ formatTime(current.createdAt) }}</dd>
        </div>
        <div>
          <dt>{{ t('system.logActor') }}</dt>
          <dd>{{ actorText(current) }}</dd>
        </div>
        <div>
          <dt>{{ t('system.logMethod') }}</dt>
          <dd>
            <span class="method" :class="actionClass(current.action)">{{ current.action || '-' }}</span>
          </dd>
        </div>
        <div>
          <dt>{{ t('system.logResource') }}</dt>
          <dd class="mono">{{ current.resource || '-' }}</dd>
        </div>
        <div>
          <dt>{{ t('system.logTarget') }}</dt>
          <dd class="mono">{{ current.targetId || '-' }}</dd>
        </div>
        <div>
          <dt>{{ t('system.logStatus') }}</dt>
          <dd>
            <span class="status" :class="statusClass(current.httpStatus)">{{ current.httpStatus ?? '-' }}</span>
          </dd>
        </div>
        <div>
          <dt>{{ t('system.logDuration') }}</dt>
          <dd>{{ durationText(current.durationMs) }}</dd>
        </div>
        <div>
          <dt>ID</dt>
          <dd class="mono">{{ current.id || '-' }}</dd>
        </div>
      </dl>
      <template #footer>
        <button type="button" class="primary" @click="closeDetail">{{ t('system.close') }}</button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  padding: 18px 20px;
  overflow: hidden;
}

header {
  flex: none;
  margin-bottom: 12px;
}

h1 {
  margin: 0 0 6px;
  font-size: 20px;
}

.hint,
.note {
  margin: 0;
  color: rgba(214, 245, 228, 0.62);
  font-size: 13px;
  line-height: 1.5;
}

.note {
  flex: none;
  margin-top: 14px;
}

.filters {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 14px;
}

.filter-select {
  width: min(220px, 100%);
}

.filter-range {
  width: min(380px, 100%);
}

.filter-select :deep(.el-select__wrapper),
.filter-range :deep(.el-range-editor.el-input__wrapper) {
  min-height: 36px;
  border-radius: 8px;
  background: rgba(3, 18, 14, 0.72);
  box-shadow: 0 0 0 1px rgba(140, 220, 175, 0.32) inset;
}

.filter-select :deep(.el-select__wrapper.is-focused),
.filter-range :deep(.el-range-editor.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #3dce7c inset, 0 0 0 3px rgba(61, 206, 124, 0.16);
}

.filter-select :deep(.el-select__placeholder),
.filter-select :deep(.el-select__selected-item),
.filter-select :deep(.el-select__caret),
.filter-range :deep(.el-range-input),
.filter-range :deep(.el-range-separator),
.filter-range :deep(.el-range__icon),
.filter-range :deep(.el-range__close-icon) {
  color: #f3fff8;
}

.filter-range :deep(.el-range-input) {
  background: transparent;
}

.filter-range :deep(.el-range-input::placeholder) {
  color: rgba(198, 224, 210, 0.5);
}

.ghost,
.primary,
td button {
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

td button {
  padding: 0 12px;
  border: 1px solid rgba(140, 220, 175, 0.32);
  color: #f3fff8;
  background: rgba(3, 18, 14, 0.55);
}

.state {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 24px 12px;
  color: rgba(214, 245, 228, 0.62);
  text-align: center;
}

.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(140, 220, 175, 0.14);
  border-radius: 12px;
  background: rgba(3, 18, 14, 0.28);
}

table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
}

th,
td {
  padding: 12px 10px;
  border-bottom: 1px solid rgba(140, 220, 175, 0.12);
  text-align: left;
  vertical-align: middle;
}

th {
  color: rgba(214, 245, 228, 0.72);
  font-weight: 600;
  white-space: nowrap;
  background: rgba(3, 18, 14, 0.45);
}

tbody tr:hover {
  background: rgba(47, 191, 106, 0.08);
}

.resource,
.mono {
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.method,
.status {
  display: inline-flex;
  align-items: center;
  min-width: 52px;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.method-post {
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
}

.method-put {
  color: #8dffc8;
  background: rgba(60, 200, 140, 0.16);
}

.method-delete {
  color: #ffb4b4;
  background: rgba(220, 80, 80, 0.16);
}

.method-other {
  color: rgba(214, 245, 228, 0.78);
  background: rgba(214, 245, 228, 0.1);
}

.status.ok {
  color: #8dffc8;
  background: rgba(60, 200, 140, 0.16);
}

.status.warn {
  color: #ffd38a;
  background: rgba(220, 160, 60, 0.16);
}

.status.deny {
  color: #ffb4b4;
  background: rgba(220, 80, 80, 0.16);
}

.detail {
  display: grid;
  gap: 12px;
  margin: 0;
}

.detail > div {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 10px;
  align-items: start;
}

.detail dt {
  color: rgba(214, 245, 228, 0.62);
}

.detail dd {
  margin: 0;
  color: #f3fff8;
  word-break: break-all;
}

.detail .mono {
  max-width: none;
  white-space: normal;
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .filters {
    align-items: stretch;
  }

  .filter-select,
  .filter-range {
    width: 100%;
  }
}
</style>

<style>
.system-date-popper.el-picker__popper {
  border: 1px solid rgba(140, 220, 175, 0.28);
  background: rgba(5, 24, 18, 0.98);
}

.system-date-popper .el-picker-panel,
.system-date-popper .el-date-range-picker,
.system-date-popper .el-date-range-picker__time-header,
.system-date-popper .el-picker-panel__footer {
  color: #e7fff4;
  background: transparent;
  border-color: rgba(140, 220, 175, 0.16);
}

.system-date-popper .el-date-table th,
.system-date-popper .el-date-table td .el-date-table-cell__text,
.system-date-popper .el-picker-panel__icon-btn,
.system-date-popper .el-date-range-picker__header {
  color: #e7fff4;
}

.system-date-popper .el-date-table td.available:hover .el-date-table-cell__text,
.system-date-popper .el-date-table td.current:not(.disabled) .el-date-table-cell__text {
  color: #042117;
  background: #2fbf6a;
}

.system-date-popper .el-date-table td.in-range .el-date-table-cell {
  background: rgba(47, 191, 106, 0.18);
}

.system-date-popper .el-input__wrapper {
  background: rgba(3, 18, 14, 0.72);
  box-shadow: 0 0 0 1px rgba(140, 220, 175, 0.32) inset;
}

.system-date-popper .el-input__inner {
  color: #f3fff8;
}

.system-date-popper .el-button {
  --el-button-text-color: #f3fff8;
  --el-button-bg-color: rgba(3, 18, 14, 0.55);
  --el-button-border-color: rgba(140, 220, 175, 0.32);
  --el-button-hover-text-color: #042117;
  --el-button-hover-bg-color: #8cf0ae;
  --el-button-hover-border-color: #8cf0ae;
}
</style>
