<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { fetchSystemResources } from '@/api/system'
import { t } from '@/i18n'

const POLL_MS = 45000
const GAUGE_R = 42
const GAUGE_C = 2 * Math.PI * GAUGE_R

const loading = ref(false)
const payload = ref(null)
const errorText = ref('')
const lastFetchedAt = ref(0)
const ready = ref(false)
const anim = ref({
  cpu: 0,
  memory: 0,
  disks: [],
  gpus: [],
})

let pollTimer = 0
let visible = true
let rafId = 0

const available = computed(() => payload.value?.available === true)
const metrics = computed(() => (available.value ? payload.value?.metrics || null : null))
const alerts = computed(() => (Array.isArray(payload.value?.alerts) ? payload.value.alerts : []))
const thresholds = computed(() =>
  available.value && payload.value?.thresholds && typeof payload.value.thresholds === 'object'
    ? payload.value.thresholds
    : null,
)
const warnings = computed(() => {
  const list = metrics.value?.warnings
  return Array.isArray(list) ? list.filter((item) => typeof item === 'string' && item) : []
})
const disks = computed(() => (Array.isArray(metrics.value?.disks) ? metrics.value.disks : []))
const gpus = computed(() => (Array.isArray(metrics.value?.gpus) ? metrics.value.gpus : []))

const cpuTarget = computed(() => asNumber(metrics.value?.cpu?.usedPercent) ?? 0)
const memTarget = computed(() => asNumber(metrics.value?.memory?.usedPercent) ?? 0)

const thresholdChips = computed(() => {
  const map = thresholds.value
  if (!map) return []
  return [
    { key: 'cpu', label: t('system.resourceCpu'), value: formatPercent(map['monitor.cpu.percent']) },
    { key: 'mem', label: t('system.resourceMemory'), value: formatPercent(map['monitor.memory.percent']) },
    { key: 'disk', label: t('system.resourceDisk'), value: formatPercent(map['monitor.disk.percent']) },
    { key: 'gpu', label: t('system.resourceGpu'), value: formatPercent(map['monitor.gpu.percent']) },
    {
      key: 'conc',
      label: t('system.resourceMaxConcurrency'),
      value: isPresent(map['task.max-concurrency']) ? String(map['task.max-concurrency']) : t('system.resourceUnknown'),
    },
    {
      key: 'timeout',
      label: t('system.resourceTimeout'),
      value: isPresent(map['task.timeout-seconds'])
        ? t('system.resourceSeconds', { n: map['task.timeout-seconds'] })
        : t('system.resourceUnknown'),
    },
    {
      key: 'queue',
      label: t('system.resourceMaxQueued'),
      value: isPresent(map['task.max-queued']) ? String(map['task.max-queued']) : t('system.resourceUnknown'),
    },
  ]
})

function isPresent(value) {
  return value !== null && value !== undefined && value !== ''
}

