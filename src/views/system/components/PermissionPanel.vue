<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchRoles, updateRolePermissions } from '@/api/role'
import { catalogCodes, MAX_ROLE_PERMISSIONS, permissionCatalog } from '../permissions.js'
import { t } from '@/i18n'
import '@/styles/system-dialog.css'

const loading = ref(false)
const saving = ref(false)
const roles = ref([])
const roleId = ref('')
const selected = ref([])
const savedSnapshot = ref('')

const currentRole = computed(() => roles.value.find((item) => String(item.id) === String(roleId.value)) || null)

const roleOptions = computed(() =>
  roles.value.map((role) => ({
    value: String(role.id),
    label: role.description ? `${role.name}（${role.description}）` : role.name,
  })),
)

const unknownCodes = computed(() =>
  selected.value.filter((code) => !catalogCodes.includes(code)).sort((a, b) => a.localeCompare(b)),
)

const dirty = computed(() => JSON.stringify([...selected.value].sort()) !== savedSnapshot.value)

function normalizePermissions(list) {
  return Array.from(new Set((Array.isArray(list) ? list : []).map((item) => String(item)).filter(Boolean))).sort()
}

function applyRolePermissions(role) {
  const next = normalizePermissions(role?.permissions)
  selected.value = next
  savedSnapshot.value = JSON.stringify(next)
}

async function loadRoles() {
  loading.value = true
  try {
    const records = []
    let page = 1
    let totalPages = 1
    do {
      const data = await fetchRoles({ page, pageSize: 100 })
      const pageRecords = Array.isArray(data?.records) ? data.records : []
      records.push(...pageRecords)
      const total = Number(data?.total)
      const size = Number(data?.pageSize) || 100
      totalPages = Number.isFinite(total) && total > 0 ? Math.ceil(total / size) : 1
      page += 1
    } while (page <= totalPages && page <= 20)

    roles.value = records
    if (!records.some((item) => String(item.id) === String(roleId.value))) {
      roleId.value = records[0] ? String(records[0].id) : ''
    }
    applyRolePermissions(currentRole.value)
  } catch {
    roles.value = []
    roleId.value = ''
    selected.value = []
    savedSnapshot.value = '[]'
  } finally {
    loading.value = false
  }
}

function isChecked(code) {
  return selected.value.includes(code)
}

function toggleCode(code, checked) {
  if (checked) {
    if (selected.value.includes(code)) return
    if (selected.value.length >= MAX_ROLE_PERMISSIONS) {
      ElMessage.warning(t('system.permTooMany', { max: MAX_ROLE_PERMISSIONS }))
      return
    }
    selected.value = [...selected.value, code]
    return
  }
  selected.value = selected.value.filter((item) => item !== code)
}

function toggleGroup(group, checked) {
  const codes = group.items.map((item) => item.code)
  if (checked) {
    const merged = normalizePermissions([...selected.value, ...codes])
    if (merged.length > MAX_ROLE_PERMISSIONS) {
      ElMessage.warning(t('system.permTooMany', { max: MAX_ROLE_PERMISSIONS }))
      return
    }
    selected.value = merged
    return
  }
  selected.value = selected.value.filter((code) => !codes.includes(code))
}

function groupCheckedCount(group) {
  return group.items.filter((item) => selected.value.includes(item.code)).length
}

function groupAllChecked(group) {
  return group.items.length > 0 && groupCheckedCount(group) === group.items.length
}

function groupPartial(group) {
  const count = groupCheckedCount(group)
  return count > 0 && count < group.items.length
}

function resetCurrent() {
  applyRolePermissions(currentRole.value)
}

