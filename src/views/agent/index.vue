<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import WorkbenchSide from './components/WorkbenchSide.vue'
import ChatStage from './components/ChatStage.vue'
import ChatComposer from './components/ChatComposer.vue'
import {
  MESSAGE_TYPE_SYSTEM,
  MESSAGE_TYPE_USER,
  createSession as createSessionApi,
  createSessionMessage,
  deleteSession as deleteSessionApi,
  fetchSessionMessages,
  fetchSessions,
  renameSession,
} from '@/api/session'
import {
  llmSessionId,
  parseAlgorithmGroupMessage,
  parseWorkflowOutputsMessage,
  parseWorkflowRunMessage,
  serializeAlgorithmGroupMessage,
  serializeWorkflowOutputsMessage,
  serializeWorkflowRunMessage,
  streamSessionChat,
} from '@/api/llmChat'
import { createPlotForm, plotChoice, plotResult } from './plot.js'
import {
  isSessionPinned,
  pinSessionId,
  readPinnedSessionIds,
  removePinnedSessionId,
  sortSessionsByPinOrder,
  unpinSessionId,
  writePinnedSessionIds,
} from './sessionPins.js'
import {
  buildSessionSections,
  createSessionGroup,
  deleteSessionGroup,
  moveSessionToGroup,
  pruneSessionGroupStore,
  readSessionGroupStore,
  removeSessionFromGroups,
  renameSessionGroup,
  toggleSessionGroup,
} from './sessionGroups.js'
import { t } from '@/i18n'
import '@/styles/system-dialog.css'

const sessions = ref([])
const pinnedIds = ref(readPinnedSessionIds())
const groupStore = ref(readSessionGroupStore())
const messages = ref([])
const activeId = ref(null)
const collapsed = ref(false)
const draft = ref('')
const loadingSessions = ref(false)
const loadingMessages = ref(false)
const sending = ref(false)

const localExtras = ref({})

const sessionSections = computed(() =>
  buildSessionSections(sessions.value, groupStore.value, pinnedIds.value),
)

function applySessionOrder(list) {
  return sortSessionsByPinOrder(list, pinnedIds.value)
}

function syncPinnedIds(nextIds) {
  pinnedIds.value = writePinnedSessionIds(nextIds)
}

function syncGroupStore(next) {
  groupStore.value = next
}

const displayMessages = computed(() => {
  const extras = localExtras.value[activeId.value] || []
  if (!extras.length) return messages.value
  return [...messages.value, ...extras]
})

function toUiMessage(item) {
  const base = {
    id: String(item.id),
    role: Number(item.messageType) === MESSAGE_TYPE_USER ? 'user' : 'assistant',
    content: item.content || '',
    jobId: item.jobId ?? null,
    reportId: item.reportId ?? null,
    reportStatus: item.reportStatus ?? null,
    createdAt: item.createdAt || null,
  }

  if (Number(item.messageType) === MESSAGE_TYPE_SYSTEM) {
    const group = parseAlgorithmGroupMessage(item.content)
    if (group) {
      return {
        ...base,
        type: 'workflow',
        content: '',
        group,
      }
    }
    const outputFiles = parseWorkflowOutputsMessage(item.content)
    if (outputFiles) {
      return {
        ...base,
        type: 'outputs',
        content: '',
        files: outputFiles,
      }
    }
    const runInfo = parseWorkflowRunMessage(item.content)
    if (runInfo) {
      return {
        ...base,
        content: runInfo.text || `开始运行：${runInfo.name || '工作流'}`,
      }
    }
  }

  return base
}

function sessionTitleFromContent(content) {
  const text = String(content || '').trim().replace(/\s+/g, ' ')
  if (!text) return t('agent.newTitle')
  return text.length > 40 ? `${text.slice(0, 40)}…` : text
}

async function loadAllSessions() {
  loadingSessions.value = true
  try {
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

    const mapped = records.map((item) => ({
      id: String(item.id),
      title: item.title || t('agent.newTitle'),
      createdAt: item.createdAt || null,
      updatedAt: item.updatedAt || null,
    }))
    const alive = new Set(mapped.map((item) => item.id))
    syncPinnedIds(pinnedIds.value.filter((id) => alive.has(id)))
    syncGroupStore(pruneSessionGroupStore([...alive], groupStore.value))
    sessions.value = applySessionOrder(mapped)

    if (activeId.value && !sessions.value.some((item) => item.id === activeId.value)) {
      activeId.value = null
      messages.value = []
    }
  } catch {
    sessions.value = []
  } finally {
    loadingSessions.value = false
  }
}

