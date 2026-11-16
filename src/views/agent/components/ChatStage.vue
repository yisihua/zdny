<script setup>
import { nextTick, ref, watch } from 'vue'
import PlotForm from './PlotForm.vue'
import PlotResult from './PlotResult.vue'
import WorkflowBoard from './WorkflowBoard.vue'
import WorkflowOutputs from './WorkflowOutputs.vue'
import { formatMessage, t } from '@/i18n'
import { renderMarkdown } from '@/utils/markdown'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

defineEmits(['create', 'expand', 'plot-update', 'plot-run', 'workflow-run-start', 'workflow-outputs'])

const stage = ref(null)

function messageHtml(item) {
  return renderMarkdown(formatMessage(item))
}

watch(
  () => props.messages.map((item) => `${item.id}:${item.content || ''}:${item.streaming ? 1 : 0}:${item.type || ''}:${(item.files || []).length}`).join('|'),
  async () => {
    await nextTick()
    if (stage.value) stage.value.scrollTop = stage.value.scrollHeight
  },
)
</script>

<template>
  <section ref="stage" class="stage">
    <div class="toolbar">
      <button type="button" :title="t('agent.newTitle')" @click="$emit('create')">+</button>
      <button type="button" :title="t('agent.toggleSide')" @click="$emit('expand')">⛶</button>
    </div>

    <div v-if="loading" class="hint">{{ t('system.loading') }}</div>
    <div v-else-if="messages.length" class="thread">
      <article v-for="item in messages" :key="item.id" :class="[item.role, item.type]">
        <PlotForm
          v-if="item.type === 'plot'"
          :form="item.form"
          :done="item.done"
          @update="$emit('plot-update', item.id, $event)"
          @run="$emit('plot-run', item.id)"
        />
        <PlotResult v-else-if="item.type === 'result'" :result="item.result" />
        <WorkflowBoard
          v-else-if="item.type === 'workflow'"
          :group="item.group"
          @run-start="$emit('workflow-run-start', item.id, $event)"
          @outputs="$emit('workflow-outputs', item.id, $event)"
        />
        <WorkflowOutputs v-else-if="item.type === 'outputs'" :files="item.files || []" />
        <div v-else-if="item.thinking && !item.content" class="thinking">
          <span>{{ t('chat.thinking') }}</span>
          <i /><i /><i />
        </div>
        <div
          v-else
          class="md"
          :class="{ streaming: item.streaming, failed: item.failed }"
          v-html="messageHtml(item)"
        />
      </article>
    </div>
    <p v-else class="hint">{{ t('agent.empty') }}</p>
  </section>
</template>

<style scoped>
.stage {
  position: relative;
  min-height: 0;
  padding: 64px 6% 12px;
  overflow: auto;
  scrollbar-gutter: stable;
  background-image:
    linear-gradient(rgba(120, 220, 170, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(120, 220, 170, 0.05) 1px, transparent 1px);
  background-size: 52px 52px, 52px 52px;
}

.toolbar {
  position: absolute;
  top: 16px;
  right: 18px;
  display: flex;
  gap: 10px;
}

.toolbar button {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(140, 220, 175, 0.28);
  border-radius: 8px;
  color: #d8ffe9;
  background: rgba(4, 24, 18, 0.45);
  cursor: pointer;
}

.hint {
  margin: 8vh 0 0;
  color: rgba(214, 245, 228, 0.78);
  font-size: 18px;
  text-align: center;
}

.thread {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

article {
  max-width: min(760px, 94%);
  padding: 12px 14px;
  border: 1px solid rgba(140, 220, 175, 0.18);
  border-radius: 12px;
  line-height: 1.7;
}

.user {
  align-self: flex-end;
  background: rgba(40, 140, 90, 0.28);
}

.assistant {
  align-self: flex-start;
  background: rgba(3, 18, 14, 0.55);
}

.md {
  color: #edfff6;
  word-break: break-word;
}

.md :deep(> *:first-child) {
  margin-top: 0;
}

.md :deep(> *:last-child) {
  margin-bottom: 0;
}

.md :deep(p),
.md :deep(ul),
.md :deep(ol),
.md :deep(blockquote),
.md :deep(pre) {
  margin: 0 0 0.7em;
}

.md :deep(ul),
.md :deep(ol) {
  padding-left: 1.35em;
}

.md :deep(li) {
  margin: 0.2em 0;
}

.md :deep(li > ul),
.md :deep(li > ol) {
  margin: 0.25em 0 0.35em;
}

.md :deep(strong) {
  color: #f3fff8;
  font-weight: 700;
}

.md :deep(em) {
  color: rgba(214, 245, 228, 0.92);
  font-style: italic;
}

.md :deep(code) {
  padding: 0.1em 0.35em;
  border-radius: 4px;
  color: #8dffc8;
  background: rgba(4, 28, 22, 0.72);
  font-size: 0.92em;
}

.md :deep(pre) {
  padding: 10px 12px;
  overflow: auto;
  border: 1px solid rgba(140, 220, 175, 0.2);
  border-radius: 8px;
  background: rgba(4, 24, 18, 0.72);
}

.md :deep(pre code) {
  padding: 0;
  background: transparent;
}

.md :deep(a) {
  color: #8cf0ae;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.md :deep(blockquote) {
  padding-left: 10px;
  border-left: 3px solid rgba(140, 220, 175, 0.45);
  color: rgba(214, 245, 228, 0.82);
}

.md :deep(hr) {
  margin: 0.9em 0;
  border: 0;
  border-top: 1px solid rgba(140, 220, 175, 0.22);
}

article.workflow {
  align-self: stretch;
  width: 100%;
  max-width: none;
  padding: 0;
  border: none;
  background: transparent;
}

.streaming {
  color: rgba(214, 245, 228, 0.78);
}

.failed {
  color: #ffb4b4;
}

.thinking {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: rgba(214, 245, 228, 0.82);
}

.thinking i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8cf0ae;
  opacity: 0.35;
  animation: think-bounce 1.1s infinite ease-in-out;
}

.thinking i:nth-child(2) {
  animation-delay: 0.15s;
}

.thinking i:nth-child(3) {
  animation-delay: 0.3s;
}

.thinking i:nth-child(4) {
  animation-delay: 0.45s;
}

@keyframes think-bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.28;
  }
  40% {
    transform: translateY(-4px);
    opacity: 1;
  }
}
</style>
