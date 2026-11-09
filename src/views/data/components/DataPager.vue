<script setup>
import { computed } from 'vue'
import { t } from '@/i18n'

const props = defineProps({
  page: { type: Number, required: true },
  total: { type: Number, required: true },
  pageSize: { type: Number, required: true },
})

const emit = defineEmits(['update:page'])
const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
</script>

<template>
  <div class="pager">
    <span>{{ t('data.total', { n: total }) }}</span>
    <button type="button" :disabled="page <= 1" @click="emit('update:page', page - 1)">{{ t('data.prev') }}</button>
    <button
      v-for="n in pageCount"
      :key="n"
      type="button"
      :class="{ 'is-active': n === page }"
      @click="emit('update:page', n)"
    >
      {{ n }}
    </button>
    <button type="button" :disabled="page >= pageCount" @click="emit('update:page', page + 1)">{{ t('data.next') }}</button>
  </div>
</template>

<style scoped>
.pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
  color: rgba(214, 245, 228, 0.72);
}

button {
  min-width: 32px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid rgba(140, 220, 175, 0.28);
  border-radius: 8px;
  color: #e7fff4;
  background: rgba(3, 18, 14, 0.45);
  font: inherit;
  cursor: pointer;
}

button.is-active {
  border-color: transparent;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
