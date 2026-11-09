<script setup>
import { t } from '@/i18n'

defineProps({
  sessions: { type: Array, required: true },
  activeId: { type: Number, default: null },
})

defineEmits(['select'])
</script>

<template>
  <section class="history">
    <p class="label">{{ t('agent.recent') }}</p>
    <ul>
      <li v-for="item in sessions" :key="item.id">
        <button type="button" :class="{ 'is-active': item.id === activeId }" @click="$emit('select', item.id)">
          {{ item.titleKey ? t(item.titleKey) : item.title }}
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.history {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.label {
  margin: 0 0 10px;
  color: rgba(190, 230, 210, 0.62);
  font-size: 13px;
}

ul {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0 4px 0 0;
  overflow: auto;
  list-style: none;
}

button {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid rgba(140, 220, 175, 0.16);
  border-radius: 10px;
  color: #e7fff4;
  background: rgba(3, 18, 14, 0.45);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

button:hover,
button.is-active {
  border-color: rgba(120, 235, 175, 0.7);
  box-shadow: 0 0 12px rgba(60, 210, 140, 0.18);
}
</style>
