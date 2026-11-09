<script setup>
import { t } from '@/i18n'

defineProps({
  active: { type: String, required: true },
})

defineEmits(['change'])

const items = [
  { id: 'personal', key: 'data.personal' },
  { id: 'public', key: 'data.public' },
]
</script>

<template>
  <div class="scopes" role="tablist" :aria-label="t('data.scope')">
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      role="tab"
      :aria-selected="item.id === active"
      :class="{ 'is-active': item.id === active }"
      @click="$emit('change', item.id)"
    >
      {{ t(item.key) }}
    </button>
  </div>
</template>

<style scoped>
.scopes {
  display: flex;
  gap: 8px;
}

button {
  height: 36px;
  padding: 0 16px;
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
</style>
