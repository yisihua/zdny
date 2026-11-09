<script setup>
import { ref, watch } from 'vue'
import { permissionActions, permissionModules } from '../data.js'
import { t } from '@/i18n'

const props = defineProps({
  roles: { type: Array, required: true },
  grants: { type: Object, required: true },
})

const emit = defineEmits(['toggle'])
const roleId = ref(props.roles[0]?.id || '')

watch(
  () => props.roles.map((item) => item.id).join(','),
  () => {
    if (!props.roles.some((item) => item.id === roleId.value)) roleId.value = props.roles[0]?.id || ''
  },
)

function allowed(moduleId, actionId) {
  return props.grants[roleId.value]?.[moduleId]?.includes(actionId)
}

function onToggle(moduleId, actionId, event) {
  emit('toggle', roleId.value, moduleId, actionId, event.target.checked)
}
</script>

<template>
  <section class="panel">
    <header>
      <h1>{{ t('system.permission') }}</h1>
      <select v-model="roleId">
        <option v-for="role in roles" :key="role.id" :value="role.id">{{ role.nameKey ? t(role.nameKey) : role.name }}</option>
      </select>
    </header>
    <table>
      <thead>
        <tr>
          <th>{{ t('system.module') }}</th>
          <th v-for="action in permissionActions" :key="action.id">{{ t(action.nameKey) }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in permissionModules" :key="item.id">
          <td>{{ t(item.nameKey) }}</td>
          <td v-for="action in permissionActions" :key="action.id">
            <input
              type="checkbox"
              :checked="allowed(item.id, action.id)"
              :disabled="roleId === 'super'"
              @change="onToggle(item.id, action.id, $event)"
            />
          </td>
        </tr>
      </tbody>
    </table>
    <p class="note">{{ t('system.permNote') }}</p>
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
  margin-bottom: 16px;
}

h1 {
  margin: 0;
  font-size: 20px;
}

select {
  height: 36px;
  padding: 0 10px;
  border: 1px solid rgba(140, 220, 175, 0.32);
  border-radius: 8px;
  color: #f3fff8;
  background: rgba(3, 18, 14, 0.55);
  font: inherit;
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

input {
  width: 16px;
  height: 16px;
  accent-color: #2fbf6a;
}

.note {
  margin: 12px 0 0;
  color: rgba(214, 245, 228, 0.55);
  font-size: 13px;
}
</style>
