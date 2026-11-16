<script>
export default { name: 'WorkflowNode' }
</script>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SelectMenu from '@/components/SelectMenu.vue'
import { t } from '@/i18n'

const props = defineProps({
  node: { type: Object, required: true },
})

const open = ref(false)
const moduleEl = ref(null)
const panelStyle = ref({})
const hasInputs = computed(() => (props.node.inputs || []).length > 0)
const paramInputs = computed(() => (props.node.inputs || []).filter((item) => item.widget !== 'file'))
const fileInputs = computed(() => (props.node.inputs || []).filter((item) => item.widget === 'file'))
const status = computed(() => props.node.status || 'pending')
const progressPct = computed(() => {
  const n = Number(props.node.progress)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
})
const showProgress = computed(() => status.value === 'running' || status.value === 'succeeded' || status.value === 'failed' || progressPct.value > 0)
const caption = computed(() => {
  const node = props.node
  const pct = progressPct.value
  if (status.value === 'running') return `${t('workflow.running')} · ${pct}%`
  if (status.value === 'succeeded') return `${t('workflow.succeeded')} · ${pct || 100}%`
  if (status.value === 'failed') return `${t('workflow.failed')}${pct ? ` · ${pct}%` : ''}`
  if (status.value === 'pending' && pct > 0) return `${t('workflow.pending')} · ${pct}%`
  if (node.description) return node.description
  return t('workflow.idle')
})

function selectOptions(input) {
  if ((input.value ?? input.default) == null) {
    return [{ value: '', label: t('workflow.choose') }, ...(input.options || [])]
  }
  return input.options || []
}

function setValue(input, value) {
  input.value = value
}