async function loadMessages(sessionId) {
  if (!sessionId) {
    messages.value = []
    return
  }

  loadingMessages.value = true
  try {
    const map = new Map()
    let page = 1
    let totalPages = 1
    do {
      const data = await fetchSessionMessages(sessionId, { page, pageSize: 50 })
      const pageRecords = Array.isArray(data?.records) ? data.records : []
      pageRecords.forEach((item) => {
        const ui = toUiMessage(item)
        map.set(ui.id, ui)
      })
      // 切换会话时清掉该会话临时气泡，避免和历史工作流重复
      if (localExtras.value[sessionId]) {
        localExtras.value = { ...localExtras.value, [sessionId]: [] }
      }
      const total = Number(data?.total)
      const size = Number(data?.pageSize) || 50
      totalPages = Number.isFinite(total) && total > 0 ? Math.ceil(total / size) : 1
      page += 1
    } while (page <= totalPages && page <= 40)

    messages.value = Array.from(map.values()).sort((a, b) => {
      const ta = a.createdAt || ''
      const tb = b.createdAt || ''
      if (ta !== tb) return ta.localeCompare(tb)
      return String(a.id).localeCompare(String(b.id))
    })
  } catch {
    messages.value = []
  } finally {
    loadingMessages.value = false
  }
}

async function selectSession(id) {
  const next = id == null ? null : String(id)
  if (activeId.value === next) return
  activeId.value = next
  draft.value = ''
  await loadMessages(next)
}

async function createSession() {
  if (sending.value) return
  sending.value = true
  try {
    const data = await createSessionApi({ title: t('agent.newTitle') })
    const session = {
      id: String(data.id),
      title: data.title || t('agent.newTitle'),
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null,
    }
    sessions.value = applySessionOrder([session, ...sessions.value.filter((item) => item.id !== session.id)])
    activeId.value = session.id
    messages.value = []
    localExtras.value = { ...localExtras.value, [session.id]: [] }
    draft.value = ''
  } catch {
    // request interceptor already shows message
  } finally {
    sending.value = false
  }
}

function onPin(session) {
  if (!session?.id) return
  if (isSessionPinned(session.id, pinnedIds.value)) {
    syncPinnedIds(unpinSessionId(session.id))
  } else {
    syncPinnedIds(pinSessionId(session.id))
  }
  sessions.value = applySessionOrder(sessions.value)
}

async function onCreateGroup() {
  try {
    const { value } = await ElMessageBox.prompt(t('agent.groupCreateTip'), t('agent.groupCreate'), {
      inputPlaceholder: t('agent.groupName'),
      confirmButtonText: t('system.save'),
      cancelButtonText: t('system.cancel'),
      customClass: 'system-message-box',
      modalClass: 'system-message-box-modal',
      inputValidator: (input) => {
        const name = String(input || '').trim()
        if (!name) return t('agent.groupNameRequired')
        if (name.length > 64) return t('agent.groupNameLong')
        return true
      },
    })
    syncGroupStore(createSessionGroup(value, groupStore.value))
    ElMessage.success(t('agent.groupCreated'))
  } catch {
    // cancelled
  }
}

async function onRenameGroup(group) {
  if (!group?.id) return
  try {
    const { value } = await ElMessageBox.prompt(t('agent.groupCreateTip'), t('agent.groupRename'), {
      inputValue: group.name,
      inputPlaceholder: t('agent.groupName'),
      confirmButtonText: t('system.save'),
      cancelButtonText: t('system.cancel'),
      customClass: 'system-message-box',
      modalClass: 'system-message-box-modal',
      inputValidator: (input) => {
        const name = String(input || '').trim()
        if (!name) return t('agent.groupNameRequired')
        if (name.length > 64) return t('agent.groupNameLong')
        return true
      },
    })
    syncGroupStore(renameSessionGroup(group.id, value, groupStore.value))
    ElMessage.success(t('agent.groupRenamed'))
  } catch {
    // cancelled
  }
}

