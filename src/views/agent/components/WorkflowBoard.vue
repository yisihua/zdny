<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import WorkflowNode from './WorkflowNode.vue'
import { streamAgentRun } from '@/api/agentRun'
import { collectAlgorithmOuts, uploadAlgorithmOutsToDataset } from '@/api/workflowOutputs'
import { t } from '@/i18n'

const props = defineProps({
  group: { type: Object, required: true },
})

const emit = defineEmits(['run-start', 'outputs'])

const starting = ref(false)
const uploadingOuts = ref(false)
const uploadProgress = ref(0)
const uploadPhase = ref('')
const uploadCount = ref(0)
const eventId = ref('')
let abortCtrl = null

const children = computed(() => props.group.algorithm?.children || [])
const busy = computed(() => children.value.filter((item) => item.status !== 'succeeded').length)
const phase = computed(() => {
  if (starting.value) return 'running'
  const root = props.group.algorithm
  if (!root) return 'idle'
  if (root.status === 'succeeded' || root.status === 'failed') return 'done'
  const nodes = [root, ...children.value]
  if (nodes.some((item) => item.status === 'running' || item.status === 'succeeded')) return 'running'
  return 'idle'
})
const summaryStatus = computed(() => {
  if (phase.value === 'idle') return 'idle'
  if (children.value.some((item) => item.status === 'failed') || props.group.algorithm?.status === 'failed') {
    return 'failed'
  }
  if (children.value.some((item) => item.status === 'running') || props.group.algorithm?.status === 'running' || starting.value) {
    return 'running'
  }
  if (busy.value === 0 && children.value.length) return 'succeeded'
  return 'pending'
})
const summaryProgress = computed(() => {
  const nodes = children.value.length ? children.value : props.group.algorithm ? [props.group.algorithm] : []
  if (!nodes.length) return 0
  const total = nodes.reduce((sum, item) => sum + clampProgress(item.progress), 0)
  return Math.round(total / nodes.length)
})
const summaryText = computed(() => {
  if (phase.value === 'idle') return t('workflow.notStarted')
  if (props.group.algorithm?.status === 'succeeded') return `${t('workflow.allDone')} · ${summaryProgress.value || 100}%`
  if (props.group.algorithm?.status === 'failed') return `${t('workflow.failed')} · ${summaryProgress.value}%`
  if (phase.value === 'running') {
    return `${t('workflow.branch', { busy: busy.value, total: children.value.length })} · ${summaryProgress.value}%`
  }
  return t('workflow.branch', { busy: busy.value, total: children.value.length })
})
const runLabel = computed(() => {
  if (phase.value === 'done') return t('workflow.done')
  if (phase.value === 'running') return t('workflow.running')
  return t('workflow.start')
})
const uploadPhaseText = computed(() => {
  if (uploadPhase.value === 'processing') return t('data.uploadProcessing')
  if (uploadPhase.value === 'done') return t('data.uploadDone')
  return t('data.uploadProgress', { n: uploadProgress.value })
})

function resetNode(node) {
  if (!node) return
  node.status = 'pending'
  node.progress = 0
  node.outs = null
  ;(node.children || []).forEach(resetNode)
}

