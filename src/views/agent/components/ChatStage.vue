<script setup>
defineProps({
  messages: { type: Array, default: () => [] },
})

defineEmits(['create', 'expand'])
</script>

<template>
  <section class="stage">
    <div class="toolbar">
      <button type="button" title="新建会话" @click="$emit('create')">+</button>
      <button type="button" title="展开或收起侧栏" @click="$emit('expand')">⛶</button>
    </div>

    <div v-if="messages.length" class="thread">
      <article v-for="item in messages" :key="item.id" :class="item.role">
        <p>{{ item.content }}</p>
      </article>
    </div>
    <p v-else class="hint">请输入问题，系统将以对话形式返回结果。</p>
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
  max-width: min(680px, 86%);
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