async function onDeleteGroup(group) {
  if (!group?.id) return
  try {
    await ElMessageBox.confirm(t('agent.groupDeleteConfirm', { name: group.name }), t('agent.groupDelete'), {
      type: 'warning',
      customClass: 'system-message-box',
      modalClass: 'system-message-box-modal',
      confirmButtonText: t('system.remove'),
      cancelButtonText: t('system.cancel'),
    })
    syncGroupStore(deleteSessionGroup(group.id, groupStore.value))
    ElMessage.success(t('agent.groupDeleted'))
  } catch {
    // cancelled
  }
}

function onToggleGroup(groupId) {
  syncGroupStore(toggleSessionGroup(groupId, groupStore.value))
}

function onMoveSession({ sessionId, groupId }) {
  if (!sessionId) return
  syncGroupStore(moveSessionToGroup(sessionId, groupId, groupStore.value))
}

async function onRename(session) {
  try {
    const { value } = await ElMessageBox.prompt(t('agent.renameTip'), t('agent.rename'), {
      inputValue: session.title,
      inputPlaceholder: t('agent.renamePh'),
      confirmButtonText: t('system.save'),
      cancelButtonText: t('system.cancel'),
      customClass: 'system-message-box',
      modalClass: 'system-message-box-modal',
      inputValidator: (input) => {
        const title = String(input || '').trim()
        if (!title) return t('agent.renameRequired')
        if (title.length > 256) return t('agent.renameLong')
        return true
      },
    })
    const title = String(value || '').trim()
    const data = await renameSession(session.id, title)
    const nextTitle = data?.title || title
    sessions.value = sessions.value.map((item) =>
      item.id === session.id ? { ...item, title: nextTitle, updatedAt: data?.updatedAt || item.updatedAt } : item,
    )
    ElMessage.success(t('agent.renamed'))
  } catch {
    // cancelled or failed
  }
}

async function onDelete(session) {
  try {
    await ElMessageBox.confirm(t('agent.deleteConfirm', { name: session.title }), t('agent.delete'), {
      type: 'warning',
      customClass: 'system-message-box',
      modalClass: 'system-message-box-modal',
      confirmButtonText: t('system.remove'),
      cancelButtonText: t('system.cancel'),
    })
    await deleteSessionApi(session.id)
    syncPinnedIds(removePinnedSessionId(session.id))
    syncGroupStore(removeSessionFromGroups(session.id, groupStore.value))
    sessions.value = applySessionOrder(sessions.value.filter((item) => item.id !== session.id))
    const nextExtras = { ...localExtras.value }
    delete nextExtras[session.id]
    localExtras.value = nextExtras
    if (activeId.value === session.id) {
      activeId.value = null
      messages.value = []
      draft.value = ''
    }
    ElMessage.success(t('agent.deleted'))
  } catch {
    // cancelled or failed
  }
}

function pushLocalExtra(sessionId, item) {
  const list = [...(localExtras.value[sessionId] || []), item]
  localExtras.value = { ...localExtras.value, [sessionId]: list }
  return item
}

function patchLocalExtra(sessionId, id, patch) {
  const list = [...(localExtras.value[sessionId] || [])]
  const index = list.findIndex((item) => item.id === id)
  if (index < 0) return
  list[index] = { ...list[index], ...patch }
  localExtras.value = { ...localExtras.value, [sessionId]: list }
}

function removeLocalExtra(sessionId, id) {
  const list = (localExtras.value[sessionId] || []).filter((item) => item.id !== id)
  localExtras.value = { ...localExtras.value, [sessionId]: list }
}

async function ensureSession(content) {
  let sessionId = activeId.value
  if (!sessionId) {
    const created = await createSessionApi({ title: sessionTitleFromContent(content) })
    sessionId = String(created.id)
    sessions.value = applySessionOrder([
      {
        id: sessionId,
        title: created.title || sessionTitleFromContent(content),
        createdAt: created.createdAt || null,
        updatedAt: created.updatedAt || null,
      },
      ...sessions.value,
    ])
    activeId.value = sessionId
    messages.value = []
    return sessionId
  }

  const current = sessions.value.find((item) => item.id === sessionId)
  if (current && (!current.title || current.title === t('agent.newTitle'))) {
    try {
      const renamed = await renameSession(sessionId, sessionTitleFromContent(content))
      sessions.value = sessions.value.map((item) =>
        item.id === sessionId
          ? { ...item, title: renamed?.title || sessionTitleFromContent(content), updatedAt: renamed?.updatedAt || item.updatedAt }
          : item,
      )
    } catch {
      // ignore rename failure on first message
    }
  }
  return sessionId
}