function asNumber(value) {
  if (!isPresent(value)) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function clampPercent(value) {
  const n = asNumber(value)
  if (n == null) return 0
  return Math.max(0, Math.min(100, n))
}

function formatPercent(value) {
  const n = asNumber(value)
  if (n == null) return t('system.resourceUnknown')
  return `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`
}

function formatAnimPercent(value) {
  return `${Number(value || 0).toFixed(value >= 10 || value === 0 ? 1 : 1)}%`
}

function formatBytes(value) {
  const n = asNumber(value)
  if (n == null) return t('system.resourceUnknown')
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let size = n
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  const digits = size >= 100 || unit === 0 ? 0 : size >= 10 ? 1 : 2
  return `${size.toFixed(digits)} ${units[unit]}`
}

function formatMib(value) {
  const n = asNumber(value)
  if (n == null) return t('system.resourceUnknown')
  return formatBytes(n * 1024 * 1024)
}

function formatLoad(list) {
  if (!Array.isArray(list) || !list.length) return t('system.resourceUnknown')
  return list
    .map((item) => {
      const n = asNumber(item)
      return n == null ? '-' : n.toFixed(2)
    })
    .join(' / ')
}

function formatSampledAt(raw) {
  const n = asNumber(raw)
  if (n == null) return t('system.resourceUnknown')
  const ms = n > 1e12 ? n : n * 1000
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return String(raw)
  const pad = (v) => String(v).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatAge(value) {
  const n = asNumber(value)
  if (n == null) return t('system.resourceUnknown')
  if (n < 60) return t('system.resourceAgeSec', { n: Math.round(n) })
  if (n < 3600) return t('system.resourceAgeMin', { n: Math.round(n / 60) })
  return t('system.resourceAgeHour', { n: (n / 3600).toFixed(1) })
}

function alertLabel(metric) {
  const key = String(metric || '').toUpperCase()
  if (key === 'CPU') return t('system.resourceCpu')
  if (key === 'MEMORY' || key === 'MEM') return t('system.resourceMemory')
  if (key === 'DISK') return t('system.resourceDisk')
  if (key === 'GPU') return t('system.resourceGpu')
  return metric || t('system.resourceUnknown')
}

function barTone(value, threshold) {
  const n = asNumber(value)
  if (n == null) return ''
  const limit = asNumber(threshold)
  if (limit != null && n >= limit) return 'danger'
  if (limit != null && n >= limit * 0.85) return 'warn'
  if (n >= 85) return 'warn'
  return ''
}

function gaugeOffset(percent) {
  const p = clampPercent(percent) / 100
  return GAUGE_C * (1 - p)
}

function gpuShortName(gpu, index) {
  const name = String(gpu?.name || '')
  if (!name) return t('system.resourceGpuItem', { n: gpu?.index ?? index })
  return name.replace(/^NVIDIA\s+GeForce\s+/i, '').replace(/^NVIDIA\s+/i, '')
}

function lerp(from, to, tValue) {
  return from + (to - from) * tValue
}

function animateToTargets() {
  if (rafId) cancelAnimationFrame(rafId)
  const from = {
    cpu: anim.value.cpu,
    memory: anim.value.memory,
    disks: disks.value.map((_, i) => anim.value.disks[i] ?? 0),
    gpus: gpus.value.map((_, i) => anim.value.gpus[i] ?? 0),
  }
  const to = {
    cpu: cpuTarget.value,
    memory: memTarget.value,
    disks: disks.value.map((disk) => clampPercent(disk.usedPercent)),
    gpus: gpus.value.map((gpu) => clampPercent(gpu.usedPercent)),
  }
  const start = performance.now()
  const duration = 780

  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration)
    const ease = 1 - (1 - progress) ** 3
    anim.value = {
      cpu: lerp(from.cpu, to.cpu, ease),
      memory: lerp(from.memory, to.memory, ease),
      disks: to.disks.map((value, i) => lerp(from.disks[i] ?? 0, value, ease)),
      gpus: to.gpus.map((value, i) => lerp(from.gpus[i] ?? 0, value, ease)),
    }
    if (progress < 1) rafId = requestAnimationFrame(tick)
    else rafId = 0
  }
  rafId = requestAnimationFrame(tick)
}

async function load({ silent = false } = {}) {
  if (!visible) return
  if (!silent) loading.value = true
  errorText.value = ''
  try {
    const data = await fetchSystemResources()
    payload.value = data && typeof data === 'object' ? data : null
    lastFetchedAt.value = Date.now()
    await nextTick()
    if (available.value) {
      ready.value = true
      animateToTargets()
    } else {
      ready.value = false
      anim.value = { cpu: 0, memory: 0, disks: [], gpus: [] }
    }
  } catch (error) {
    errorText.value = error?.msg || error?.message || t('system.resourceLoadFailed')
    if (!silent) payload.value = null
  } finally {
    loading.value = false
  }
}

function startPoll() {
  stopPoll()
  pollTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') load({ silent: true })
  }, POLL_MS)
}

function stopPoll() {
  if (pollTimer) {
    window.clearInterval(pollTimer)
    pollTimer = 0
  }
}

function onVisibility() {
  if (document.visibilityState === 'visible') {
    load({ silent: true })
    startPoll()
  } else {
    stopPoll()
  }
}

