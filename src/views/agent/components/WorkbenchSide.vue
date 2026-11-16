<script setup>
import SessionList from './SessionList.vue'
import { t } from '@/i18n'

defineProps({
  collapsed: { type: Boolean, default: false },
  sessions: { type: Array, required: true },
  activeId: { type: String, default: null },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['toggle', 'create', 'select', 'rename', 'delete'])
</script>

<template>
  <aside class="side" :class="{ 'is-collapsed': collapsed }">
    <header class="side-head">
      <strong v-if="!collapsed">{{ t('agent.workbench') }}</strong>
      <button type="button" class="icon" :title="collapsed ? t('agent.expand') : t('agent.collapse')" @click="emit('toggle')">
        {{ collapsed ? '›' : '‹' }}
      </button>
    </header>

    <template v-if="!collapsed">
      <button type="button" class="create" @click="emit('create')">{{ t('agent.newSession') }}</button>
      <SessionList
        :sessions="sessions"
        :active-id="activeId"
        :loading="loading"
        @select="emit('select', $event)"
        @rename="emit('rename', $event)"
        @delete="emit('delete', $event)"
      />
    </template>
  </aside>
</template>

<style scoped>
.side {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  padding: 16px 14px;
  border-right: 1px solid rgba(140, 220, 175, 0.16);
  background: rgba(3, 22, 16, 0.72);
}

.side.is-collapsed {
  align-items: center;
  padding: 16px 8px;
}

.side-head {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.side-head strong {
  font-size: 18px;
  letter-spacing: 0.04em;
}

.icon,
.create {
  border: 1px solid rgba(140, 220, 175, 0.28);
  color: #e7fff4;
  background: rgba(8, 36, 28, 0.55);
  font: inherit;
  cursor: pointer;
}

.icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
}

.create {
  flex: 0 0 auto;
  height: 44px;
  border: none;
  border-radius: 12px;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font-size: 16px;
  font-weight: 700;
}
</style>
