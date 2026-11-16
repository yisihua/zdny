<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const root = ref(null)
const menuStyle = ref({})

const items = computed(() =>
  props.options.map((item) =>
    item && typeof item === 'object' ? { value: item.value, label: item.label } : { value: item, label: item },
  ),
)

const current = computed(() => items.value.find((item) => item.value === props.modelValue)?.label ?? '')

function place() {
  const rect = root.value?.getBoundingClientRect()
  if (!rect) return
  const below = window.innerHeight - rect.bottom
  const upward = below < 160 && rect.top > below
  menuStyle.value = {
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    ...(upward
      ? { bottom: `${window.innerHeight - rect.top + 6}px` }
      : { top: `${rect.bottom + 6}px` }),
  }
}

function toggle() {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) place()
}

function pick(value) {
  emit('update:modelValue', value)
  open.value = false
}

function onPointer(event) {
  const target = event.target
  if (root.value?.contains(target) || target.closest?.('.field-menu')) return
  open.value = false
}

function onMove() {
  if (open.value) place()
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointer)
  window.addEventListener('resize', onMove)
  window.addEventListener('scroll', onMove, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointer)
  window.removeEventListener('resize', onMove)
  window.removeEventListener('scroll', onMove, true)
})
</script>

<template>
  <div ref="root" class="field" :class="{ 'is-open': open, 'is-disabled': disabled }">
    <button type="button" :disabled="disabled" :aria-expanded="open" @click="toggle">
      <span>{{ current }}</span>
      <i aria-hidden="true"></i>
    </button>
    <Teleport to="body">
      <ul v-if="open" class="field-menu" :style="menuStyle" role="listbox">
        <li v-for="item in items" :key="item.value">
          <button type="button" role="option" :class="{ 'is-on': item.value === modelValue }" @click="pick(item.value)">
            {{ item.label }}
          </button>
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<style scoped>
.field {
  min-width: 220px;
}

.field > button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(140, 220, 175, 0.32);
  border-radius: 8px;
  color: #f3fff8;
  background: rgba(3, 18, 14, 0.55);
  font: inherit;
  cursor: pointer;
}

.field > button:hover:not(:disabled),
.field.is-open > button {
  border-color: rgba(140, 240, 174, 0.75);
}

.field > button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.field > button span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field i {
  flex: 0 0 auto;
  width: 0;
  height: 0;
  border-right: 4px solid transparent;
  border-left: 4px solid transparent;
  border-top: 5px solid #8cf0ae;
}

.field.is-open i {
  transform: rotate(180deg);
}

.field-menu {
  position: fixed;
  z-index: 50;
  margin: 0;
  padding: 6px;
  list-style: none;
  border: 1px solid rgba(140, 220, 175, 0.32);
  border-radius: 10px;
  background: #071910;
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.38);
}

.field-menu button {
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  color: #e7fff4;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.field-menu button:hover,
.field-menu button.is-on {
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
}
</style>