async function savePermissions() {
  if (!currentRole.value) return
  if (selected.value.length > MAX_ROLE_PERMISSIONS) {
    ElMessage.warning(t('system.permTooMany', { max: MAX_ROLE_PERMISSIONS }))
    return
  }

  saving.value = true
  try {
    const permissions = normalizePermissions(selected.value)
    const data = await updateRolePermissions(currentRole.value.id, permissions)
    const saved = normalizePermissions(Array.isArray(data) ? data : permissions)
    selected.value = saved
    savedSnapshot.value = JSON.stringify(saved)
    const index = roles.value.findIndex((item) => String(item.id) === String(currentRole.value.id))
    if (index >= 0) {
      roles.value[index] = { ...roles.value[index], permissions: saved }
    }
    ElMessage.success(t('system.permSaved'))
  } catch {
    // request interceptor already shows message
  } finally {
    saving.value = false
  }
}

watch(roleId, () => {
  applyRolePermissions(currentRole.value)
})

onMounted(loadRoles)
</script>

<template>
  <section class="panel">
    <header>
      <div>
        <h1>{{ t('system.permission') }}</h1>
        <p class="hint">{{ t('system.permHint') }}</p>
      </div>
      <div class="toolbar">
        <el-select
          v-model="roleId"
          class="role-select"
          filterable
          :disabled="loading || !roles.length"
          :placeholder="t('system.permSelectRole')"
          popper-class="system-select-dropdown"
        >
          <el-option
            v-for="option in roleOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <button type="button" class="ghost" :disabled="!dirty || saving" @click="resetCurrent">
          {{ t('system.reset') }}
        </button>
        <button type="button" class="primary" :disabled="!dirty || saving || !currentRole" @click="savePermissions">
          {{ t('system.save') }}
        </button>
      </div>
    </header>

    <div v-if="loading" class="state">{{ t('system.loading') }}</div>
    <div v-else-if="!roles.length" class="state">{{ t('system.roleEmpty') }}</div>
    <template v-else>
      <div v-if="dirty" class="meta">
        <em>{{ t('system.permDirty') }}</em>
      </div>

      <div class="groups">
        <section v-for="group in permissionCatalog" :key="group.id" class="group">
          <header class="group-head">
            <label class="check">
              <input
                type="checkbox"
                :checked="groupAllChecked(group)"
                :indeterminate.prop="groupPartial(group)"
                @change="toggleGroup(group, $event.target.checked)"
              />
              <span>{{ t(group.nameKey) }}</span>
            </label>
            <small>{{ groupCheckedCount(group) }}/{{ group.items.length }}</small>
          </header>
          <div class="items">
            <label v-for="item in group.items" :key="item.code" class="item" :class="{ 'is-on': isChecked(item.code) }">
              <input
                type="checkbox"
                :checked="isChecked(item.code)"
                @change="toggleCode(item.code, $event.target.checked)"
              />
              <div>
                <strong>{{ t(item.nameKey) }}</strong>
                <code>{{ item.code }}</code>
                <p v-if="item.tipKey">{{ t(item.tipKey) }}</p>
              </div>
            </label>
          </div>
        </section>

        <section v-if="unknownCodes.length" class="group unknown">
          <header class="group-head">
            <span>{{ t('system.permUnknown') }}</span>
            <small>{{ unknownCodes.length }}</small>
          </header>
          <div class="items">
            <label v-for="code in unknownCodes" :key="code" class="item is-on">
              <input type="checkbox" checked @change="toggleCode(code, $event.target.checked)" />
              <div>
                <strong>{{ code }}</strong>
                <p>{{ t('system.permUnknownTip') }}</p>
              </div>
            </label>
          </div>
        </section>
      </div>

      <p class="note">{{ t('system.permNote') }}</p>
    </template>
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
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 14px;
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
  margin-top: 16px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

.role-select {
  width: min(280px, 70vw);
}

.role-select :deep(.el-select__wrapper) {
  min-height: 36px;
  border-radius: 8px;
  background: rgba(3, 18, 14, 0.72);
  box-shadow: 0 0 0 1px rgba(140, 220, 175, 0.32) inset;
}

.role-select :deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 1px #3dce7c inset, 0 0 0 3px rgba(61, 206, 124, 0.16);
}

