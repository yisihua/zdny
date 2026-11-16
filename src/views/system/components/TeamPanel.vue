<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DataPager from '@/views/data/components/DataPager.vue'
import { addTeamMember, createTeam, fetchTeamMembers, fetchTeams, removeTeamMember } from '@/api/team'
import { fetchUsers } from '@/api/user'
import { t } from '@/i18n'
import '@/styles/system-dialog.css'

const loading = ref(false)
const submitting = ref(false)
const createVisible = ref(false)
const membersVisible = ref(false)
const createFormRef = ref()
const teams = ref([])
const members = ref([])
const userOptions = ref([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const memberPage = ref(1)
const memberPageSize = ref(10)
const memberTotal = ref(0)
const selectedUserId = ref('')

const currentTeam = reactive({
  id: '',
  name: '',
  ownerId: '',
})

const form = reactive({
  name: '',
})

const createRules = computed(() => ({
  name: [
    { required: true, message: t('system.teamNameRequired'), trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        const name = String(value || '').trim()
        if (!name) {
          callback(new Error(t('system.teamNameRequired')))
          return
        }
        if (name.length > 128) {
          callback(new Error(t('system.teamNameLong')))
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

function userLabel(user) {
  const name = user.displayName || user.username
  return `${name}（${user.username}）`
}

function ownerText(team) {
  const owner = userOptions.value.find((item) => String(item.id) === String(team.ownerId))
  return owner ? owner.username : team.ownerId || '-'
}

function formatTime(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').replace(/\.\d+.*/, '').replace(/\+\d{2}:\d{2}$/, '')
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
  loading.value = true
  try {
    const data = await fetchTeams({ page: page.value, pageSize: pageSize.value })
    teams.value = Array.isArray(data?.records) ? data.records : []
    total.value = data?.total != null ? Number(data.total) : teams.value.length
    if (data?.pageSize) pageSize.value = Number(data.pageSize) || pageSize.value
  } catch {
    teams.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function loadMembers() {
  if (!currentTeam.id) return
  try {
    const data = await fetchTeamMembers(currentTeam.id, {
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
  loadTeams()
}

function changeMemberPage(next) {
  if (next === memberPage.value) return
  memberPage.value = next
  loadMembers()
}

function openCreate() {
  form.name = ''
  createVisible.value = true
}

function closeCreate() {
  createVisible.value = false
  createFormRef.value?.resetFields?.()
  form.name = ''
}

async function submitCreate() {
  const valid = await createFormRef.value?.validate().catch(() => false)
  if (!valid || submitting.value) return
  submitting.value = true
  try {
    await createTeam({ name: form.name.trim() })
    ElMessage.success(t('system.teamCreated'))
    closeCreate()
    page.value = 1
    await loadTeams()
  } catch {
    // 错误由请求层展示
  } finally {
    submitting.value = false
  }
}

async function openMembers(team) {
  currentTeam.id = String(team.id)
  currentTeam.name = team.name || ''
  currentTeam.ownerId = team.ownerId ? String(team.ownerId) : ''
  selectedUserId.value = ''
  memberPage.value = 1
  membersVisible.value = true
  if (!userOptions.value.length) await loadUsers()
  await loadMembers()
}

function closeMembers() {
  membersVisible.value = false
  currentTeam.id = ''
  currentTeam.name = ''
  currentTeam.ownerId = ''
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
    await addTeamMember(currentTeam.id, selectedUserId.value)
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
  if (String(member.userId) === currentTeam.ownerId) {
    ElMessage.warning(t('system.cannotRemoveOwner'))
    return
  }
  try {
    await ElMessageBox.confirm(
      t('system.memberRemoveConfirm', { name: member.displayName || member.username || member.userId }),
      t('system.teamMembers'),
      {
        type: 'warning',
        customClass: 'system-message-box',
        confirmButtonText: t('system.remove'),
        cancelButtonText: t('system.cancel'),
      },
    )
    await removeTeamMember(currentTeam.id, member.userId)
    ElMessage.success(t('system.memberRemoved'))
    if (members.value.length <= 1 && memberPage.value > 1) memberPage.value -= 1
    await loadMembers()
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
  }
}

onMounted(async () => {
  await Promise.all([loadTeams(), loadUsers()])
})
</script>

<template>
  <section class="panel">
    <header>
      <h1>{{ t('system.team') }}</h1>
      <button type="button" class="primary" @click="openCreate">{{ t('system.addTeam') }}</button>
    </header>

    <p class="hint">{{ t('system.teamHint') }}</p>

    <div v-if="loading" class="state">{{ t('system.loading') }}</div>
    <div v-else-if="!teams.length" class="state">{{ t('system.teamEmpty') }}</div>
    <template v-else>
      <table>
        <thead>
          <tr>
            <th>{{ t('system.teamName') }}</th>
            <th>{{ t('system.owner') }}</th>
            <th>{{ t('system.createdAt') }}</th>
            <th>{{ t('system.action') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="team in teams" :key="team.id">
            <td>{{ team.name }}</td>
            <td>{{ ownerText(team) }}</td>
            <td>{{ formatTime(team.createdAt) }}</td>
            <td class="actions">
              <button type="button" @click="openMembers(team)">{{ t('system.teamMembers') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <DataPager :page="page" :page-size="pageSize" :total="pageTotal" @update:page="changePage" />
    </template>

    <el-dialog
      v-model="createVisible"
      class="system-dialog"
      modal-class="system-dialog-modal"
      :title="t('system.addTeam')"
      width="460px"
      append-to-body
      destroy-on-close
      align-center
      @closed="closeCreate"
    >
      <el-form
        ref="createFormRef"
        class="system-form"
        :model="form"
        :rules="createRules"
        label-position="top"
        @submit.prevent="submitCreate"
      >
        <el-form-item :label="t('system.teamName')" prop="name" required>
          <el-input
            v-model="form.name"
            maxlength="128"
            :placeholder="t('system.teamNamePh')"
            autocomplete="off"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <button type="button" class="ghost" @click="closeCreate">{{ t('system.cancel') }}</button>
        <button type="button" class="primary" :disabled="submitting" @click="submitCreate">{{ t('system.save') }}</button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="membersVisible"
      class="system-dialog"
      modal-class="system-dialog-modal"
      :title="t('system.teamMembersTitle', { name: currentTeam.name })"
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
              <em v-if="String(member.userId) === currentTeam.ownerId">{{ t('system.ownerTag') }}</em>
            </td>
            <td>{{ member.displayName || t('system.noDisplayName') }}</td>
            <td>{{ formatTime(member.createdAt) }}</td>
            <td>
              <button
                type="button"
                :disabled="String(member.userId) === currentTeam.ownerId"
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

.hint {
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
</style>
