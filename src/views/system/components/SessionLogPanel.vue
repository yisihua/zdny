<script setup>
import { computed, onMounted, ref } from 'vue'
import { ArrowLeft, FolderOpened, Files } from '@element-plus/icons-vue'
import {
  MESSAGE_TYPE_SYSTEM,
  MESSAGE_TYPE_USER,
  fetchSessionMessages,
  fetchSessions,
} from '@/api/session'
import {
  parseAlgorithmGroupMessage,
  parseWorkflowOutputsMessage,
  parseWorkflowRunMessage,
} from '@/api/llmChat'
import {
  UNGROUPED_ID,
  buildSessionSections,
  readSessionGroupStore,
} from '@/views/agent/sessionGroups.js'
import { t } from '@/i18n'

const loading = ref(false)
const loadingMessages = ref(false)
const sessions = ref([])
const messages = ref([])
const groupStore = ref(readSessionGroupStore())
const activeGroupId = ref(null)
const activeSession = ref(null)

const sections = computed(() => buildSessionSections(sessions.value, groupStore.value, []))

const cards = computed(() =>
  sections.value.map((section) => ({
    id: section.id,
    name: section.nameKey ? t(section.nameKey) : section.name,
    count: section.sessions.length,
    sessions: section.sessions,
    isUngrouped: section.id === UNGROUPED_ID,
  })),
)

const activeCard = computed(() => cards.value.find((item) => item.id === activeGroupId.value) || null)

const view = computed(() => {
  if (activeSession.value) return 'messages'
  if (activeCard.value) return 'sessions'
  return 'groups'
})

function formatTime(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').replace(/\.\d+.*/, '').replace(/([+-]\d{2}:\d{2}|Z)$/, '')
}

function summarizeContent(raw, messageType) {
  const text = String(raw || '').trim()
  if (!text) return t('system.sessionLogMsgEmpty')

  if (Number(messageType) === MESSAGE_TYPE_SYSTEM) {
    const group = parseAlgorithmGroupMessage(text)
    if (group) {
      return t('system.sessionLogMsgWorkflow', { name: group.name || group.algorithm?.name || '-' })
    }
    const outputs = parseWorkflowOutputsMessage(text)
    if (outputs) {
      return t('system.sessionLogMsgOutputs', { n: outputs.length })
    }
    const run = parseWorkflowRunMessage(text)
    if (run) return run.text || t('system.sessionLogMsgRun')
  }

  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object') {
        if (parsed.text) return String(parsed.text)
        if (parsed.content) return String(parsed.content)
        return JSON.stringify(parsed, null, 2)
      }
    } catch {
      // plain text
    }
  }
  return text
}

function toViewMessage(item) {
  const type = Number(item.messageType)
  return {
    id: String(item.id),
    role: type === MESSAGE_TYPE_USER ? 'user' : 'assistant',
    roleLabel: type === MESSAGE_TYPE_USER ? t('system.sessionLogRoleUser') : t('system.sessionLogRoleAssistant'),
    content: summarizeContent(item.content, type),
    createdAt: item.createdAt || null,
    rawType: type,
  }
}

async function loadSessions() {
  loading.value = true
  try {
    groupStore.value = readSessionGroupStore()
    const records = []
    let page = 1
    let totalPages = 1
    do {
      const data = await fetchSessions({ page, pageSize: 50 })
      const pageRecords = Array.isArray(data?.records) ? data.records : []
      records.push(...pageRecords)
      const total = Number(data?.total)
      const size = Number(data?.pageSize) || 50
      totalPages = Number.isFinite(total) && total > 0 ? Math.ceil(total / size) : 1
      page += 1
    } while (page <= totalPages && page <= 20)

    sessions.value = records.map((item) => ({
      id: String(item.id),
      title: item.title || t('agent.newTitle'),
      createdAt: item.createdAt || null,
      updatedAt: item.updatedAt || null,
    }))
  } catch {
    sessions.value = []
  } finally {
    loading.value = false
  }
}

async function loadMessages(sessionId) {
  loadingMessages.value = true
  messages.value = []
  try {
    const map = new Map()
    let page = 1
    let totalPages = 1
    do {
      const data = await fetchSessionMessages(sessionId, { page, pageSize: 50 })
      const pageRecords = Array.isArray(data?.records) ? data.records : []
      pageRecords.forEach((item) => {
        const ui = toViewMessage(item)
        map.set(ui.id, ui)
      })
      const total = Number(data?.total)
      const size = Number(data?.pageSize) || 50
      totalPages = Number.isFinite(total) && total > 0 ? Math.ceil(total / size) : 1
      page += 1
    } while (page <= totalPages && page <= 40)

    messages.value = Array.from(map.values()).sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
      if (ta !== tb) return ta - tb
      return String(a.id).localeCompare(String(b.id))
    })
  } catch {
    messages.value = []
  } finally {
    loadingMessages.value = false
  }
}

