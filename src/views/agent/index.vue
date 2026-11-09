<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import WorkbenchSide from './components/WorkbenchSide.vue'
import ChatStage from './components/ChatStage.vue'
import ChatComposer from './components/ChatComposer.vue'
import { createSessions } from './sessions.js'
import { createPlotForm, plotChoice, plotResult } from './plot.js'
import { t } from '@/i18n'

const sessions = ref(createSessions())
const activeId = ref(7)
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
    ElMessage.warning(t('chat.needQuestion'))
    return
  }
  if (!activeId.value) {
    const session = { id: Date.now(), title: content.slice(0, 18), messages: [] }
    sessions.value.unshift(session)
    activeId.value = session.id
  }
  const session = sessions.value.find((item) => item.id === activeId.value)
  session.messages.push({ id: Date.now(), role: 'user', content })
  if (/田块提取|田块分割|免拼接|field extraction|extract fields|stitch-free|field segment/i.test(content)) {
    session.messages.push(
      { id: Date.now() + 1, role: 'assistant', textKey: 'chat.plotIntro' },
      { id: Date.now() + 2, role: 'assistant', type: 'plot', form: createPlotForm(), done: false },
    )
  } else {
    session.messages.push({
      id: Date.now() + 1,
      role: 'assistant',
      textKey: mode.value === 'expert' ? 'chat.expertReply' : 'chat.normalReply',
      params: { content },
    })
  }
  draft.value = ''
}

function findMessage(id) {
  for (const session of sessions.value) {
    const message = session.messages.find((item) => item.id === id)
    if (message) return { session, message }
  }
  return null
}

function updatePlot(id, patch) {
  const found = findMessage(id)
  if (found && !found.message.done) Object.assign(found.message.form, patch)
}

function runPlot(id) {
  const found = findMessage(id)
  if (!found || found.message.done) return
  found.message.done = true
  const now = Date.now()
  found.session.messages.push(
    { id: now, role: 'user', ...plotChoice(found.message.form) },
    { id: now + 1, role: 'assistant', type: 'result', result: plotResult(found.message.form) },
  )
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
      <ChatStage
        :messages="messages"
        @create="createSession"
        @expand="collapsed = !collapsed"
        @plot-update="updatePlot"
        @plot-run="runPlot"
      />
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
