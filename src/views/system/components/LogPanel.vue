<script setup>
import { computed, ref } from 'vue'
import { formatMessage, t } from '@/i18n'

const props = defineProps({
  logs: { type: Array, required: true },
})

const keyword = ref('')

function logText(item) {
  return formatMessage({ textKey: item.actionKey, params: item.params })
}

const filtered = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return props.logs
  return props.logs.filter((item) =>
    [item.account, t(item.moduleKey), logText(item), t(item.resultKey)].some((field) => String(field).toLowerCase().includes(text)),
  )
})
</script>

<template>
  <section class="panel">
    <header>
      <h1>{{ t('system.log') }}</h1>
      <input v-model="keyword" maxlength="40" :placeholder="t('system.logSearch')" />
    </header>
    <table>
      <thead>
        <tr>
          <th>{{ t('system.logTime') }}</th>
          <th>{{ t('system.logAccount') }}</th>
          <th>{{ t('system.logModule') }}</th>
          <th>{{ t('system.logAction') }}</th>
          <th>{{ t('system.logResult') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in filtered" :key="item.id">
          <td>{{ item.time }}</td>
          <td>{{ item.account }}</td>
          <td>{{ t(item.moduleKey) }}</td>
          <td>{{ logText(item) }}</td>
          <td :class="item.resultKey === 'log.ok' ? 'ok' : 'deny'">{{ t(item.resultKey) }}</td>
        </tr>
        <tr v-if="!filtered.length">
          <td class="empty" colspan="5">{{ t('system.logEmpty') }}</td>
        </tr>
      </tbody>
    </table>
    <p class="note">{{ t('system.logNote') }}</p>
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

input {
  width: min(280px, 100%);
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

.ok {
  color: #8dffc8;
}

.deny {
  color: #ffd38a;
}

.empty,
.note {
  color: rgba(214, 245, 228, 0.55);
}

.note {
  margin: 12px 0 0;
  font-size: 13px;
}
</style>
