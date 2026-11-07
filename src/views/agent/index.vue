<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import WorkbenchSide from './components/WorkbenchSide.vue'
import ChatStage from './components/ChatStage.vue'
import ChatComposer from './components/ChatComposer.vue'
import { createSessions } from './sessions.js'

const sessions = ref(createSessions())
const activeId = ref(null)
const collapsed = ref(false)
const mode = ref('normal')
const draft = ref('')

const messages = computed(() => sessions.value.find((item) => item.id === activeId.value)?.messages || [])

function createSession() {
  activeId.value = null
  draft.value = ''
}

function send(text) {
  const content = text.trim()
  if (!content) {
    ElMessage.warning('请输入问题')
    return
  }
  if (!activeId.value) {
    const session = { id: Date.now(), title: content.slice(0, 18), messages: [] }
    sessions.value.unshift(session)
    activeId.value = session.id
  }
  const session = sessions.value.find((item) => item.id === activeId.value)
  const reply = mode.value === 'expert'
    ? `已按专家模式记录：「${content}」。当前为演示会话，模型服务尚未接入。`
    : `已收到：「${content}」。当前为演示会话，将以对话形式返回结果。`
  session.messages.push({ id: Date.now(), role: 'user', content }, { id: Date.now() + 1, role: 'assistant', content: reply })
  draft.value = ''
}
</script>

<template>
  <div class="workbench" :class="{ 'is-collapsed': collapsed }">
    <WorkbenchSide
      :collapsed="collapsed"
      :sessions="sessions"
      :active-id="activeId"
      @toggle="collapsed = !collapsed"
      @create="createSession"
      @select="activeId = $event"
    />
    <section class="chat">
      <ChatStage :messages="messages" @create="createSession" @expand="collapsed = !collapsed" />
      <ChatComposer v-model="draft" v-model:mode="mode" @send="send" />
    </section>
  </div>
</template>

<style scoped>
.workbench {
  display: grid;
  grid-template-columns: 292px minmax(0, 1fr);
  height: calc(100vh - 104px);
  min-height: 560px;
  overflow: hidden;
  border: 1px solid rgba(140, 220, 175, 0.2);
  border-radius: 16px;
  background: rgba(4, 20, 15, 0.72);
  box-shadow: inset 0 0 40px rgba(30, 120, 80, 0.08);
}

.workbench.is-collapsed {
  grid-template-columns: 52px minmax(0, 1fr);
}

.chat {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.chat > :first-child {
  flex: 1;
}
</style>
