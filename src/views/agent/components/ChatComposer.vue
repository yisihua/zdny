<script setup>
import { t } from '@/i18n'

const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'send'])

function submit() {
  if (props.disabled) return
  emit('send', props.modelValue)
}
</script>

<template>
  <form class="composer" @submit.prevent="submit">
    <textarea
      :value="modelValue"
      rows="3"
      :disabled="disabled"
      :placeholder="t('agent.placeholder')"
      @input="emit('update:modelValue', $event.target.value)"
      @keydown.enter.exact.prevent="submit"
    ></textarea>
    <div class="bar">
      <button type="button" class="ghost" :title="t('agent.attachTip')">{{ t('agent.attach') }}</button>
      <button type="submit" class="send" :disabled="disabled" :title="t('agent.send')">{{ t('agent.send') }}</button>
    </div>
  </form>
</template>

<style scoped>
.composer {
  margin: 0 6% 18px;
  margin-right: calc(6% + 10px);
  padding: 14px 14px 10px;
  border: 1px solid rgba(140, 220, 175, 0.28);
  border-radius: 16px;
  background: rgba(4, 24, 18, 0.72);
  box-shadow: inset 0 0 24px rgba(40, 160, 110, 0.08);
}

.ghost,
.send {
  border: 1px solid rgba(140, 220, 175, 0.28);
  color: #e7fff4;
  background: transparent;
  font: inherit;
  cursor: pointer;
}

textarea {
  width: 100%;
  margin-top: 0;
  border: none;
  resize: none;
  color: #f3fff8;
  background: transparent;
  font: inherit;
  line-height: 1.6;
  outline: none;
}

textarea::placeholder {
  color: rgba(198, 224, 210, 0.55);
}

.bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ghost,
.send {
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
}

.send:disabled,
textarea:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.send {
  border: none;
  color: #042117;
  background: linear-gradient(180deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
}
</style>
