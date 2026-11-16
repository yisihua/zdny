<script setup>
import { t } from '@/i18n'

defineProps({
  sessions: { type: Array, required: true },
  activeId: { type: String, default: null },
  loading: { type: Boolean, default: false },
})

defineEmits(['select', 'rename', 'delete'])
</script>

<template>
  <section class="history">
    <p class="label">{{ t('agent.recent') }}</p>
    <div v-if="loading" class="state">{{ t('system.loading') }}</div>
    <div v-else-if="!sessions.length" class="state">{{ t('agent.sessionEmpty') }}</div>
    <ul v-else>
      <li v-for="item in sessions" :key="item.id">
        <button
          type="button"
          class="session"
          :class="{ 'is-active': item.id === activeId }"
          @click="$emit('select', item.id)"
        >
          <span>{{ item.title }}</span>
        </button>
        <div class="actions">
          <button type="button" :title="t('agent.rename')" @click.stop="$emit('rename', item)">{{ t('agent.rename') }}</button>
          <button type="button" :title="t('agent.delete')" @click.stop="$emit('delete', item)">{{ t('system.remove') }}</button>
        </div>
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
  overflow: hidden;
}

.label {
  flex: 0 0 auto;
  margin: 0 0 10px;
  color: rgba(190, 230, 210, 0.62);
  font-size: 13px;
}

.state {
  padding: 18px 8px;
  color: rgba(214, 245, 228, 0.55);
  font-size: 13px;
  text-align: center;
}

ul {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0 6px 0 0;
  overflow-x: hidden;
  overflow-y: auto;
  list-style: none;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 210, 160, 0.55) rgba(3, 18, 14, 0.35);
}

ul::-webkit-scrollbar {
  width: 8px;
}

ul::-webkit-scrollbar-track {
  border-radius: 8px;
  background: rgba(3, 18, 14, 0.35);
}

ul::-webkit-scrollbar-thumb {
  border-radius: 8px;
  background: rgba(120, 210, 160, 0.45);
}

ul::-webkit-scrollbar-thumb:hover {
  background: rgba(140, 235, 180, 0.7);
}

li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
  align-items: stretch;
}

.session {
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

.session span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.session:hover,
.session.is-active {
  border-color: rgba(120, 235, 175, 0.7);
  box-shadow: 0 0 12px rgba(60, 210, 140, 0.18);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.actions button {
  height: 28px;
  padding: 0 8px;
  border: 1px solid rgba(140, 220, 175, 0.2);
  border-radius: 8px;
  color: rgba(214, 245, 228, 0.78);
  background: rgba(3, 18, 14, 0.45);
  font-size: 12px;
  cursor: pointer;
}

.actions button:hover {
  color: #8dffc8;
  border-color: rgba(140, 220, 175, 0.45);
}
</style>
