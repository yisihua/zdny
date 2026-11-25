<script setup>
import { computed } from 'vue'
import { t } from '@/i18n'

const props = defineProps({
  page: { type: Number, required: true },
  total: { type: Number, required: true },
  pageSize: { type: Number, required: true },
  /** 当前页两侧各显示几页 */
  siblingCount: { type: Number, default: 1 },
  /** 首尾各固定显示几页 */
  boundaryCount: { type: Number, default: 1 },
})

const emit = defineEmits(['update:page'])

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize) || 1))

const items = computed(() => {
  const total = pageCount.value
  const current = Math.min(Math.max(1, props.page), total)
  const sibling = Math.max(0, props.siblingCount)
  const boundary = Math.max(1, props.boundaryCount)

  if (total <= boundary * 2 + sibling * 2 + 3) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const startPages = range(1, boundary)
  const endPages = range(total - boundary + 1, total)
  const siblingsStart = Math.max(current - sibling, boundary + 2)
  const siblingsEnd = Math.min(current + sibling, total - boundary - 1)

  const list = [...startPages]

  if (siblingsStart > boundary + 2) {
    list.push('ellipsis-start')
  } else {
    list.push(boundary + 1)
  }

  list.push(...range(siblingsStart, siblingsEnd))

  if (siblingsEnd < total - boundary - 1) {
    list.push('ellipsis-end')
  } else if (total - boundary > boundary) {
    list.push(total - boundary)
  }

  list.push(...endPages)
  return uniquePages(list)
})

function range(start, end) {
  if (end < start) return []
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

function uniquePages(list) {
  const seen = new Set()
  return list.filter((item) => {
    if (typeof item === 'string') return true
    if (seen.has(item)) return false
    seen.add(item)
    return true
  })
}

function go(n) {
  const next = Math.min(Math.max(1, n), pageCount.value)
  if (next !== props.page) emit('update:page', next)
}
</script>

<template>
  <div class="pager">
    <span>{{ t('data.total', { n: total }) }}</span>
    <button type="button" :disabled="page <= 1" @click="go(page - 1)">{{ t('data.prev') }}</button>
    <template v-for="item in items" :key="item">
      <span v-if="typeof item === 'string'" class="ellipsis" aria-hidden="true">…</span>
      <button
        v-else
        type="button"
        :class="{ 'is-active': item === page }"
        @click="go(item)"
      >
        {{ item }}
      </button>
    </template>
    <button type="button" :disabled="page >= pageCount" @click="go(page + 1)">{{ t('data.next') }}</button>
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

.ellipsis {
  min-width: 20px;
  color: rgba(214, 245, 228, 0.55);
  text-align: center;
  user-select: none;
}
</style>