function openGroup(card) {
  activeGroupId.value = card.id
  activeSession.value = null
  messages.value = []
}

function openSession(item) {
  activeSession.value = item
  loadMessages(item.id)
}

function back() {
  if (activeSession.value) {
    activeSession.value = null
    messages.value = []
    return
  }
  activeGroupId.value = null
}

onMounted(loadSessions)
</script>

<template>
  <section class="panel">
    <header v-if="view === 'groups'">
      <div>
        <h1>{{ t('system.sessionLog') }}</h1>
        <p class="hint">{{ t('system.sessionLogHint') }}</p>
      </div>
      <button type="button" class="ghost" :disabled="loading" @click="loadSessions">
        {{ loading ? t('system.loading') : t('system.resourceRefresh') }}
      </button>
    </header>

    <header v-else class="detail-head">
      <button type="button" class="back" :title="view === 'messages' ? t('system.sessionLogBackSessions') : t('system.sessionLogBack')" @click="back">
        <el-icon :size="18"><ArrowLeft /></el-icon>
        <span>{{ view === 'messages' ? t('system.sessionLogBackSessions') : t('system.sessionLogBack') }}</span>
      </button>
      <div class="detail-title">
        <h1 :title="view === 'messages' ? activeSession.title : activeCard.name">
          {{ view === 'messages' ? activeSession.title : activeCard.name }}
        </h1>
        <p class="hint">
          <template v-if="view === 'messages'">
            {{ t('system.sessionLogMsgCount', { n: messages.length }) }}
          </template>
          <template v-else>
            {{ t('system.sessionLogCount', { n: activeCard.count }) }}
          </template>
        </p>
      </div>
    </header>

    <div v-if="loading && !sessions.length" class="state">{{ t('system.loading') }}</div>

    <div v-else-if="view === 'groups'" class="cards">
      <button
        v-for="card in cards"
        :key="card.id || 'ungrouped'"
        type="button"
        class="card"
        :class="{ 'is-empty': !card.count, 'is-ungrouped': card.isUngrouped }"
        @click="openGroup(card)"
      >
        <div class="card-icon">
          <el-icon :size="28">
            <FolderOpened v-if="!card.isUngrouped" />
            <Files v-else />
          </el-icon>
        </div>
        <strong>{{ card.name }}</strong>
        <em>{{ t('system.sessionLogCount', { n: card.count }) }}</em>
        <span>{{ t('system.sessionLogEnter') }}</span>
      </button>
      <div v-if="!cards.length" class="state">{{ t('system.sessionLogEmpty') }}</div>
    </div>

    <div v-else-if="view === 'sessions'" class="detail">
      <div v-if="!activeCard.sessions.length" class="state">{{ t('system.sessionLogSessionEmpty') }}</div>
      <div v-else class="session-grid">
        <button
          v-for="item in activeCard.sessions"
          :key="item.id"
          type="button"
          class="session-card"
          @click="openSession(item)"
        >
          <strong :title="item.title">{{ item.title }}</strong>
          <dl>
            <div>
              <dt>ID</dt>
              <dd>{{ item.id }}</dd>
            </div>
            <div>
              <dt>{{ t('system.createdAt') }}</dt>
              <dd>{{ formatTime(item.createdAt) }}</dd>
            </div>
            <div>
              <dt>{{ t('system.updatedAt') }}</dt>
              <dd>{{ formatTime(item.updatedAt) }}</dd>
            </div>
          </dl>
          <span>{{ t('system.sessionLogOpenChat') }}</span>
        </button>
      </div>
    </div>

    <div v-else class="chat">
      <div v-if="loadingMessages" class="state">{{ t('system.loading') }}</div>
      <div v-else-if="!messages.length" class="state">{{ t('system.sessionLogChatEmpty') }}</div>
      <div v-else class="timeline">
        <article
          v-for="item in messages"
          :key="item.id"
          class="bubble"
          :class="item.role"
        >
          <header>
            <em>{{ item.roleLabel }}</em>
            <time>{{ formatTime(item.createdAt) }}</time>
          </header>
          <pre>{{ item.content }}</pre>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  padding: 18px 20px;
  overflow: hidden;
}

