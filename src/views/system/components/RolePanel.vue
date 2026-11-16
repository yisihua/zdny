<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DataPager from '@/views/data/components/DataPager.vue'
import { createRole, deleteRole, fetchRoles, isBuiltinRole, updateRole } from '@/api/role'
import { t } from '@/i18n'
import '@/styles/system-dialog.css'

const roleNamePattern = /^ROLE_[A-Z0-9_]+$/

const loading = ref(false)
const submitting = ref(false)
const createVisible = ref(false)
const editVisible = ref(false)
const createFormRef = ref()
const editFormRef = ref()
const roles = ref([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const currentRole = reactive({
  id: '',
  name: '',
})

const createForm = reactive({
  name: '',
  description: '',
})

const editForm = reactive({
  description: '',
})

const createRules = computed(() => ({
  name: [
    { required: true, message: t('system.roleRequired'), trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        const name = String(value || '').trim()
        if (!name) {
          callback(new Error(t('system.roleRequired')))
          return
        }
        if (name.length > 64) {
          callback(new Error(t('system.roleNameLong')))
          return
        }
        if (!roleNamePattern.test(name)) {
          callback(new Error(t('system.roleNameRule')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  description: [
    {
      validator: (_rule, value, callback) => {
        if (String(value || '').length > 255) {
          callback(new Error(t('system.roleDescLong')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}))

const editRules = computed(() => ({
  description: [
    {
      validator: (_rule, value, callback) => {
        if (String(value || '').length > 255) {
          callback(new Error(t('system.roleDescLong')))
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

function formatTime(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').replace(/\.\d+.*/, '').replace(/\+\d{2}:\d{2}$/, '')
}

function permissionCount(role) {
  return Array.isArray(role.permissions) ? role.permissions.length : 0
}

async function loadRoles() {
  loading.value = true
  try {
    const data = await fetchRoles({ page: page.value, pageSize: pageSize.value })
    roles.value = Array.isArray(data?.records) ? data.records : []
    total.value = data?.total != null ? Number(data.total) : roles.value.length
    if (data?.pageSize) pageSize.value = Number(data.pageSize) || pageSize.value
  } catch {
    roles.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function changePage(next) {
  page.value = next
  loadRoles()
}

function openCreate() {
  createForm.name = ''
  createForm.description = ''
  createVisible.value = true
}

function closeCreate() {
  createVisible.value = false
  createFormRef.value?.resetFields?.()
  createForm.name = ''
  createForm.description = ''
}

async function submitCreate() {
  const valid = await createFormRef.value?.validate?.().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const body = {
      name: createForm.name.trim(),
    }
    const description = createForm.description.trim()
    if (description) body.description = description
    await createRole(body)
    ElMessage.success(t('system.roleCreated'))
    closeCreate()
    page.value = 1
    await loadRoles()
  } catch {
    // request interceptor already shows message
  } finally {
    submitting.value = false
  }
}

function openEdit(role) {
  if (isBuiltinRole(role.name)) {
    ElMessage.warning(t('system.roleDescLocked'))
    return
  }
  currentRole.id = String(role.id)
  currentRole.name = role.name || ''
  editForm.description = role.description || ''
  editVisible.value = true
}

function closeEdit() {
  editVisible.value = false
  editFormRef.value?.resetFields?.()
  currentRole.id = ''
  currentRole.name = ''
  editForm.description = ''
}

async function submitEdit() {
  const valid = await editFormRef.value?.validate?.().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const description = editForm.description.trim()
    await updateRole(currentRole.id, { description: description || null })
    ElMessage.success(t('system.roleUpdated'))
    closeEdit()
    await loadRoles()
  } catch {
    // request interceptor already shows message
  } finally {
    submitting.value = false
  }
}

async function removeRole(role) {
  if (isBuiltinRole(role.name)) {
    ElMessage.warning(t('system.roleLocked'))
    return
  }

  try {
    await ElMessageBox.confirm(
      t('system.roleDeleteConfirm', { name: role.name }),
      t('system.role'),
      {
        type: 'warning',
        customClass: 'system-message-box',
        confirmButtonText: t('system.remove'),
        cancelButtonText: t('system.cancel'),
      },
    )
    await deleteRole(role.id)
    ElMessage.success(t('system.roleDeleted'))
    if (roles.value.length <= 1 && page.value > 1) page.value -= 1
    await loadRoles()
  } catch {
    // cancelled or request failed
  }
}

onMounted(loadRoles)
</script>

<template>
  <section class="panel">
    <header>
      <h1>{{ t('system.role') }}</h1>
      <button type="button" class="primary" @click="openCreate">{{ t('system.addRole') }}</button>
    </header>

    <p class="hint">{{ t('system.roleHint') }}</p>

    <div v-if="loading" class="state">{{ t('system.loading') }}</div>
    <div v-else-if="!roles.length" class="state">{{ t('system.roleEmpty') }}</div>
    <template v-else>
      <table>
        <thead>
          <tr>
            <th>{{ t('system.roleCol') }}</th>
            <th>{{ t('system.roleDesc') }}</th>
            <th>{{ t('system.permCount') }}</th>
            <th>{{ t('system.createdAt') }}</th>
            <th>{{ t('system.action') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="role in roles" :key="role.id">
            <td>
              {{ role.name }}
              <em v-if="isBuiltinRole(role.name)">{{ t('system.builtin') }}</em>
            </td>
            <td>{{ role.description || t('system.roleNoDesc') }}</td>
            <td>{{ permissionCount(role) }}</td>
            <td>{{ formatTime(role.createdAt) }}</td>
            <td class="actions">
              <button type="button" :disabled="isBuiltinRole(role.name)" @click="openEdit(role)">
                {{ t('system.editDesc') }}
              </button>
              <button type="button" :disabled="isBuiltinRole(role.name)" @click="removeRole(role)">
                {{ t('system.remove') }}
              </button>
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
      :title="t('system.addRole')"
      width="480px"
      append-to-body
      destroy-on-close
      align-center
      @closed="closeCreate"
    >
      <el-form
        ref="createFormRef"
        class="system-form"
        :model="createForm"
        :rules="createRules"
        label-position="top"
        @submit.prevent="submitCreate"
      >
        <el-form-item :label="t('system.roleCol')" prop="name" required>
          <el-input
            v-model="createForm.name"
            maxlength="64"
            :placeholder="t('system.roleName')"
            autocomplete="off"
          />
        </el-form-item>
        <p class="dialog-hint">{{ t('system.roleNameTip') }}</p>
        <el-form-item :label="t('system.roleDesc')" prop="description">
          <el-input
            v-model="createForm.description"
            type="textarea"
            :rows="3"
            maxlength="255"
            :placeholder="t('system.roleDescPh')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <button type="button" class="ghost" @click="closeCreate">{{ t('system.cancel') }}</button>
        <button type="button" class="primary" :disabled="submitting" @click="submitCreate">
          {{ t('system.save') }}
        </button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="editVisible"
      class="system-dialog"
      modal-class="system-dialog-modal"
      :title="t('system.editDesc')"
      width="480px"
      append-to-body
      destroy-on-close
      align-center
      @closed="closeEdit"
    >
      <el-form
        ref="editFormRef"
        class="system-form"
        :model="editForm"
        :rules="editRules"
        label-position="top"
        @submit.prevent="submitEdit"
      >
        <el-form-item :label="t('system.roleCol')">
          <el-input :model-value="currentRole.name" disabled />
        </el-form-item>
        <el-form-item :label="t('system.roleDesc')" prop="description">
          <el-input
            v-model="editForm.description"
            type="textarea"
            :rows="3"
            maxlength="255"
            :placeholder="t('system.roleDescEdit')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <button type="button" class="ghost" @click="closeEdit">{{ t('system.cancel') }}</button>
        <button type="button" class="primary" :disabled="submitting" @click="submitEdit">
          {{ t('system.save') }}
        </button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel {
  min-width: 0;
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

.hint,
.dialog-hint {
  margin: 0 0 14px;
  color: rgba(214, 245, 228, 0.62);
  font-size: 13px;
  line-height: 1.5;
}

.dialog-hint {
  margin: -4px 0 14px;
}

.state {
  padding: 40px 12px;
  color: rgba(214, 245, 228, 0.62);
  text-align: center;
}

.primary,
td button {
  height: 36px;
  border-radius: 8px;
  font: inherit;
  cursor: pointer;
}

.primary {
  padding: 0 14px;
  border: none;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
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
}

th {
  color: rgba(214, 245, 228, 0.72);
  font-weight: 600;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

td button {
  padding: 0 12px;
  border: 1px solid rgba(140, 220, 175, 0.32);
  color: #f3fff8;
  background: rgba(3, 18, 14, 0.55);
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

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