.role-select :deep(.el-select__placeholder),
.role-select :deep(.el-select__selected-item),
.role-select :deep(.el-select__caret) {
  color: #f3fff8;
}

.ghost,
.primary {
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

.state {
  padding: 48px 12px;
  color: rgba(214, 245, 228, 0.62);
  text-align: center;
}

.meta {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
  color: rgba(214, 245, 228, 0.72);
  font-size: 13px;
}

.meta em {
  padding: 2px 8px;
  border-radius: 999px;
  color: #8dffc8;
  background: rgba(60, 200, 140, 0.16);
  font-style: normal;
}

.groups {
  display: grid;
  gap: 12px;
}

.group {
  border: 1px solid rgba(140, 220, 175, 0.16);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(8, 36, 28, 0.55), rgba(4, 22, 17, 0.72));
  overflow: hidden;
}

.group-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(140, 220, 175, 0.12);
  background: rgba(3, 18, 14, 0.35);
}

.group-head small {
  color: rgba(214, 245, 228, 0.55);
}

.items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
  padding: 12px 14px 14px;
}

.item,
.check {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  cursor: pointer;
  user-select: none;
}

.check {
  align-items: center;
}

.item {
  min-height: 74px;
  padding: 12px;
  border: 1px solid rgba(140, 220, 175, 0.14);
  border-radius: 12px;
  background: rgba(3, 18, 14, 0.42);
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.item:hover {
  border-color: rgba(140, 220, 175, 0.36);
  background: rgba(4, 26, 20, 0.62);
}

.item.is-on {
  border-color: rgba(61, 206, 124, 0.48);
  background: rgba(47, 191, 106, 0.14);
  box-shadow: inset 0 0 0 1px rgba(61, 206, 124, 0.12);
}

.item strong,
.check span {
  color: #f3fff8;
  font-weight: 600;
}

.item code {
  display: inline-block;
  margin-top: 4px;
  padding: 1px 6px;
  border-radius: 6px;
  color: #8dffc8;
  background: rgba(60, 200, 140, 0.12);
  font-size: 12px;
}

.item p {
  margin: 6px 0 0;
  color: rgba(214, 245, 228, 0.58);
  font-size: 12px;
  line-height: 1.45;
}

input[type='checkbox'] {
  appearance: none;
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  margin: 1px 0 0;
  flex: none;
  border: 1px solid rgba(140, 220, 175, 0.42);
  border-radius: 5px;
  background: rgba(3, 18, 14, 0.88);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.18);
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  position: relative;
  cursor: pointer;
}

input[type='checkbox']:hover {
  border-color: rgba(140, 220, 175, 0.72);
  background: rgba(6, 32, 24, 0.96);
}

input[type='checkbox']:focus-visible {
  outline: none;
  box-shadow: 0 0 0 1px #3dce7c inset, 0 0 0 3px rgba(61, 206, 124, 0.18);
}

input[type='checkbox']::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.12s ease;
}

input[type='checkbox']:checked {
  border-color: transparent;
  background: linear-gradient(180deg, #8cf0ae, #2fbf6a);
  box-shadow: 0 0 0 1px rgba(61, 206, 124, 0.28);
}

input[type='checkbox']:checked::after {
  opacity: 1;
  inset: 3px 5px 5px 4px;
  border: solid #042117;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
  background: transparent;
}

input[type='checkbox']:indeterminate {
  border-color: transparent;
  background: linear-gradient(180deg, #8cf0ae, #2fbf6a);
  box-shadow: 0 0 0 1px rgba(61, 206, 124, 0.28);
}

input[type='checkbox']:indeterminate::after {
  opacity: 1;
  inset: 8px 4px 7px;
  border: 0;
  border-radius: 1px;
  background: #042117;
  transform: none;
}

.unknown .group-head span {
  color: #f3fff8;
  font-weight: 600;
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  header {
    flex-direction: column;
  }

  .toolbar {
    width: 100%;
    justify-content: stretch;
  }

  .role-select {
    width: 100%;
  }
}
</style>
