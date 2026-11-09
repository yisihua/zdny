<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { t } from '@/i18n'

const props = defineProps({
  services: { type: Array, required: true },
})

const emit = defineEmits(['add', 'toggle', 'remove'])
const name = ref('')

function submit() {
  const text = name.value.trim()
  if (!text) {
    ElMessage.warning(t('system.serviceRequired'))
    return
  }
  if (props.services.some((item) => (item.nameKey ? t(item.nameKey) : item.name) === text)) {
    ElMessage.warning(t('system.serviceExists'))
    return
  }
  emit('add', text)
  name.value = ''
}
</script>

<template>
  <section class="panel">
    <header>
      <h1>{{ t('system.service') }}</h1>
      <form @submit.prevent="submit">
        <input v-model="name" maxlength="20" :placeholder="t('system.serviceName')" />
        <button type="submit">{{ t('system.add') }}</button>
      </form>
    </header>
    <table>
      <thead>
        <tr>
          <th>{{ t('system.serviceCol') }}</th>
          <th>{{ t('system.code') }}</th>
          <th>{{ t('system.endpoint') }}</th>
          <th>{{ t('system.version') }}</th>
          <th>{{ t('system.status') }}</th>
          <th>{{ t('system.action') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in services" :key="item.id">
          <td>{{ item.nameKey ? t(item.nameKey) : item.name }}<em v-if="item.builtin">{{ t('system.builtin') }}</em></td>
          <td>{{ item.code }}</td>
          <td>{{ item.endpoint }}</td>
          <td>{{ item.version }}</td>
          <td :class="item.running ? 'on' : 'off'">{{ item.running ? t('system.running') : t('system.stopped') }}</td>
          <td class="ops">
            <button type="button" @click="emit('toggle', item.id)">{{ item.running ? t('system.stop') : t('system.start') }}</button>
            <button type="button" :disabled="item.builtin" @click="emit('remove', item.id)">{{ t('system.remove') }}</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="note">{{ t('system.serviceNote') }}</p>
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

form {
  display: flex;
  gap: 8px;
}

input,
button {
  height: 36px;
  border: 1px solid rgba(140, 220, 175, 0.32);
  border-radius: 8px;
  color: #f3fff8;
  background: rgba(3, 18, 14, 0.55);
  font: inherit;
}

form button,
td button {
  padding: 0 14px;
  cursor: pointer;
}

form button {
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

em {
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: 999px;
  color: #8dffc8;
  background: rgba(60, 200, 140, 0.16);
  font-size: 12px;
  font-style: normal;
}

.on {
  color: #8dffc8;
}

.off {
  color: rgba(214, 245, 228, 0.55);
}

.ops {
  display: flex;
  gap: 8px;
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.note {
  margin: 12px 0 0;
  color: rgba(214, 245, 228, 0.55);
  font-size: 13px;
}
</style>