async function send(text) {
  const content = String(text || '').trim()
  if (!content) {
    ElMessage.warning(t('chat.needQuestion'))
    return
  }
  if (sending.value) return

  sending.value = true
  draft.value = ''
  let streamTextId = ''
  let sessionId = ''

  try {
    sessionId = await ensureSession(content)

    const userMsg = await createSessionMessage(sessionId, {
      content,
      messageType: MESSAGE_TYPE_USER,
      jobId: null,
    })
    messages.value = [...messages.value, toUiMessage(userMsg)]

    streamTextId = `local-stream-${Date.now()}`
    pushLocalExtra(sessionId, {
      id: streamTextId,
      role: 'assistant',
      content: '',
      streaming: true,
      thinking: true,
    })

    let outputText = ''
    const groups = []
    const localWorkflowIds = []
    let streamError = ''

    await streamSessionChat({
      sessionId: llmSessionId(sessionId),
      question: content,
      onEvent: (event) => {
        if (event.type === 'output') {
          outputText += event.delta || ''
          patchLocalExtra(sessionId, streamTextId, {
            content: outputText,
            thinking: !outputText,
            streaming: true,
          })
          return
        }
        if (event.type === 'algorithm_group' && event.group) {
          groups.push(event.group)
          // 文案只保留上方一条；工作流卡片不再重复 description
          if (!outputText) {
            outputText = event.group.description || event.group.name || t('chat.workflowReady')
            patchLocalExtra(sessionId, streamTextId, {
              content: outputText,
              thinking: false,
              streaming: true,
            })
          }
          const localId = `local-workflow-${event.group.id || Date.now()}-${groups.length}`
          localWorkflowIds.push(localId)
          pushLocalExtra(sessionId, {
            id: localId,
            role: 'assistant',
            type: 'workflow',
            group: event.group,
          })
          return
        }
        if (event.type === 'error') {
          streamError = event.error || t('chat.llmFailed')
        }
      },
    })

    if (streamError) throw new Error(streamError)

    if (!outputText && groups.length) {
      outputText = groups.map((item) => item.description || item.name).filter(Boolean).join('\n') || t('chat.workflowReady')
    }
    if (!outputText && !groups.length) {
      outputText = t('chat.emptyReply')
    }

    patchLocalExtra(sessionId, streamTextId, {
      content: outputText,
      thinking: false,
      streaming: false,
    })

    try {
      const saved = []
      const systemMsg = await createSessionMessage(sessionId, {
        content: outputText,
        messageType: MESSAGE_TYPE_SYSTEM,
        jobId: null,
      })
      saved.push(toUiMessage(systemMsg))

      for (const group of groups) {
        const payload = serializeAlgorithmGroupMessage(group)
        if (!payload) continue
        const groupMsg = await createSessionMessage(sessionId, {
          content: payload,
          messageType: MESSAGE_TYPE_SYSTEM,
          jobId: null,
        })
        saved.push(toUiMessage(groupMsg))
      }

      removeLocalExtra(sessionId, streamTextId)
      localWorkflowIds.forEach((id) => removeLocalExtra(sessionId, id))
      streamTextId = ''
      messages.value = [...messages.value, ...saved]
    } catch {
      patchLocalExtra(sessionId, streamTextId, { streaming: false, thinking: false })
    }
  } catch (error) {
    if (sessionId && streamTextId) {
      patchLocalExtra(sessionId, streamTextId, {
        content: error?.message || t('chat.llmFailed'),
        streaming: false,
        thinking: false,
        failed: true,
      })
    }
    ElMessage.error(error?.message || t('chat.llmFailed'))
  } finally {
    sending.value = false
  }
}

