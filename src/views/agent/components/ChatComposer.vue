<script setup>
const props = defineProps({
  modelValue: { type: String, default: '' },
  mode: { type: String, default: 'normal' },
})

const emit = defineEmits(['update:modelValue', 'update:mode', 'send'])

function changeMode(next) {
  emit('update:mode', next)
}

function submit() {
  emit('send', props.modelValue)
}
</script>

<template>
  <form class="composer" @submit.prevent="submit">
    <div class="modes">
      <button type="button" :class="{ 'is-on': mode === 'expert' }" @click="changeMode('expert')">专家模式</button>
      <button type="button" :class="{ 'is-on': mode === 'normal' }" @click="changeMode('normal')">普通会话</button>
    </div>
    <textarea
      :value="modelValue"
      rows="3"
      placeholder="发送你的问题..."
      @input="emit('update:modelValue', $event.target.value)"
      @keydown.enter.exact.prevent="submit"
    ></textarea>
    <div class="bar">
      <button type="button" class="ghost" title="附件暂未开放">附件</button>
      <button type="submit" class="send" title="发送">发送</button>
    </div>
  </form>
</template>

<style scoped>
.composer {
  margin: 0 6% 18px;
  padding: 14px 14px 10px;
  border: 1px solid rgba(140, 220, 175, 0.28);
  border-radius: 16px;
  background: rgba(4, 24, 18, 0.72);
  box-shadow: inset 0 0 24px rgba(40, 160, 110, 0.08);
}

.modes {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.modes button,
.ghost,
.send {
  border: 1px solid rgba(140, 220, 175, 0.28);
  color: #e7fff4;
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.modes button {
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 13px;
}

.modes button.is-on {
  border-color: transparent;
  color: #042117;
  background: linear-gradient(90deg, #7dffc3, #2fbf6a);
}

textarea {
  width: 100%;
  margin-top: 8px;
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

.send {
  border: none;
  color: #042117;
  background: linear-gradient(180deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
}
</style>
