<script setup>
import { t } from '@/i18n'

defineProps({
  active: { type: String, required: true },
})

defineEmits(['change'])

const items = [
  { id: 'role', key: 'system.role' },
  { id: 'user', key: 'system.user' },
  { id: 'permission', key: 'system.permission' },
  { id: 'service', key: 'system.service' },
  { id: 'log', key: 'system.log' },
]
</script>

<template>
  <nav class="nav" :aria-label="t('system.aria')">
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      :class="{ 'is-active': item.id === active }"
      @click="$emit('change', item.id)"
    >
      {{ t(item.key) }}
    </button>
  </nav>
</template>

<style scoped>
.nav {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 14px;
  overflow: auto;
  border-right: 1px solid rgba(140, 220, 175, 0.16);
  background: rgba(3, 22, 16, 0.72);
}

button {
  height: 42px;
  border: 1px solid rgba(140, 220, 175, 0.2);
  border-radius: 10px;
  color: #e7fff4;
  background: rgba(3, 18, 14, 0.45);
  font: inherit;
  cursor: pointer;
}

button.is-active {
  border-color: transparent;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
}
</style>