header {
  display: flex;
  flex: 0 0 auto;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.detail-head {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 16px;
}

.detail-title {
  min-width: 0;
  width: 100%;
}

h1 {
  margin: 0 0 4px;
  font-size: 20px;
  line-height: 1.3;
}

.detail-title h1 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hint {
  margin: 0;
  color: rgba(214, 245, 228, 0.62);
  font-size: 13px;
  line-height: 1.4;
}

.ghost {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  height: 36px;
  padding: 0 14px;
  border: 1px solid rgba(140, 220, 175, 0.32);
  border-radius: 8px;
  color: #f3fff8;
  background: rgba(3, 18, 14, 0.55);
  font: inherit;
  cursor: pointer;
}

.ghost:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.back {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 4px;
  align-items: center;
  height: 28px;
  padding: 0 10px 0 6px;
  border: 1px solid rgba(140, 220, 175, 0.22);
  border-radius: 999px;
  color: rgba(214, 245, 228, 0.88);
  background: rgba(3, 18, 14, 0.4);
  font: inherit;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.back:hover {
  border-color: rgba(140, 240, 174, 0.45);
  color: #edfff6;
  background: rgba(8, 36, 28, 0.72);
}

.back .el-icon {
  margin-top: 1px;
}

.state {
  padding: 48px 12px;
  color: rgba(214, 245, 228, 0.62);
  text-align: center;
}

.cards,
.detail,
.chat,
.timeline {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 6px 4px 10px;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
  align-content: start;
}

.card {
  position: relative;
  z-index: 0;
  display: grid;
  gap: 10px;
  justify-items: start;
  min-height: 168px;
  padding: 18px 16px;
  border: 1px solid rgba(140, 220, 175, 0.18);
  border-radius: 16px;
  color: #edfff6;
  background:
    radial-gradient(120% 90% at 0% 0%, rgba(70, 210, 150, 0.14), transparent 55%),
    linear-gradient(180deg, rgba(8, 36, 28, 0.7), rgba(4, 22, 17, 0.88));
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.card:hover,
.session-card:hover {
  z-index: 2;
  border-color: rgba(140, 240, 174, 0.5);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.28);
}

.card.is-ungrouped {
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(94, 200, 232, 0.12), transparent 55%),
    linear-gradient(180deg, rgba(8, 36, 28, 0.7), rgba(4, 22, 17, 0.88));
}

.card.is-empty {
  opacity: 0.78;
}

.card-icon {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 14px;
  color: #042117;
  background: linear-gradient(180deg, #8cf0ae, #2fbf6a);
}

.card.is-ungrouped .card-icon {
  background: linear-gradient(180deg, #7ad7f0, #3aa0c8);
}

.card strong {
  font-size: 17px;
  line-height: 1.3;
}

.card em {
  color: rgba(214, 245, 228, 0.72);
  font-style: normal;
  font-size: 13px;
}

.card span,
.session-card > span {
  margin-top: auto;
  color: #8dffc8;
  font-size: 12px;
}

.session-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  align-content: start;
  overflow: visible;
}

.session-card {
  position: relative;
  z-index: 0;
  display: grid;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid rgba(140, 220, 175, 0.16);
  border-radius: 14px;
  color: inherit;
  background: linear-gradient(180deg, rgba(8, 36, 28, 0.55), rgba(4, 22, 17, 0.78));
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.session-card strong {
  overflow: hidden;
  color: #edfff6;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

dl {
  display: grid;
  gap: 8px;
  margin: 0;
}

dl > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: rgba(214, 245, 228, 0.62);
  font-size: 12px;
}

dt {
  margin: 0;
}

dd {
  margin: 0;
  overflow: hidden;
  color: #edfff6;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat {
  display: flex;
  flex-direction: column;
}

.timeline {
  display: grid;
  gap: 12px;
  align-content: start;
  padding-right: 4px;
}

.bubble {
  max-width: min(860px, 100%);
  padding: 12px 14px;
  border: 1px solid rgba(140, 220, 175, 0.16);
  border-radius: 14px;
  background: rgba(3, 18, 14, 0.55);
}

.bubble.user {
  justify-self: end;
  border-color: rgba(140, 240, 174, 0.35);
  background: linear-gradient(180deg, rgba(40, 120, 90, 0.35), rgba(8, 40, 28, 0.72));
}

.bubble.assistant {
  justify-self: start;
}

.bubble > header {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.bubble em {
  color: #8dffc8;
  font-style: normal;
  font-size: 12px;
  font-weight: 700;
}

.bubble time {
  color: rgba(214, 245, 228, 0.5);
  font-size: 12px;
}

.bubble pre {
  margin: 0;
  color: #edfff6;
  font: inherit;
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