function numberValue(input) {
  const raw = input.value ?? input.default
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function numberStep(input) {
  const step = Number(input.step)
  if (Number.isFinite(step) && step > 0) return step
  const current = Math.abs(numberValue(input))
  if (current > 0 && current < 1) {
    const digits = `${current}`.split('.')[1]?.length || 2
    return Number(`0.${'0'.repeat(Math.max(0, digits - 1))}1`)
  }
  return 1
}

function bumpNumber(input, direction) {
  const step = numberStep(input)
  const next = Number((numberValue(input) + direction * step).toFixed(8))
  setValue(input, next)
}

function chooseFile(input, file) {
  input.value = { id: file.id, filename: file.filename }
}

function place() {
  const rect = moduleEl.value?.getBoundingClientRect()
  if (!rect) return
  const width = Math.max(rect.width, 280)
  let left = rect.left + rect.width / 2 - width / 2
  left = Math.min(Math.max(12, left), window.innerWidth - width - 12)
  const spaceBelow = window.innerHeight - rect.bottom - 16
  const spaceAbove = rect.top - 16
  const upward = spaceBelow < 280 && spaceAbove > spaceBelow
  const maxHeight = Math.max(160, (upward ? spaceAbove : spaceBelow) - 8)
  panelStyle.value = {
    left: `${left}px`,
    width: `${width}px`,
    maxHeight: `${maxHeight}px`,
    ...(upward
      ? { bottom: `${window.innerHeight - rect.top + 8}px` }
      : { top: `${rect.bottom + 8}px` }),
  }
}

function toggle() {
  open.value = !open.value
  if (open.value) place()
}

function onPointer(event) {
  if (!open.value) return
  const target = event.target
  if (moduleEl.value?.contains(target)) return
  if (target.closest?.('.node-panel') || target.closest?.('.field-menu')) return
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
  <div class="branch">
    <span class="join" aria-hidden="true"></span>
    <div ref="moduleEl" class="module">
      <div class="card" :class="[status, { 'is-open': open }]" :data-status="status">
        <div class="head">
          <span>
            <strong>{{ node.name }}</strong>
            <small>{{ caption }}</small>
          </span>
          <em v-if="showProgress" class="pct">{{ progressPct }}%</em>
          <button
            v-if="hasInputs"
            type="button"
            class="more"
            :class="{ 'is-open': open }"
            :aria-expanded="open"
            :title="t('workflow.expand')"
            @click="toggle"
          >
            <i aria-hidden="true" />
          </button>
          <i class="dot" />
        </div>
        <div v-if="showProgress" class="bar" :aria-valuenow="progressPct" aria-valuemin="0" aria-valuemax="100" role="progressbar">
          <i :style="{ width: `${progressPct}%` }" />
        </div>
      </div>
      <Teleport to="body">
        <div v-if="open" class="panel node-panel" :style="panelStyle">
        <template v-if="paramInputs.length">
          <h4>{{ t('workflow.params') }}</h4>
          <label v-for="input in paramInputs" :key="input.name">
            {{ input.label }}
            <SelectMenu
              v-if="input.widget === 'select'"
              :model-value="input.value ?? input.default ?? ''"
              :options="selectOptions(input)"
              @update:model-value="setValue(input, $event || null)"
            />
            <div v-else-if="input.widget === 'number'" class="num">
              <input
                type="number"
                :value="input.value ?? input.default ?? ''"
                @input="setValue(input, Number($event.target.value))"
              />
              <div class="spin">
                <button type="button" tabindex="-1" aria-label="+" @click="bumpNumber(input, 1)"></button>
                <button type="button" tabindex="-1" aria-label="-" @click="bumpNumber(input, -1)"></button>
              </div>
            </div>
            <input
              v-else-if="input.widget === 'switch'"
              type="checkbox"
              :checked="Boolean(input.value ?? input.default)"
              @change="setValue(input, $event.target.checked)"
            />
            <input
              v-else-if="input.widget === 'dataset'"
              type="text"
              :value="(input.value || input.default)?.name || (input.value || input.default)?.id || ''"
              readonly
            />
            <input
              v-else
              type="text"
              :value="input.value ?? input.default ?? ''"
              @input="setValue(input, $event.target.value)"
            />
          </label>
        </template>
        <template v-if="fileInputs.length">
          <h4>{{ t('workflow.files') }}</h4>
          <div v-for="input in fileInputs" :key="input.name" class="file-block">
            <span>{{ input.label }}</span>
            <ul v-if="input.files?.length" class="files">
              <li v-for="file in input.files" :key="file.id">
                <button type="button" :class="{ 'is-on': input.value?.id === file.id }" @click="chooseFile(input, file)">
                  <em>{{ file.ext || 'FILE' }}</em>
                  <span>{{ file.filename }}</span>
                </button>
              </li>
            </ul>
            <p v-else class="file-picked">
              {{ (input.value || input.default)?.filename || (input.value || input.default)?.id || t('workflow.choose') }}
            </p>
          </div>
        </template>
        </div>
      </Teleport>
    </div>
    <div v-if="node.children?.length" class="below">
      <span class="stem"></span>
      <div class="row" :style="{ '--count': node.children.length }">
        <WorkflowNode v-for="child in node.children" :key="child.id" :node="child" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.branch {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  min-width: 0;
}

.module {
  width: min(240px, 100%);
}

.card {
  display: grid;
  gap: 8px;
  width: 100%;
  min-height: 64px;
  padding: 10px 12px;
  border: 1px solid rgba(140, 220, 175, 0.28);
  border-radius: 12px;
  color: #edfff6;
  background: rgba(8, 32, 24, 0.88);
  font: inherit;
  text-align: left;
  user-select: none;
}

.head {
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

strong,
small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

strong {
  font-size: 14px;
}

small {
  color: rgba(214, 245, 228, 0.68);
  font-size: 12px;
}

.pct {
  flex: 0 0 auto;
  color: #8dffc8;
  font-size: 12px;
  font-style: normal;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.card .dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: rgba(214, 245, 228, 0.45);
}

.bar {
  overflow: hidden;
  height: 4px;
  border-radius: 999px;
  background: rgba(140, 220, 175, 0.16);
}

.bar > i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #5ec8e8, #8cf0ae);
  transition: width 0.25s ease;
}

.card.succeeded {
  border-color: rgba(140, 240, 174, 0.72);
}

.card.succeeded .dot {
  background: #2fbf6a;
}

.card.succeeded .bar > i {
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
}

.card.succeeded .pct {
  color: #8cf0ae;
}

.card.running {
  border-color: rgba(120, 200, 230, 0.7);
}

.card.running .dot {
  background: #5ec8e8;
  box-shadow: 0 0 0 4px rgba(94, 200, 232, 0.18);
}

.card.pending {
  border-color: rgba(140, 220, 175, 0.28);
}

.card.pending .dot {
  background: rgba(214, 245, 228, 0.4);
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

.card.is-open {
  box-shadow: 0 0 0 2px rgba(140, 240, 174, 0.4);
}

.more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  padding: 0;
  border: 1px solid rgba(140, 220, 175, 0.4);
  border-radius: 6px;
  color: #d8ffe9;
  background: rgba(4, 24, 18, 0.72);
  cursor: pointer;
}

.more > i {
  width: 0;
  height: 0;
  border-right: 3.5px solid transparent;
  border-left: 3.5px solid transparent;
  border-top: 4.5px solid currentColor;
  /* 倒三角视觉重心偏下，略上移做光学居中；旋转 180° 后同样合适 */
  transform: translateY(-0.5px);
}

.more.is-open {
  transform: rotate(180deg);
  color: #042117;
  border-color: transparent;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
}

.panel {
  position: fixed;
  z-index: 40;
  display: grid;
  gap: 8px;
  max-height: min(420px, 70vh);
  padding: 12px;
  overflow: auto;
  border: 1px solid rgba(140, 220, 175, 0.35);
  border-radius: 12px;
  background: rgba(6, 28, 22, 0.98);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4);
}

.panel h4 {
  margin: 0;
  color: rgba(214, 245, 228, 0.72);
  font-size: 12px;
  font-weight: 600;
}

.panel label,
.file-picked {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid rgba(140, 220, 175, 0.2);
  border-radius: 8px;
  color: #8dffc8;
  background: rgba(3, 18, 14, 0.45);
  font-size: 12px;
  word-break: break-all;
}

.file-block {
  display: grid;
  gap: 4px;
  color: #edfff6;
  font-size: 12px;
}

.panel :deep(.field) {
  width: 100%;
  min-width: 0;
}

.panel :deep(.field > button) {
  height: 32px;
  border-color: transparent;
  background: rgba(3, 18, 14, 0.72);
  box-shadow: 0 0 0 1px rgba(140, 220, 175, 0.32) inset;
  transition: box-shadow 0.15s ease, background 0.15s ease;
}

.panel :deep(.field > button:hover:not(:disabled)),
.panel :deep(.field.is-open > button) {
  border-color: transparent;
  background: rgba(4, 28, 22, 0.92);
  box-shadow: 0 0 0 1px #3dce7c inset, 0 0 0 3px rgba(61, 206, 124, 0.16);
}

.panel input[type='number'],
.panel input[type='text'] {
  width: 100%;
  height: 32px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: #f3fff8;
  background: rgba(3, 18, 14, 0.72);
  box-shadow: 0 0 0 1px rgba(140, 220, 175, 0.32) inset;
  font: inherit;
  color-scheme: dark;
  outline: none;
  transition: box-shadow 0.15s ease, background 0.15s ease;
}

.panel .num {
  position: relative;
  display: flex;
  align-items: stretch;
}

.panel .num > input {
  padding-right: 28px;
}

.panel .num > input::-webkit-outer-spin-button,
.panel .num > input::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}

