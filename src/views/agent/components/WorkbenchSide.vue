<script setup>
import { ElMessage } from 'element-plus'
import SessionList from './SessionList.vue'

defineProps({
  collapsed: { type: Boolean, default: false },
  sessions: { type: Array, required: true },
  activeId: { type: Number, default: null },
})

const emit = defineEmits(['toggle', 'create', 'select'])

function pending(name) {
  ElMessage.info(`${name}暂未开放`)
}
</script>

<template>
  <aside class="side" :class="{ 'is-collapsed': collapsed }">
    <header class="side-head">
      <strong v-if="!collapsed">智能工作台</strong>
      <button type="button" class="icon" title="收起侧栏" @click="emit('toggle')">
        {{ collapsed ? '›' : '‹' }}
      </button>
    </header>

    <template v-if="!collapsed">
      <button type="button" class="create" @click="emit('create')">+ 新建会话</button>
      <div class="tools">
        <button type="button" @click="pending('模型管理')">模型管理</button>
        <button type="button" @click="pending('文件管理')">文件管理</button>
      </div>
      <SessionList :sessions="sessions" :active-id="activeId" @select="emit('select', $event)" />
    </template>
  </aside>
</template>

<style scoped>
.side {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
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
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.side-head strong {
  font-size: 18px;
  letter-spacing: 0.04em;
}

.icon,
.tools button,
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
  height: 44px;
  border: none;
  border-radius: 12px;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font-size: 16px;
  font-weight: 700;
}

.tools {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.tools button {
  height: 40px;
  border-radius: 12px;
}
</style>
