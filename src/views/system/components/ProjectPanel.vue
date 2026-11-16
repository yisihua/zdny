<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DataPager from '@/views/data/components/DataPager.vue'
import {
  addProjectMember,
  createProject,
  fetchProjectMembers,
  fetchProjects,
  removeProjectMember,
  updateProject,
  updateProjectSharing,
} from '@/api/project'
import { fetchTeams } from '@/api/team'
import { fetchUsers } from '@/api/user'
import { t } from '@/i18n'
import '@/styles/system-dialog.css'

const loading = ref(false)
const submitting = ref(false)
const formVisible = ref(false)
const shareVisible = ref(false)
const membersVisible = ref(false)
const formRef = ref()
const shareFormRef = ref()
const projects = ref([])
const teamOptions = ref([])
const userOptions = ref([])
const members = ref([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const memberPage = ref(1)
const memberPageSize = ref(10)
const memberTotal = ref(0)
const selectedUserId = ref('')
const editingId = ref('')

const currentProject = reactive({
  id: '',
  name: '',
  ownerId: '',
})

const form = reactive({
  name: '',
  teamId: '',
  year: '',
  location: '',
  shareRaw: false,
  shareProcessed: false,
})

const shareForm = reactive({
  shareRaw: false,
  shareProcessed: false,
})

const formRules = computed(() => ({
  name: [
    { required: true, message: t('system.projectNameRequired'), trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        const name = String(value || '').trim()
        if (!name) {
          callback(new Error(t('system.projectNameRequired')))
          return
        }
        if (name.length > 256) {
          callback(new Error(t('system.projectNameLong')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  year: [
    {
      validator: (_rule, value, callback) => {
        if (value === '' || value == null) {
          callback()
          return
        }
        const year = Number(value)
        if (!Number.isInteger(year) || year < 1 || year > 9999) {
          callback(new Error(t('system.projectYearBad')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  location: [
    {
      validator: (_rule, value, callback) => {
        if (String(value || '').trim().length > 128) {
          callback(new Error(t('system.projectLocationLong')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}))

const pageTotal = computed(() => {
  const value = Number(total.value)
  return Number.isFinite(value) ? value : 0
})

const memberPageTotal = computed(() => {
  const value = Number(memberTotal.value)
  return Number.isFinite(value) ? value : 0
})

const formTitle = computed(() => (editingId.value ? t('system.editProject') : t('system.addProject')))

function userLabel(user) {
  const name = user.displayName || user.username
  return `${name}（${user.username}）`
}

function ownerText(project) {
  const owner = userOptions.value.find((item) => String(item.id) === String(project.ownerId))
  return owner ? owner.username : project.ownerId || '-'
}

function teamText(project) {
  if (!project.teamId) return t('system.noTeam')
  const team = teamOptions.value.find((item) => String(item.id) === String(project.teamId))
  return team ? team.name : String(project.teamId)
}

function shareText(project) {
  const raw = project.shareRaw ? t('system.shareRawOn') : t('system.shareRawOff')
  const processed = project.shareProcessed ? t('system.shareProcessedOn') : t('system.shareProcessedOff')
  return `${raw} / ${processed}`
}

function formatTime(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').replace(/\.\d+.*/, '').replace(/\+\d{2}:\d{2}$/, '')
}

function buildProjectBody() {
  const body = {
    name: form.name.trim(),
    shareRaw: !!form.shareRaw,
    shareProcessed: !!form.shareProcessed,
  }
  body.teamId = form.teamId ? String(form.teamId) : null
  body.year = form.year === '' || form.year == null ? null : Number(form.year)
  body.location = form.location.trim() ? form.location.trim() : null
  return body
}

async function loadUsers() {
  try {
    const data = await fetchUsers({ page: 1, pageSize: 100 })
    userOptions.value = Array.isArray(data?.records) ? data.records.filter((item) => item.enabled !== false) : []
  } catch {
    userOptions.value = []
  }
}

async function loadTeams() {
  try {
    const data = await fetchTeams({ page: 1, pageSize: 100 })
    teamOptions.value = Array.isArray(data?.records) ? data.records : []
  } catch {
    teamOptions.value = []
  }
}

async function loadProjects() {
  loading.value = true
  try {
    const data = await fetchProjects({ page: page.value, pageSize: pageSize.value })
    projects.value = Array.isArray(data?.records) ? data.records : []
    total.value = data?.total != null ? Number(data.total) : projects.value.length
    if (data?.pageSize) pageSize.value = Number(data.pageSize) || pageSize.value
  } catch {
    projects.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function loadMembers() {
  if (!currentProject.id) return
  try {
    const data = await fetchProjectMembers(currentProject.id, {
      page: memberPage.value,
      pageSize: memberPageSize.value,
    })
    members.value = Array.isArray(data?.records) ? data.records : []
    memberTotal.value = data?.total != null ? Number(data.total) : members.value.length
  } catch {
    members.value = []
    memberTotal.value = 0
  }
}

function changePage(next) {
  if (next === page.value) return
  page.value = next
  loadProjects()
}

function changeMemberPage(next) {
  if (next === memberPage.value) return
  memberPage.value = next
  loadMembers()
}

function resetForm() {
  form.name = ''
  form.teamId = ''
  form.year = ''
  form.location = ''
  form.shareRaw = false
  form.shareProcessed = false
}

function openCreate() {
  editingId.value = ''
  resetForm()
  formVisible.value = true
}

function openEdit(project) {
  editingId.value = String(project.id)
  form.name = project.name || ''
  form.teamId = project.teamId ? String(project.teamId) : ''
  form.year = project.year == null ? '' : Number(project.year)
  form.location = project.location || ''
  form.shareRaw = !!project.shareRaw
  form.shareProcessed = !!project.shareProcessed
  formVisible.value = true
}

function closeForm() {
  formVisible.value = false
  editingId.value = ''
  formRef.value?.resetFields?.()
  resetForm()
}

async function submitForm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || submitting.value) return
  submitting.value = true
  try {
    const body = buildProjectBody()
    if (editingId.value) {
      await updateProject(editingId.value, body)
      ElMessage.success(t('system.projectUpdated'))
    } else {
      await createProject(body)
      ElMessage.success(t('system.projectCreated'))
      page.value = 1
    }
    closeForm()
    await loadProjects()
  } catch {
    // 错误由请求层展示
  } finally {
    submitting.value = false
  }
}

function openShare(project) {
  currentProject.id = String(project.id)
  currentProject.name = project.name || ''
  shareForm.shareRaw = !!project.shareRaw
  shareForm.shareProcessed = !!project.shareProcessed
  shareVisible.value = true
}

function closeShare() {
  shareVisible.value = false
  currentProject.id = ''
  currentProject.name = ''
}

async function submitShare() {
  if (!currentProject.id || submitting.value) return
  submitting.value = true
  try {
    await updateProjectSharing(currentProject.id, {
      shareRaw: !!shareForm.shareRaw,
      shareProcessed: !!shareForm.shareProcessed,
    })
    ElMessage.success(t('system.shareUpdated'))
    closeShare()
    await loadProjects()
  } catch {
    // 错误由请求层展示
  } finally {
    submitting.value = false
  }
}

async function openMembers(project) {
  currentProject.id = String(project.id)
  currentProject.name = project.name || ''
  currentProject.ownerId = project.ownerId ? String(project.ownerId) : ''
  selectedUserId.value = ''
  memberPage.value = 1
  membersVisible.value = true
  if (!userOptions.value.length) await loadUsers()
  await loadMembers()
}

function closeMembers() {
  membersVisible.value = false
  currentProject.id = ''
  currentProject.name = ''
  currentProject.ownerId = ''
  selectedUserId.value = ''
  members.value = []
}

async function submitAddMember() {
  if (!selectedUserId.value) {
    ElMessage.warning(t('system.memberRequired'))
    return
  }
  if (submitting.value) return
  submitting.value = true
  try {
    await addProjectMember(currentProject.id, selectedUserId.value)
    ElMessage.success(t('system.memberAdded'))
    selectedUserId.value = ''
    await loadMembers()
  } catch {
    // 错误由请求层展示
  } finally {
    submitting.value = false
  }
}

async function removeMember(member) {
  if (String(member.userId) === currentProject.ownerId) {
    ElMessage.warning(t('system.cannotRemoveOwner'))
    return
  }
  try {
    await ElMessageBox.confirm(
      t('system.memberRemoveConfirm', { name: member.displayName || member.username || member.userId }),
      t('system.projectMembers'),
      {
        type: 'warning',
        customClass: 'system-message-box',
        confirmButtonText: t('system.remove'),
        cancelButtonText: t('system.cancel'),
      },
    )
    await removeProjectMember(currentProject.id, member.userId)
    ElMessage.success(t('system.memberRemoved'))
    if (members.value.length <= 1 && memberPage.value > 1) memberPage.value -= 1
    await loadMembers()
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
  }
}

onMounted(async () => {
  await Promise.all([loadProjects(), loadTeams(), loadUsers()])
})
</script>

<template>
  <section class="panel">
    <header>
      <h1>{{ t('system.project') }}</h1>
      <button type="button" class="primary" @click="openCreate">{{ t('system.addProject') }}</button>
    </header>

    <p class="hint">{{ t('system.projectHint') }}</p>

    <div v-if="loading" class="state">{{ t('system.loading') }}</div>
    <div v-else-if="!projects.length" class="state">{{ t('system.projectEmpty') }}</div>
    <template v-else>
      <table>
        <thead>
          <tr>
            <th>{{ t('system.projectName') }}</th>
            <th>{{ t('system.projectYear') }}</th>
            <th>{{ t('system.projectLocation') }}</th>
            <th>{{ t('system.linkedTeam') }}</th>
            <th>{{ t('system.shareStatus') }}</th>
            <th>{{ t('system.owner') }}</th>
            <th>{{ t('system.createdAt') }}</th>
            <th>{{ t('system.action') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="project in projects" :key="project.id">
            <td>{{ project.name }}</td>
            <td>{{ project.year ?? '-' }}</td>
            <td>{{ project.location || '-' }}</td>
            <td>{{ teamText(project) }}</td>
            <td>{{ shareText(project) }}</td>
            <td>{{ ownerText(project) }}</td>
            <td>{{ formatTime(project.createdAt) }}</td>
            <td class="actions">
              <button type="button" @click="openEdit(project)">{{ t('system.edit') }}</button>
              <button type="button" @click="openShare(project)">{{ t('system.shareSwitch') }}</button>
              <button type="button" @click="openMembers(project)">{{ t('system.projectMembers') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <DataPager :page="page" :page-size="pageSize" :total="pageTotal" @update:page="changePage" />
    </template>

    <el-dialog
      v-model="formVisible"
      class="system-dialog"
      modal-class="system-dialog-modal"
      :title="formTitle"
      width="560px"
      append-to-body
      destroy-on-close
      align-center
      @closed="closeForm"
    >
      <el-form
        ref="formRef"
        class="system-form"
        :model="form"
        :rules="formRules"
        label-position="top"
        @submit.prevent="submitForm"
      >
        <el-form-item :label="t('system.projectName')" prop="name" required>
          <el-input v-model="form.name" maxlength="256" :placeholder="t('system.projectNamePh')" />
        </el-form-item>
        <el-form-item :label="t('system.linkedTeam')" prop="teamId">
          <el-select
            v-model="form.teamId"
            clearable
            filterable
            :placeholder="t('system.teamOptional')"
            popper-class="system-select-dropdown"
            style="width: 100%"
          >
            <el-option
              v-for="team in teamOptions"
              :key="team.id"
              :label="team.name"
              :value="String(team.id)"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('system.projectYear')" prop="year">
          <el-input v-model="form.year" :placeholder="t('system.projectYearPh')" />
        </el-form-item>
        <el-form-item :label="t('system.projectLocation')" prop="location">
          <el-input
            v-model="form.location"
            maxlength="128"
            :placeholder="t('system.projectLocationPh')"
          />
        </el-form-item>
        <div class="switch-row">
          <el-form-item :label="t('system.shareRaw')" prop="shareRaw">
            <el-switch v-model="form.shareRaw" />
          </el-form-item>
          <el-form-item :label="t('system.shareProcessed')" prop="shareProcessed">
            <el-switch v-model="form.shareProcessed" />
          </el-form-item>
        </div>
      </el-form>
      <p class="dialog-hint">{{ t('system.projectFormHint') }}</p>
      <template #footer>
        <button type="button" class="ghost" @click="closeForm">{{ t('system.cancel') }}</button>
        <button type="button" class="primary" :disabled="submitting" @click="submitForm">{{ t('system.save') }}</button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="shareVisible"
      class="system-dialog"
      modal-class="system-dialog-modal"
      :title="t('system.shareTitle', { name: currentProject.name })"
      width="460px"
      append-to-body
      destroy-on-close
      align-center
      @closed="closeShare"
    >
      <el-form ref="shareFormRef" class="system-form" :model="shareForm" label-position="top">
        <el-form-item :label="t('system.shareRaw')">
          <el-switch v-model="shareForm.shareRaw" />
        </el-form-item>
        <el-form-item :label="t('system.shareProcessed')">
          <el-switch v-model="shareForm.shareProcessed" />
        </el-form-item>
      </el-form>
      <p class="dialog-hint">{{ t('system.shareHint') }}</p>
      <template #footer>
        <button type="button" class="ghost" @click="closeShare">{{ t('system.cancel') }}</button>
        <button type="button" class="primary" :disabled="submitting" @click="submitShare">{{ t('system.save') }}</button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="membersVisible"
      class="system-dialog"
      modal-class="system-dialog-modal"
      :title="t('system.projectMembersTitle', { name: currentProject.name })"
      width="640px"
      append-to-body
      destroy-on-close
      align-center
      @closed="closeMembers"
    >
      <div class="member-toolbar">
        <el-select
          v-model="selectedUserId"
          class="member-select"
          filterable
          clearable
          :placeholder="t('system.memberSelect')"
          popper-class="system-select-dropdown"
        >
          <el-option
            v-for="user in userOptions"
            :key="user.id"
            :label="userLabel(user)"
            :value="String(user.id)"
          />
        </el-select>
        <button type="button" class="primary" :disabled="submitting" @click="submitAddMember">
          {{ t('system.addMember') }}
        </button>
      </div>

      <div v-if="!members.length" class="state compact">{{ t('system.memberEmpty') }}</div>
      <table v-else>
        <thead>
          <tr>
            <th>{{ t('system.account') }}</th>
            <th>{{ t('system.person') }}</th>
            <th>{{ t('system.joinedAt') }}</th>
            <th>{{ t('system.action') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="member in members" :key="member.id">
            <td>
              {{ member.username || member.userId }}
              <em v-if="String(member.userId) === currentProject.ownerId">{{ t('system.ownerTag') }}</em>
            </td>
            <td>{{ member.displayName || t('system.noDisplayName') }}</td>
            <td>{{ formatTime(member.createdAt) }}</td>
            <td>
              <button
                type="button"
                :disabled="String(member.userId) === currentProject.ownerId"
                @click="removeMember(member)"
              >
                {{ t('system.remove') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <DataPager
        v-if="members.length"
        :page="memberPage"
        :page-size="memberPageSize"
        :total="memberPageTotal"
        @update:page="changeMemberPage"
      />
    </el-dialog>
  </section>
</template>

<style scoped>
.panel {
  min-width: 0;
  height: 100%;
  padding: 18px 20px;
  overflow: auto;
}

header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}

h1 {
  margin: 0;
  font-size: 20px;
}

button {
  height: 36px;
  border: 1px solid rgba(140, 220, 175, 0.32);
  border-radius: 8px;
  color: #f3fff8;
  background: rgba(3, 18, 14, 0.55);
  font: inherit;
  cursor: pointer;
}

.primary,
.actions button,
td button {
  padding: 0 14px;
}

.primary {
  border: none;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
}

.hint,
.dialog-hint {
  margin: 0 0 14px;
  color: rgba(214, 245, 228, 0.55);
  font-size: 13px;
  line-height: 1.6;
}

.state {
  padding: 36px 0;
  color: rgba(214, 245, 228, 0.62);
  text-align: center;
}

.state.compact {
  padding: 18px 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 12px 10px;
  border-bottom: 1px solid rgba(140, 220, 175, 0.14);
  text-align: left;
  vertical-align: middle;
}

th {
  color: rgba(214, 245, 228, 0.72);
  font-weight: 600;
}

em {
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: 999px;
  color: #8dffc8;
  background: rgba(60, 200, 140, 0.16);
  font-size: 12px;
  font-style: normal;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.switch-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.member-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
}

.member-select {
  flex: 1;
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .switch-row {
    grid-template-columns: 1fr;
  }
}
</style>