onMounted(() => {
  visible = true
  load()
  startPoll()
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  visible = false
  stopPoll()
  if (rafId) cancelAnimationFrame(rafId)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <section class="panel" :class="{ 'is-ready': ready }">
    <header class="top">
      <div class="title">
        <h1>{{ t('system.resource') }}</h1>
        <div v-if="payload" class="status-inline">
          <em :class="available ? 'on' : 'off'">
            {{ available ? t('system.resourceAvailable') : t('system.resourceUnavailable') }}
          </em>
          <span v-if="available && metrics?.hostname">{{ metrics.hostname }}</span>
          <span v-if="available && isPresent(payload.sampledAt)">{{ formatSampledAt(payload.sampledAt) }}</span>
          <span v-if="available && isPresent(payload.ageSeconds)">{{ formatAge(payload.ageSeconds) }}</span>
        </div>
        <p v-else class="hint">{{ t('system.resourceHint') }}</p>
      </div>
      <button type="button" class="ghost" :class="{ 'is-loading': loading }" :disabled="loading" @click="load()">
        <i class="refresh-icon" aria-hidden="true" />
        {{ loading ? t('system.loading') : t('system.resourceRefresh') }}
      </button>
    </header>

    <div v-if="loading && !payload" class="state">{{ t('system.loading') }}</div>
    <div v-else-if="errorText && !payload" class="state deny">{{ errorText }}</div>

    <div v-else-if="payload && !available" class="unavailable">
      <p>{{ payload.reason || t('system.resourceUnavailableTip') }}</p>
      <p class="note">{{ t('system.resourceUnavailableNote') }}</p>
    </div>

    <div v-else-if="payload" class="board">
      <div v-if="alerts.length || warnings.length" class="banners">
        <div v-if="alerts.length" class="banner alert">
          <strong>{{ t('system.resourceAlerts') }}</strong>
          <span v-for="(item, index) in alerts.slice(0, 3)" :key="`a-${index}`">
            {{ alertLabel(item.metric) }} {{ formatPercent(item.value) }}
          </span>
        </div>
        <div v-if="warnings.length" class="banner warn">
          <strong>{{ t('system.resourceWarnings') }}</strong>
          <span>{{ warnings[0] }}</span>
        </div>
      </div>

      <div class="gauges">
        <article class="gauge-card" style="--delay: 0ms">
          <div class="gauge" :class="barTone(cpuTarget, thresholds?.['monitor.cpu.percent'])">
            <svg viewBox="0 0 108 108" aria-hidden="true">
              <circle class="track" cx="54" cy="54" :r="GAUGE_R" />
              <circle
                class="value"
                cx="54"
                cy="54"
                :r="GAUGE_R"
                :stroke-dasharray="GAUGE_C"
                :stroke-dashoffset="gaugeOffset(anim.cpu)"
              />
            </svg>
            <div class="gauge-text">
              <strong>{{ formatAnimPercent(anim.cpu) }}</strong>
              <span>{{ t('system.resourceCpu') }}</span>
            </div>
          </div>
          <ul class="facts">
            <li>
              <span>{{ t('system.resourceLogicalCpus') }}</span>
              <em>{{ isPresent(metrics?.cpu?.logicalCpus) ? metrics.cpu.logicalCpus : t('system.resourceUnknown') }}</em>
            </li>
            <li>
              <span>{{ t('system.resourceLoad') }}</span>
              <em>{{ formatLoad(metrics?.cpu?.loadAverage) }}</em>
            </li>
          </ul>
        </article>

        <article class="gauge-card" style="--delay: 80ms">
          <div class="gauge" :class="barTone(memTarget, thresholds?.['monitor.memory.percent'])">
            <svg viewBox="0 0 108 108" aria-hidden="true">
              <circle class="track" cx="54" cy="54" :r="GAUGE_R" />
              <circle
                class="value"
                cx="54"
                cy="54"
                :r="GAUGE_R"
                :stroke-dasharray="GAUGE_C"
                :stroke-dashoffset="gaugeOffset(anim.memory)"
              />
            </svg>
            <div class="gauge-text">
              <strong>{{ formatAnimPercent(anim.memory) }}</strong>
              <span>{{ t('system.resourceMemory') }}</span>
            </div>
          </div>
          <ul class="facts">
            <li>
              <span>{{ t('system.resourceTotal') }}</span>
              <em>{{ formatBytes(metrics?.memory?.totalBytes) }}</em>
            </li>
            <li>
              <span>{{ t('system.resourceAvailableMem') }}</span>
              <em>{{ formatBytes(metrics?.memory?.availableBytes) }}</em>
            </li>
          </ul>
        </article>

        <article class="gpu-card" style="--delay: 160ms">
          <header>
            <h2>{{ t('system.resourceGpu') }}</h2>
            <em :class="metrics?.gpuAvailable ? 'on' : 'off'">
              {{ metrics?.gpuAvailable ? t('system.resourceGpuOn') : t('system.resourceGpuOff') }}
            </em>
          </header>
          <p v-if="!gpus.length" class="empty">{{ t('system.resourceGpuEmpty') }}</p>
          <div v-else class="gpu-grid">
            <div v-for="(gpu, index) in gpus" :key="gpu.index ?? index" class="gpu-item">
              <div class="gpu-head">
                <span :title="gpu.name">{{ gpuShortName(gpu, index) }}</span>
                <strong>{{ formatAnimPercent(anim.gpus[index] || 0) }}</strong>
              </div>
              <div class="bar">
                <i
                  :class="barTone(gpu.usedPercent, thresholds?.['monitor.gpu.percent'])"
                  :style="{ width: `${clampPercent(anim.gpus[index] || 0)}%` }"
                />
              </div>
              <p>
                {{ formatMib(gpu.usedMemoryMiB) }} / {{ formatMib(gpu.totalMemoryMiB) }}
                <template v-if="isPresent(gpu.temperatureCelsius)"> · {{ gpu.temperatureCelsius }}°C</template>
              </p>
            </div>
          </div>
        </article>
      </div>

      <section class="lower" style="--delay: 220ms">
        <div class="disk-panel">
          <header>
            <h2>{{ t('system.resourceDisks') }}</h2>
            <span class="note">{{ t('system.resourceDiskNote') }}</span>
          </header>
          <p v-if="!disks.length" class="empty">{{ t('system.resourceDiskEmpty') }}</p>
          <div v-else class="disk-grid">
            <article
              v-for="(disk, index) in disks"
              :key="`${disk.path}-${index}`"
              class="disk-tile"
              :class="barTone(disk.usedPercent, thresholds?.['monitor.disk.percent'])"
            >
              <div class="disk-top">
                <strong :title="disk.path || '-'">{{ disk.path || '-' }}</strong>
                <em>{{ formatAnimPercent(anim.disks[index] || 0) }}</em>
              </div>
              <div class="meter">
                <i :style="{ width: `${clampPercent(anim.disks[index] || 0)}%` }" />
              </div>
              <div class="disk-stats">
                <span>{{ t('system.resourceFree') }} {{ formatBytes(disk.availableBytes) }}</span>
                <span>{{ t('system.resourceTotal') }} {{ formatBytes(disk.totalBytes) }}</span>
              </div>
            </article>
          </div>
        </div>

        <div v-if="thresholdChips.length" class="limit-panel">
          <h2>{{ t('system.resourceThresholds') }}</h2>
          <div class="limit-grid">
            <div v-for="item in thresholdChips" :key="item.key" class="limit-tile">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  max-height: 100%;
  padding: 14px 16px 12px;
  overflow: hidden;
}

.top {
  display: flex;
  flex: 0 0 auto;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10px;
}

.title h1 {
  margin: 0;
  font-size: 18px;
}

.hint,
.note,
.empty {
  margin: 0;
  color: rgba(214, 245, 228, 0.58);
  font-size: 12px;
  line-height: 1.4;
}

.status-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  margin-top: 6px;
  color: rgba(214, 245, 228, 0.7);
  font-size: 12px;
}

