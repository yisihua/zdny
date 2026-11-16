<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DataPager from '@/views/data/components/DataPager.vue'
import { createUser, deleteUser, fetchUsers, setUserEnabled, setUserRoles } from '@/api/user'
import { fetchRoles } from '@/api/role'
import { t } from '@/i18n'
import '@/styles/system-dialog.css'

const usernamePattern = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/

const loading = ref(false)
const submitting = ref(false)
const createVisible = ref(false)
const rolesVisible = ref(false)
const createFormRef = ref()
const users = ref([])
const roleOptions = ref([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const currentUserId = computed(() => localStorage.getItem('userId') || '')
const currentUsername = computed(() => localStorage.getItem('username') || '')

const form = reactive({
  username: '',
  password: '',
  email: '',
  securityQuestion: '',
  securityAnswer: '',
})

const rolesForm = reactive({
  userId: '',
  username: '',
  selected: [],
})

const createRules = computed(() => ({
  username: [
    { required: true, message: t('system.usernameRequired'), trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        const username = String(value || '').trim()
        if (!usernamePattern.test(username)) {
          callback(new Error(t('system.usernameRule')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  password: [
    { required: true, message: t('system.passwordRequired'), trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        const password = String(value || '')
        if (password.length < 8 || password.length > 72 || new TextEncoder().encode(password).length > 72) {
          callback(new Error(t('system.passwordRule')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  email: [
    {
      validator: (_rule, value, callback) => {
        const email = String(value || '').trim()
        if (!email) {
          callback()
          return
        }
        if (email.length > 128 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          callback(new Error(t('system.emailBad')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  securityQuestion: [
    { required: true, message: t('system.securityQuestionRequired'), trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (!String(value || '').trim() || String(value || '').trim().length > 128) {
          callback(new Error(t('system.fieldLong')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  securityAnswer: [
    { required: true, message: t('system.securityAnswerRequired'), trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (!String(value || '').trim() || String(value || '').trim().length > 128) {
          callback(new Error(t('system.fieldLong')))
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

function roleNames(user) {
  return Array.isArray(user?.roles) ? user.roles.map((role) => role.name).filter(Boolean) : []
}

function roleText(user) {
  const names = roleNames(user)
  return names.length ? names.join('、') : t('system.noRole')
}

function isSelf(user) {
  return String(user?.id || '') === currentUserId.value || user?.username === currentUsername.value
}

async function loadUsers() {
  loading.value = true
  try {
    const data = await fetchUsers({ page: page.value, pageSize: pageSize.value })
    users.value = Array.isArray(data?.records) ? data.records : []
    total.value = data?.total != null ? Number(data.total) : users.value.length
    if (data?.pageSize) pageSize.value = Number(data.pageSize) || pageSize.value
  } catch {
    users.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function loadRoleOptions() {
  try {
    const data = await fetchRoles({ page: 1, pageSize: 100 })
    roleOptions.value = Array.isArray(data?.records) ? data.records : []
  } catch {
    roleOptions.value = []
  }
}

function changePage(next) {
  if (next === page.value) return
  page.value = next
  loadUsers()
}

function openCreate() {
  form.username = ''
  form.password = ''
  form.email = ''
  form.securityQuestion = ''
  form.securityAnswer = ''
  createVisible.value = true
}

function closeCreate() {
  createVisible.value = false
  createFormRef.value?.resetFields?.()
  form.username = ''
  form.password = ''
  form.email = ''
  form.securityQuestion = ''
  form.securityAnswer = ''
}

async function submitCreate() {
  const valid = await createFormRef.value?.validate().catch(() => false)
  if (!valid || submitting.value) return

  const email = form.email.trim()
  const body = {
    username: form.username.trim(),
    password: form.password,
    securityQuestion: form.securityQuestion.trim(),
    securityAnswer: form.securityAnswer.trim(),
  }
  if (email) body.email = email

  submitting.value = true
  try {
    await createUser(body)
    ElMessage.success(t('system.userCreated'))
    closeCreate()
    page.value = 1
    await loadUsers()
  } catch {
    // 错误由请求层展示
  } finally {
    submitting.value = false
  }
}

async function openRoles(user) {
  rolesForm.userId = String(user.id)
  rolesForm.username = user.username
  rolesForm.selected = roleNames(user)
  if (!roleOptions.value.length) await loadRoleOptions()
  rolesVisible.value = true
}

function closeRoles() {
  rolesVisible.value = false
  rolesForm.userId = ''
  rolesForm.username = ''
  rolesForm.selected = []
}

function toggleRole(name, checked) {
  if (checked) {
    if (!rolesForm.selected.includes(name)) rolesForm.selected.push(name)
    return
  }
  rolesForm.selected = rolesForm.selected.filter((item) => item !== name)
}

async function submitRoles() {
  if (!rolesForm.userId || submitting.value) return
  if (rolesForm.selected.length > 32) {
    ElMessage.warning(t('system.rolesTooMany'))
    return
  }
  submitting.value = true
  try {
    await setUserRoles(rolesForm.userId, [...rolesForm.selected])
    ElMessage.success(t('system.rolesUpdated'))
    closeRoles()
    await loadUsers()
  } catch {
    // 错误由请求层展示
  } finally {
    submitting.value = false
  }
}

async function toggleEnabled(user) {
  if (isSelf(user) && user.enabled) {
    ElMessage.warning(t('system.cannotDisableSelf'))
    return
  }
  try {
    await setUserEnabled(user.id, !user.enabled)
    ElMessage.success(user.enabled ? t('system.userDisabled') : t('system.userEnabled'))
    await loadUsers()
  } catch {
    // 错误由请求层展示
  }
}

async function remove(user) {
  if (isSelf(user)) {
    ElMessage.warning(t('system.cannotDeleteSelf'))
    return
  }
  try {
    await ElMessageBox.confirm(t('system.userDeleteConfirm', { name: user.username }), t('system.user'), {
      type: 'warning',
      customClass: 'system-message-box',
      confirmButtonText: t('system.remove'),
      cancelButtonText: t('system.cancel'),
    })
    await deleteUser(user.id)
    ElMessage.success(t('system.userDeleted'))
    if (users.value.length <= 1 && page.value > 1) page.value -= 1
    await loadUsers()
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
  }
}

onMounted(async () => {
  await Promise.all([loadUsers(), loadRoleOptions()])
})
</script>

<template>
  <section class="panel">
    <header>
      <h1>{{ t('system.user') }}</h1>
      <button type="button" class="primary" @click="openCreate">{{ t('system.addUser') }}</button>
    </header>

    <p class="hint">{{ t('system.userHint') }}</p>

    <div v-if="loading" class="state">{{ t('system.loading') }}</div>
    <div v-else-if="!users.length" class="state">{{ t('system.userEmpty') }}</div>
    <template v-else>
      <table>
        <thead>
          <tr>
            <th>{{ t('system.account') }}</th>
            <th>{{ t('system.person') }}</th>
            <th>{{ t('system.email') }}</th>
            <th>{{ t('system.roleCol') }}</th>
            <th>{{ t('system.status') }}</th>
            <th>{{ t('system.createdAt') }}</th>
            <th>{{ t('system.action') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>
              <span class="name">{{ user.username }}</span>
              <em v-if="isSelf(user)">{{ t('system.currentUser') }}</em>
            </td>
            <td>{{ user.displayName || t('system.noDisplayName') }}</td>
            <td>{{ user.email || t('system.noEmail') }}</td>
            <td>{{ roleText(user) }}</td>
            <td>
              <span class="status" :class="user.enabled ? 'is-on' : 'is-off'">
                {{ user.enabled ? t('system.enabled') : t('system.disabled') }}
              </span>
            </td>
            <td>{{ user.createdAt || '-' }}</td>
            <td class="actions">
              <button type="button" @click="openRoles(user)">{{ t('system.assignRoles') }}</button>
              <button type="button" :disabled="isSelf(user) && user.enabled" @click="toggleEnabled(user)">
                {{ user.enabled ? t('system.disable') : t('system.enable') }}
              </button>
              <button type="button" :disabled="isSelf(user)" @click="remove(user)">{{ t('system.remove') }}</button>
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
      :title="t('system.addUser')"
      width="520px"
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
        <el-form-item :label="t('system.account')" prop="username" required>
          <el-input v-model="form.username" maxlength="64" :placeholder="t('system.usernamePh')" autocomplete="off" />
        </el-form-item>
        <el-form-item :label="t('system.password')" prop="password" required>
          <el-input
            v-model="form.password"
            type="password"
            show-password
            maxlength="72"
            :placeholder="t('system.passwordPh')"
            autocomplete="new-password"
          />
        </el-form-item>
        <el-form-item :label="t('system.email')" prop="email">
          <el-input v-model="form.email" maxlength="128" :placeholder="t('system.emailPh')" autocomplete="off" />
        </el-form-item>
        <el-form-item :label="t('system.securityQuestion')" prop="securityQuestion" required>
          <el-input
            v-model="form.securityQuestion"
            maxlength="128"
            :placeholder="t('system.securityQuestionPh')"
            autocomplete="off"
          />
        </el-form-item>
        <el-form-item :label="t('system.securityAnswer')" prop="securityAnswer" required>
          <el-input
            v-model="form.securityAnswer"
            maxlength="128"
            :placeholder="t('system.securityAnswerPh')"
            autocomplete="off"
          />
        </el-form-item>
      </el-form>
      <p class="dialog-hint">{{ t('system.userCreateHint') }}</p>
      <template #footer>
        <button type="button" class="ghost" @click="closeCreate">{{ t('system.cancel') }}</button>
        <button type="button" class="primary" :disabled="submitting" @click="submitCreate">{{ t('system.save') }}</button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="rolesVisible"
      class="system-dialog"
      modal-class="system-dialog-modal"
      :title="t('system.assignRoles')"
      width="460px"
      append-to-body
      destroy-on-close
      align-center
      @closed="closeRoles"
    >
      <p class="dialog-hint">{{ t('system.assignRolesHint', { name: rolesForm.username }) }}</p>
      <div v-if="!roleOptions.length" class="state compact">{{ t('system.roleEmpty') }}</div>
      <div v-else class="role-list">
        <label v-for="role in roleOptions" :key="role.id" class="role-item">
          <input
            type="checkbox"
            :checked="rolesForm.selected.includes(role.name)"
            @change="toggleRole(role.name, $event.target.checked)"
          />
          <span>
            <strong>{{ role.name }}</strong>
            <small>{{ role.description || t('system.roleNoDesc') }}</small>
          </span>
        </label>
      </div>
      <template #footer>
        <button type="button" class="ghost" @click="closeRoles">{{ t('system.cancel') }}</button>
        <button type="button" class="primary" :disabled="submitting" @click="submitRoles">{{ t('system.save') }}</button>
      </template>
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
.actions button {
  padding: 0 14px;
}

.primary {
  border: none;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
}

.ghost {
  margin-right: 8px;
  padding: 0 14px;
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

.name {
  font-family: Consolas, 'Courier New', monospace;
  letter-spacing: 0.02em;
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

.status {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
}

.status.is-on {
  color: #8dffc8;
  background: rgba(60, 200, 140, 0.16);
}

.status.is-off {
  color: rgba(255, 190, 190, 0.9);
  background: rgba(180, 60, 60, 0.18);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.role-list {
  display: grid;
  gap: 10px;
}

.role-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px;
  border: 1px solid rgba(140, 220, 175, 0.22);
  border-radius: 10px;
  background: rgba(3, 18, 14, 0.45);
  cursor: pointer;
}

.role-item input {
  margin-top: 3px;
  accent-color: #2fbf6a;
}

.role-item span {
  display: grid;
  gap: 4px;
}

.role-item strong {
  color: #f3fff8;
  font-family: Consolas, 'Courier New', monospace;
  font-weight: 600;
}

.role-item small {
  color: rgba(214, 245, 228, 0.58);
  font-size: 12px;
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