.panel .num > input[type='number'] {
  appearance: textfield;
  -moz-appearance: textfield;
}

.panel .spin {
  position: absolute;
  top: 4px;
  right: 4px;
  bottom: 4px;
  display: grid;
  grid-template-rows: 1fr 1fr;
  width: 18px;
  overflow: hidden;
  border: 1px solid rgba(140, 220, 175, 0.28);
  border-radius: 5px;
  background: rgba(8, 36, 28, 0.92);
}

.panel .spin button {
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  color: rgba(214, 245, 228, 0.78);
  background: transparent;
  cursor: pointer;
}

.panel .spin button + button {
  border-top: 1px solid rgba(140, 220, 175, 0.22);
}

.panel .spin button::before {
  content: '';
  width: 0;
  height: 0;
  border-right: 3.5px solid transparent;
  border-left: 3.5px solid transparent;
}

.panel .spin button:first-child::before {
  border-bottom: 4px solid currentColor;
}

.panel .spin button:last-child::before {
  border-top: 4px solid currentColor;
}

.panel .spin button:hover {
  color: #8dffc8;
  background: rgba(61, 206, 124, 0.16);
}

.panel .spin button:active {
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
}

.panel input[type='number']:hover,
.panel input[type='text']:hover,
.panel .num:hover > input {
  background: rgba(4, 26, 20, 0.88);
  box-shadow: 0 0 0 1px rgba(140, 220, 175, 0.48) inset;
}

