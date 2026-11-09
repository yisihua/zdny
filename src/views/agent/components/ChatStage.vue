<script setup>
import { nextTick, ref, watch } from 'vue'
import PlotForm from './PlotForm.vue'
import PlotResult from './PlotResult.vue'
import { formatMessage, t } from '@/i18n'

const props = defineProps({
  messages: { type: Array, default: () => [] },
})

defineEmits(['create', 'expand', 'plot-update', 'plot-run'])

const stage = ref(null)

watch(
  () => props.messages.length,
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

    <div v-if="messages.length" class="thread">
      <article v-for="item in messages" :key="item.id" :class="[item.role, item.type]">
        <PlotForm
          v-if="item.type === 'plot'"
          :form="item.form"
          :done="item.done"
          @update="$emit('plot-update', item.id, $event)"
          @run="$emit('plot-run', item.id)"
        />
        <PlotResult v-else-if="item.type === 'result'" :result="item.result" />
        <p v-else>{{ formatMessage(item) }}</p>
      </article>
    </div>
    <p v-else class="hint">{{ t('agent.empty') }}</p>
  </section>
</template>

<style scoped>
.stage {
  position: relative;
  min-height: 0;
  padding: 64px 8% 12px;
  overflow: auto;
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

article p {
  margin: 0;
}

.user {
  align-self: flex-end;
  background: rgba(40, 140, 90, 0.28);
}

.assistant {
  align-self: flex-start;
  background: rgba(3, 18, 14, 0.55);
}
</style>