function clampProgress(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function syncNode(local, remote) {
  if (!local || !remote) return
  local.status = remote.status || 'pending'
  local.progress = clampProgress(remote.progress)
  if (remote.description != null) local.description = remote.description
  if ('outs' in remote) local.outs = remote.outs

  const remoteInputs = Array.isArray(remote.inputs) ? remote.inputs : []
  const localInputs = Array.isArray(local.inputs) ? local.inputs : []
  remoteInputs.forEach((rInput) => {
    const lInput = localInputs.find((item) => item.name === rInput.name)
    if (!lInput) return
    if ('value' in rInput) lInput.value = rInput.value
  })

  const remoteKids = Array.isArray(remote.children) ? remote.children : []
  const localKids = Array.isArray(local.children) ? local.children : []
  remoteKids.forEach((rChild, index) => {
    const lChild = localKids.find((item) => item.id === rChild.id) || localKids[index]
    if (lChild) syncNode(lChild, rChild)
  })
}

function onUploadProgress(event) {
  uploadPhase.value = event?.phase || 'upload'
  uploadProgress.value = Number(event?.percent) || 0
}

async function publishOutputs(root) {
  if (uploadingOuts.value) return
  uploadingOuts.value = true
  uploadProgress.value = 0
  uploadPhase.value = 'upload'
  uploadCount.value = collectAlgorithmOuts(root).filter((item) => item.url).length
  try {
    const files = await uploadAlgorithmOutsToDataset(root, undefined, {
      onProgress: onUploadProgress,
    })
    if (!files.length) {
      ElMessage.info(t('workflow.outputsEmpty'))
      return
    }
    emit('outputs', files)
    ElMessage.success(t('workflow.uploadOutsOk', { n: files.length }))
  } catch (error) {
    ElMessage.error(error?.message || t('workflow.uploadOutsFailed'))
  } finally {
    uploadingOuts.value = false
    uploadPhase.value = ''
    uploadProgress.value = 0
    uploadCount.value = 0
  }
}

function stop() {
  if (abortCtrl) {
    abortCtrl.abort()
    abortCtrl = null
  }
  starting.value = false
}

async function start() {
  if (phase.value !== 'idle' || starting.value) return
  const root = props.group.algorithm
  if (!root) {
    ElMessage.error(t('workflow.missingAlgorithm'))
    return
  }

  stop()
  resetNode(root)
  starting.value = true
  eventId.value = ''
  abortCtrl = new AbortController()
  emit('run-start', props.group)

  try {
    console.log('[workflow] start run', {
      id: root.id,
      name: root.name,
      children: (root.children || []).map((item) => item.id),
    })
    await streamAgentRun({
      algorithm: root,
      signal: abortCtrl.signal,
      onEvent: (event) => {
        console.log('[workflow] onEvent', event.type, {
          eventId: event.eventId,
          status: event.status,
          error: event.error,
          rootStatus: event.algorithm?.status,
          rootProgress: event.algorithm?.progress,
        })
        if (event.type === 'progress') {
          if (event.eventId) eventId.value = event.eventId
          if (event.algorithm) syncNode(root, event.algorithm)
          return
        }
        if (event.type === 'error') {
          ElMessage.error(event.error || t('workflow.runFailed'))
          if (root.status === 'pending') root.status = 'failed'
          return
        }
        if (event.type === 'done') {
          starting.value = false
        }
      },
    })
    await publishOutputs(root)
  } catch (error) {
    console.error('[workflow] run failed', error)
    if (error?.name === 'AbortError') return
    ElMessage.error(error?.message || t('workflow.runFailed'))
    if (root.status === 'pending') root.status = 'failed'
  } finally {
    starting.value = false
    abortCtrl = null
  }
}

onBeforeUnmount(stop)
</script>

<template>
  <section class="board">
    <header>
      <div>
        <h3>{{ group.name || t('workflow.title') }}</h3>
        <p>{{ group.description || t('workflow.hint') }}</p>
      </div>
      <div class="tools">
        <button type="button" class="run" :disabled="phase !== 'idle'" @click="start">{{ runLabel }}</button>
      </div>
    </header>
    <div v-if="uploadingOuts && uploadCount" class="upload-progress">
      <div class="upload-progress-head">
        <strong>{{ t('workflow.uploadingOuts', { n: uploadCount }) }}</strong>
        <p>{{ uploadPhaseText }}</p>
        <em>{{ uploadProgress }}%</em>
      </div>
      <div
        class="upload-bar"
        role="progressbar"
        :aria-valuenow="uploadProgress"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <i :style="{ width: `${uploadProgress}%` }" />
      </div>
    </div>
    <div class="canvas">
      <div class="paper">
        <WorkflowNode :node="group.algorithm" />
        <div v-if="children.length" class="summary">
          <div class="merge" :style="{ '--count': children.length }">
            <i v-for="item in children" :key="item.id" aria-hidden="true"></i>
            <span class="merge-stem" aria-hidden="true"></span>
          </div>
          <div class="card" :class="summaryStatus">
            <div class="head">
              <span>
                <strong>{{ t('workflow.summary') }}</strong>
                <small>{{ summaryText }}</small>
              </span>
              <em v-if="phase !== 'idle'" class="pct">{{ summaryProgress }}%</em>
              <i class="dot" />
            </div>
            <div v-if="phase !== 'idle'" class="bar" role="progressbar" :aria-valuenow="summaryProgress">
              <i :style="{ width: `${summaryProgress}%` }" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.board {
  overflow: hidden;
  border: 1px solid rgba(140, 220, 175, 0.22);
  border-radius: 16px;
  color: #edfff6;
  background: #0c241c;
}

header,
.tools {
  display: flex;
  align-items: center;
}

.board > header {
  justify-content: space-between;
  gap: 12px;
}

.board > header {
  padding: 14px 16px 10px;
}

h3,
p {
  margin: 0;
}

h3 {
  font-size: 16px;
}

.board > header p,
small {
  color: rgba(214, 245, 228, 0.68);
  font-size: 12px;
}

.tools {
  gap: 6px;
}

.tools button {
  height: 30px;
  padding: 0 10px;
  border: 1px solid rgba(140, 220, 175, 0.28);
  border-radius: 8px;
  color: #d8ffe9;
  background: rgba(4, 24, 18, 0.45);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.tools button:hover:not(:disabled) {
  border-color: rgba(140, 240, 174, 0.75);
}

.tools button.run {
  border-color: transparent;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
}

.tools button.run:disabled {
  opacity: 0.55;
}

.tools button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.upload-progress {
  display: grid;
  gap: 8px;
  margin: 0 16px 10px;
  padding: 10px 12px;
  border: 1px solid rgba(120, 200, 230, 0.45);
  border-radius: 12px;
  background: rgba(8, 32, 24, 0.88);
}

.upload-progress-head {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: baseline;
}

.upload-progress-head strong {
  font-size: 13px;
}

.upload-progress-head p {
  flex: 1;
  min-width: 0;
  color: rgba(214, 245, 228, 0.68);
  font-size: 12px;
}

.upload-progress-head em {
  flex: 0 0 auto;
  color: #8dffc8;
  font-style: normal;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.upload-bar {
  overflow: hidden;
  height: 8px;
  border-radius: 999px;
  background: rgba(140, 220, 175, 0.16);
}

.upload-bar > i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #5ec8e8, #8cf0ae 45%, #2fbf6a);
  background-size: 200% 100%;
  animation: upload-shine 1.2s linear infinite;
  transition: width 0.2s ease;
}

@keyframes upload-shine {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

.canvas {
  overflow: auto;
  padding: 4px 12px 16px;
  background-image: radial-gradient(rgba(140, 220, 175, 0.22) 1.15px, transparent 1.15px);
  background-size: 18px 18px;
}

.paper {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: max-content;
  min-width: 100%;
}

.summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

/* 由上一级并行节点汇合到汇总卡片 */
.merge {
  --gap: 12px;
  --line: rgba(160, 230, 190, 0.8);
  position: relative;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(180px, 1fr);
  gap: var(--gap);
  width: 100%;
  min-height: 40px;
  margin-top: 2px;
  margin-bottom: 8px;
  padding-bottom: 22px;
}

.merge > i {
  position: relative;
  display: block;
  height: 18px;
}

.merge > i::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 1.5px;
  height: 18px;
  background: var(--line);
  transform: translateX(-50%);
}

.merge > i::after {
  content: '';
  position: absolute;
  top: 18px;
  right: calc(var(--gap) * -1);
  left: 0;
  height: 1.5px;
  background: var(--line);
}

.merge > i:first-of-type::after {
  left: 50%;
}

.merge > i:last-of-type::after {
  right: 50%;
}

.merge > i:only-of-type::after {
  display: none;
}

.merge-stem {
  position: absolute;
  top: 18px;
  left: 50%;
  width: 1.5px;
  height: 22px;
  background: var(--line);
  transform: translateX(-50%);
}

.merge-stem::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  border-right: 4px solid transparent;
  border-left: 4px solid transparent;
  border-top: 6px solid rgba(160, 230, 190, 0.95);
  transform: translateX(-50%);
}

.card {
  display: grid;
  gap: 8px;
  width: min(280px, 100%);
  min-height: 64px;
  padding: 10px 12px;
  border: 1px solid rgba(140, 220, 175, 0.28);
  border-radius: 12px;
  color: #edfff6;
  background: rgba(8, 32, 24, 0.88);
}

.card .head {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.card .head > span {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.card strong,
.card small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card strong {
  font-size: 14px;
}

.card .pct {
  flex: 0 0 auto;
  color: #8dffc8;
  font-size: 12px;
  font-style: normal;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.card .dot {
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: rgba(214, 245, 228, 0.4);
}

.card .bar {
  overflow: hidden;
  height: 4px;
  border-radius: 999px;
  background: rgba(140, 220, 175, 0.16);
}

.card .bar > i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #5ec8e8, #8cf0ae);
  transition: width 0.25s ease;
}

.card.running {
  border-color: rgba(120, 200, 230, 0.7);
}

.card.running .dot {
  background: #5ec8e8;
}

.card.succeeded {
  border-color: rgba(140, 240, 174, 0.75);
}

.card.succeeded .dot {
  background: #3dce7c;
}

.card.succeeded .bar > i {
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
}

.card.failed {
  border-color: rgba(224, 112, 112, 0.75);
}

.card.failed .dot {
  background: #e07070;
}

.card.failed .pct {
  color: #ffb4b4;
}

.card.failed .bar > i {
  background: linear-gradient(90deg, #e07070, #ff9b9b);
}

.card.pending .dot,
.card.idle .dot {
  background: rgba(214, 245, 228, 0.4);
}
</style>