.panel input[type='number']:focus,
.panel input[type='text']:focus,
.panel .num:focus-within > input {
  background: rgba(4, 28, 22, 0.92);
  box-shadow: 0 0 0 1px #3dce7c inset, 0 0 0 3px rgba(61, 206, 124, 0.16);
}

.panel input[type='checkbox'] {
  width: 16px;
  height: 16px;
  margin: 6px 0 0;
  accent-color: #2fbf6a;
  color-scheme: dark;
  cursor: pointer;
}

.panel input[readonly] {
  color: rgba(214, 245, 228, 0.72);
  cursor: default;
}

.panel input[readonly]:hover,
.panel input[readonly]:focus {
  background: rgba(3, 18, 14, 0.72);
  box-shadow: 0 0 0 1px rgba(140, 220, 175, 0.32) inset;
}

.files {
  display: grid;
  gap: 6px;
  max-height: 140px;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.files button {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 6px;
  align-items: center;
  width: 100%;
  padding: 6px;
  border: 1px solid rgba(140, 220, 175, 0.2);
  border-radius: 8px;
  color: #edfff6;
  background: rgba(8, 32, 24, 0.72);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.files em {
  color: #8cf0ae;
  font-style: normal;
}

.files span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.files button.is-on {
  border-color: transparent;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
}

.files button.is-on em {
  color: #042117;
}

.below {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.stem {
  width: 1.5px;
  height: 22px;
  margin-top: -8px;
  margin-bottom: -1px;
  background: rgba(160, 230, 190, 0.8);
}

.join {
  display: none;
}

.row {
  --gap: 12px;
  --line: rgba(160, 230, 190, 0.8);
  position: relative;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(180px, 1fr);
  gap: var(--gap);
  align-items: start;
  width: max-content;
  min-width: 100%;
}

.row > :deep(.branch) {
  position: relative;
  padding-top: 18px;
}

.row > :deep(.branch)::after {
  content: '';
  position: absolute;
  top: 0;
  right: calc(var(--gap) * -1);
  left: 0;
  height: 1.5px;
  background: var(--line);
}

.row > :deep(.branch:first-child)::after {
  left: 50%;
}

.row > :deep(.branch:last-child)::after {
  right: 50%;
}

.row > :deep(.branch:only-child)::after {
  display: none;
}

.row :deep(.module) {
  width: 100%;
}

.row > :deep(.branch) > .join {
  display: block;
  position: absolute;
  top: 0;
  left: 50%;
  width: 1.5px;
  height: 12px;
  background: var(--line);
  transform: translateX(-50%);
}

.row > :deep(.branch) > .join::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  border-right: 4px solid transparent;
  border-left: 4px solid transparent;
  border-top: 6px solid rgba(160, 230, 190, 0.95);
  transform: translateX(-50%);
}
</style>