function findLocalExtra(id) {
  const sessionId = activeId.value
  if (!sessionId) return null
  const list = localExtras.value[sessionId] || []
  const index = list.findIndex((item) => item.id === id)
  if (index < 0) return null
  return { sessionId, index, message: list[index], list }
}

function updatePlot(id, patch) {
  const found = findLocalExtra(id)
  if (!found || found.message.done) return
  const next = { ...found.message, form: { ...found.message.form, ...patch } }
  const list = [...found.list]
  list[found.index] = next
  localExtras.value = { ...localExtras.value, [found.sessionId]: list }
}

async function onWorkflowRunStart(_workflowId, group) {
  const sessionId = activeId.value
  if (!sessionId) return
  const payload = serializeWorkflowRunMessage(group)
  if (!payload) return
  try {
    const saved = await createSessionMessage(sessionId, {
      content: payload,
      messageType: MESSAGE_TYPE_SYSTEM,
      jobId: null,
    })
    messages.value = [...messages.value, toUiMessage(saved)]
  } catch (error) {
    if (error?.message) ElMessage.error(error.message)
  }
}

async function onWorkflowOutputs(_workflowId, files) {
  const sessionId = activeId.value
  if (!sessionId || !Array.isArray(files) || !files.length) return
  // 整包保存：files 展示项 + imports 接口原始回调
  const content = serializeWorkflowOutputsMessage({
    files,
    imports: Array.isArray(files.imports) ? files.imports : undefined,
  })
  const savedFiles = parseWorkflowOutputsMessage(content) || files
  const localId = `local-outputs-${Date.now()}`
  pushLocalExtra(sessionId, {
    id: localId,
    role: 'assistant',
    type: 'outputs',
    files: savedFiles,
  })
  try {
    const saved = await createSessionMessage(sessionId, {
      content,
      messageType: MESSAGE_TYPE_SYSTEM,
      jobId: null,
    })
    console.debug('[workflow-outputs] saved message', {
      messageId: saved?.id,
      files: savedFiles.map((item) => ({
        name: item.name,
        id: item.id,
        mapUrl: item.mapUrl,
        wmsUrl: item.wmsUrl,
        fileUrl: item.fileUrl,
        uploadOk: item.uploadOk,
      })),
    })
    removeLocalExtra(sessionId, localId)
    messages.value = [...messages.value, toUiMessage(saved)]
  } catch (error) {
    if (error?.message) ElMessage.error(error.message)
  }
}

async function runPlot(id) {
  const found = findLocalExtra(id)
  if (!found || found.message.done || !activeId.value) return

  const list = [...found.list]
  list[found.index] = { ...found.message, done: true }
  const now = Date.now()
  list.push(
    { id: `local-plot-choice-${now}`, role: 'user', ...plotChoice(found.message.form) },
    { id: `local-plot-result-${now}`, role: 'assistant', type: 'result', result: plotResult(found.message.form) },
  )
  localExtras.value = { ...localExtras.value, [found.sessionId]: list }
}

onMounted(async () => {
  await loadAllSessions()
  if (sessions.value[0]) {
    await selectSession(sessions.value[0].id)
  }
})
</script>

<template>
  <div class="workbench" :class="{ 'is-collapsed': collapsed }">
    <WorkbenchSide
      :collapsed="collapsed"
      :sessions="sessions"
      :sections="sessionSections"
      :groups="groupStore.groups"
      :active-id="activeId"
      :pinned-ids="pinnedIds"
      :loading="loadingSessions"
      @toggle="collapsed = !collapsed"
      @create="createSession"
      @select="selectSession"
      @rename="onRename"
      @delete="onDelete"
      @pin="onPin"
      @create-group="onCreateGroup"
      @rename-group="onRenameGroup"
      @delete-group="onDeleteGroup"
      @toggle-group="onToggleGroup"
      @move-session="onMoveSession"
    />
    <section class="chat">
      <ChatStage
        :messages="displayMessages"
        :loading="loadingMessages"
        @create="createSession"
        @expand="collapsed = !collapsed"
        @plot-update="updatePlot"
        @plot-run="runPlot"
        @workflow-run-start="onWorkflowRunStart"
        @workflow-outputs="onWorkflowOutputs"
      />
      <ChatComposer v-model="draft" :disabled="sending" @send="send" />
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