.status-inline em,
.gpu-card header em {
  padding: 2px 8px;
  border-radius: 999px;
  font-style: normal;
  font-weight: 700;
}

.status-inline em.on,
.gpu-card header em.on {
  position: relative;
  overflow: hidden;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
}

.status-inline em.on::after,
.gpu-card header em.on::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 35%, rgba(255, 255, 255, 0.45) 50%, transparent 65%);
  transform: translateX(-120%);
  animation: badge-scan 2.8s ease-in-out infinite;
}

.status-inline em.off,
.gpu-card header em.off {
  color: #ffd7a8;
  background: rgba(180, 110, 40, 0.28);
}

.ghost {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  border: 1px solid rgba(140, 220, 175, 0.32);
  border-radius: 8px;
  color: #f3fff8;
  background: rgba(3, 18, 14, 0.55);
  font: inherit;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.ghost:hover:not(:disabled) {
  border-color: rgba(140, 240, 174, 0.5);
  background: rgba(8, 40, 28, 0.72);
}

.ghost:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.refresh-icon {
  width: 12px;
  height: 12px;
  border: 1.5px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
}

.ghost.is-loading .refresh-icon {
  animation: flip-y 0.9s ease-in-out infinite;
}

.state,
.unavailable {
  display: grid;
  place-items: center;
  flex: 1;
  min-height: 0;
  padding: 20px;
  color: rgba(214, 245, 228, 0.7);
  text-align: center;
}

.state.deny {
  color: #ffb4b4;
}

.unavailable {
  border: 1px solid rgba(140, 220, 175, 0.16);
  border-radius: 14px;
  background: rgba(3, 18, 14, 0.4);
}

.unavailable p:first-child {
  margin: 0 0 8px;
  color: #edfff6;
  font-size: 15px;
}

.board {
  display: grid;
  flex: 1;
  grid-template-rows: auto minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
  overflow: hidden;
}

.banners {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.banner {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 12px;
}

.banner.alert {
  border: 1px solid rgba(224, 112, 112, 0.4);
  color: #ffd6d6;
  background: rgba(90, 24, 24, 0.32);
}

.banner.warn {
  border: 1px solid rgba(220, 180, 90, 0.35);
  color: #ffe8c0;
  background: rgba(70, 48, 12, 0.28);
}

.gauges {
  display: grid;
  grid-template-columns: 0.9fr 0.9fr minmax(0, 1.4fr);
  gap: 12px;
  min-height: 0;
  height: 100%;
}

.gauge-card,
.gpu-card,
.lower {
  min-width: 0;
  min-height: 0;
  border: 1px solid rgba(140, 220, 175, 0.16);
  border-radius: 14px;
  background:
    radial-gradient(120% 80% at 0% 0%, rgba(70, 210, 150, 0.08), transparent 55%),
    linear-gradient(180deg, rgba(8, 36, 28, 0.62), rgba(4, 22, 17, 0.82));
  opacity: 0;
  transform: scale(0.96);
  filter: blur(4px);
}

.is-ready .gauge-card,
.is-ready .gpu-card,
.is-ready .lower {
  animation: reveal-card 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: var(--delay, 0ms);
}

.is-ready .gpu-item,
.is-ready .disk-tile,
.is-ready .limit-tile {
  animation: pop-in 0.45s cubic-bezier(0.34, 1.4, 0.64, 1) both;
}

.is-ready .gpu-item:nth-child(1),
.is-ready .disk-tile:nth-child(1),
.is-ready .limit-tile:nth-child(1) { animation-delay: 120ms; }
.is-ready .gpu-item:nth-child(2),
.is-ready .disk-tile:nth-child(2),
.is-ready .limit-tile:nth-child(2) { animation-delay: 180ms; }
.is-ready .gpu-item:nth-child(3),
.is-ready .disk-tile:nth-child(3),
.is-ready .limit-tile:nth-child(3) { animation-delay: 240ms; }
.is-ready .gpu-item:nth-child(4),
.is-ready .disk-tile:nth-child(4),
.is-ready .limit-tile:nth-child(4) { animation-delay: 300ms; }
.is-ready .limit-tile:nth-child(5) { animation-delay: 360ms; }
.is-ready .limit-tile:nth-child(6) { animation-delay: 420ms; }
.is-ready .limit-tile:nth-child(7) { animation-delay: 480ms; }

.gauge-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  height: 100%;
  padding: 16px;
}

.gauge {
  position: relative;
  width: min(132px, 100%);
  aspect-ratio: 1;
  justify-self: center;
}

.gauge::before {
  content: '';
  position: absolute;
  inset: -4px;
  border: 1.5px dashed rgba(140, 240, 174, 0.28);
  border-radius: 50%;
  animation: orbit 10s linear infinite;
  pointer-events: none;
}

.gauge::after {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 2px;
  height: 46%;
  background: linear-gradient(180deg, #8dffc8, transparent);
  transform-origin: bottom center;
  animation: radar-sweep 3.6s linear infinite;
  pointer-events: none;
  opacity: 0.55;
}

.gauge svg {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.gauge circle {
  fill: none;
  stroke-width: 8;
}

.gauge .track {
  stroke: rgba(140, 220, 175, 0.12);
}

.gauge .value {
  stroke: #7cf0b0;
  stroke-linecap: round;
  stroke-dashoffset: inherit;
  transition: stroke 0.3s ease;
}

.gauge.warn .value {
  stroke: #e8c85e;
}

.gauge.danger .value {
  stroke: #ff8f8f;
}

.gauge-text {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-content: center;
  text-align: center;
}

.gauge-text strong {
  color: #8dffc8;
  font-size: clamp(20px, 2.2vh, 26px);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  text-shadow: 0 0 12px rgba(141, 255, 200, 0.25);
}

.gauge-text span {
  color: rgba(214, 245, 228, 0.68);
  font-size: 12px;
}

.facts {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.facts li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: rgba(214, 245, 228, 0.62);
  font-size: 12px;
}

.facts em {
  color: #edfff6;
  font-style: normal;
  text-align: right;
}

.gpu-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 14px;
}

.gpu-card > header,
.disk-panel > header {
  display: flex;
  flex: 0 0 auto;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

h2 {
  margin: 0;
  font-size: 14px;
}

.gpu-grid {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 8px;
  align-content: start;
  min-height: 0;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 210, 160, 0.4) transparent;
}

.gpu-item {
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid rgba(140, 220, 175, 0.12);
  border-radius: 10px;
  background: rgba(3, 18, 14, 0.35);
}

.gpu-head {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.gpu-head span {
  overflow: hidden;
  color: #edfff6;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gpu-head strong {
  flex: 0 0 auto;
  color: #8dffc8;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.gpu-item p {
  margin: 4px 0 0;
  overflow: hidden;
  color: rgba(214, 245, 228, 0.58);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar,
.meter {
  position: relative;
  overflow: hidden;
  height: 6px;
  margin-top: 6px;
  border-radius: 999px;
  background: rgba(140, 220, 175, 0.12);
}

.bar > i,
.meter > i {
  position: relative;
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #5ec8e8, #8cf0ae);
  transition: width 0.05s linear;
}

.bar > i::after,
.meter > i::after {
  content: '';
  position: absolute;
  top: -2px;
  bottom: -2px;
  left: 0;
  width: 3px;
  border-radius: 2px;
  background: #eafff4;
  box-shadow: 0 0 8px rgba(234, 255, 244, 0.8);
  animation: tick-run 1.8s ease-in-out infinite;
}

.bar > i.warn {
  background: linear-gradient(90deg, #e8c85e, #f0ae8c);
}

.bar > i.danger {
  background: linear-gradient(90deg, #e07070, #ff9b9b);
}

.disk-tile.warn .meter > i {
  background: linear-gradient(90deg, #e8c85e, #f0ae8c);
}

.disk-tile.danger .meter > i {
  background: linear-gradient(90deg, #e07070, #ff9b9b);
}

.lower {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 12px;
  height: 100%;
  max-height: 100%;
  padding: 12px;
  overflow: hidden;
}

.disk-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.limit-panel {
  display: grid;
  grid-template-rows: auto auto;
  gap: 8px;
  min-height: 0;
  overflow: hidden;
}

.limit-panel > h2 {
  position: relative;
  z-index: 1;
  margin: 0;
  color: #edfff6;
  font-size: 14px;
  line-height: 1.3;
}

.disk-grid {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  min-height: 0;
}

.disk-tile {
  display: grid;
  grid-template-rows: auto auto auto;
  gap: 10px;
  align-content: center;
  min-width: 0;
  height: 100%;
  padding: 12px 14px;
  border: 1px solid rgba(140, 220, 175, 0.16);
  border-radius: 12px;
  background:
    linear-gradient(135deg, rgba(60, 200, 140, 0.08), transparent 42%),
    rgba(3, 18, 14, 0.42);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.disk-tile:hover,
.limit-tile:hover,
.gpu-item:hover {
  border-color: rgba(140, 240, 174, 0.42);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.18);
  transform: translateY(-2px);
}

.disk-tile,
.limit-tile,
.gpu-item {
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.disk-tile.warn {
  border-color: rgba(220, 180, 90, 0.35);
}

.disk-tile.danger {
  border-color: rgba(224, 112, 112, 0.42);
}

.disk-top {
  display: flex;
  gap: 10px;
  align-items: baseline;
  justify-content: space-between;
}

.disk-top strong {
  overflow: hidden;
  color: #edfff6;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.disk-top em {
  flex: 0 0 auto;
  color: #8dffc8;
  font-size: clamp(20px, 2.4vh, 28px);
  font-style: normal;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 1;
}

.disk-tile.warn .disk-top em {
  color: #f0d28c;
}

.disk-tile.danger .disk-top em {
  color: #ffb0b0;
}

.meter {
  height: 10px;
  margin-top: 0;
  background: rgba(140, 220, 175, 0.1);
  box-shadow: inset 0 0 0 1px rgba(140, 220, 175, 0.08);
}

.disk-stats {
  display: flex;
  gap: 10px;
  justify-content: space-between;
  color: rgba(214, 245, 228, 0.62);
  font-size: 12px;
}

.disk-stats span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.limit-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10px;
}

.limit-tile {
  position: relative;
  display: grid;
  gap: 6px;
  align-content: center;
  justify-items: start;
  min-width: 0;
  min-height: 64px;
  padding: 10px 12px;
  overflow: hidden;
  border: 1px solid rgba(140, 220, 175, 0.16);
  border-radius: 12px;
  background: rgba(3, 18, 14, 0.42);
}

.limit-tile::before {
  content: '';
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 0;
  width: 3px;
  border-radius: 999px;
  background: #8cf0ae;
  transform: scaleY(0.35);
  transform-origin: center;
  animation: bar-breathe 2.2s ease-in-out infinite;
}

.limit-tile span {
  overflow: hidden;
  color: rgba(214, 245, 228, 0.58);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.limit-tile strong {
  color: #edfff6;
  font-size: clamp(15px, 1.8vh, 18px);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

@keyframes reveal-card {
  from {
    opacity: 0;
    transform: scale(0.96);
    filter: blur(4px);
  }

  to {
    opacity: 1;
    transform: scale(1);
    filter: blur(0);
  }
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: scale(0.88);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes badge-scan {
  0%,
  40% {
    transform: translateX(-120%);
  }

  70%,
  100% {
    transform: translateX(120%);
  }
}

@keyframes orbit {
  to {
    transform: rotate(360deg);
  }
}

@keyframes radar-sweep {
  to {
    transform: rotate(360deg);
  }
}

@keyframes tick-run {
  0% {
    left: 0;
    opacity: 0;
  }

  12% {
    opacity: 1;
  }

  88% {
    opacity: 1;
  }

  100% {
    left: calc(100% - 3px);
    opacity: 0;
  }
}

@keyframes bar-breathe {
  0%,
  100% {
    transform: scaleY(0.35);
    opacity: 0.55;
  }

  50% {
    transform: scaleY(1);
    opacity: 1;
  }
}

@keyframes flip-y {
  0% {
    transform: rotateY(0deg);
  }

  50% {
    transform: rotateY(180deg);
  }

  100% {
    transform: rotateY(360deg);
  }
}

@media (max-width: 1200px) {
  .gauges {
    grid-template-columns: 1fr 1fr;
  }

  .gpu-card {
    grid-column: 1 / -1;
  }

  .disk-grid {
    grid-template-columns: 1fr;
  }

  .limit-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .panel {
    overflow: auto;
  }

  .board {
    grid-template-rows: auto;
  }

  .gauges,
  .limit-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .is-ready .gauge-card,
  .is-ready .gpu-card,
  .is-ready .lower,
  .is-ready .gpu-item,
  .is-ready .disk-tile,
  .is-ready .limit-tile,
  .status-inline em.on::after,
  .gpu-card header em.on::after,
  .gauge::before,
  .gauge::after,
  .bar > i::after,
  .meter > i::after,
  .limit-tile::before,
  .ghost.is-loading .refresh-icon {
    animation: none !important;
  }

  .is-ready .gauge-card,
  .is-ready .gpu-card,
  .is-ready .lower,
  .is-ready .gpu-item,
  .is-ready .disk-tile,
  .is-ready .limit-tile {
    opacity: 1;
    filter: none;
    transform: none;
  }

  .bar > i,
  .meter > i,
  .gauge .value,
  .disk-tile,
  .limit-tile,
  .gpu-item {
    transition: none;
  }

  .disk-tile:hover,
  .limit-tile:hover,
  .gpu-item:hover {
    box-shadow: none;
    transform: none;
  }
}
</style>
