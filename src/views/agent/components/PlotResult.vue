<script setup>
import { ref } from 'vue'
import { useMapPanel } from '@/components/map/context.js'
import { t } from '@/i18n'

defineProps({
  result: { type: Object, required: true },
})

const { openMap } = useMapPanel()
const pdfFile = ref(null)

function load(file) {
  openMap({
    fileName: file.name,
    ext: file.ext,
    code: 'PLOT',
    name: file.name.replace(/\.[^.]+$/, ''),
  })
}

function openPdf(file) {
  pdfFile.value = file
}

function download(file) {
  const blob = new Blob([`${file.name}\n`], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="result">
    <h3>{{ t(result.titleKey) }}</h3>
    <ul class="files">
      <li v-for="file in result.files" :key="file.name">
        <em>{{ file.ext }}</em>
        <span>{{ file.name }}</span>
        <div class="ops">
          <button v-if="file.ext === 'PDF'" type="button" class="primary" @click="openPdf(file)">{{ t('plot.open') }}</button>
          <button v-if="file.ext === 'SHP' || file.ext === 'TIF'" type="button" class="primary" @click="load(file)">{{ t('plot.map') }}</button>
          <button type="button" @click="download(file)">{{ t('plot.download') }}</button>
        </div>
      </li>
    </ul>
    <p class="note">{{ t('plot.note') }}</p>
    <div v-if="pdfFile" class="mask" @click.self="pdfFile = null">
      <section class="sheet" role="dialog" :aria-label="pdfFile.name">
        <header>
          <h3>{{ pdfFile.name }}</h3>
          <button type="button" class="close" @click="pdfFile = null">{{ t('map.close') }}</button>
        </header>
        <p>{{ t('plot.pdfNote') }}</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
h3,
p {
  margin: 0;
}

h3 {
  font-size: 16px;
  letter-spacing: 0.02em;
}

.files {
  display: grid;
  gap: 8px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.files li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 10px;
  border: 1px solid rgba(140, 220, 175, 0.16);
  border-radius: 10px;
  background: rgba(8, 36, 28, 0.55);
}

.files em {
  width: 72px;
  padding: 2px 0;
  border-radius: 6px;
  color: #8cf0ae;
  background: rgba(47, 191, 106, 0.14);
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-align: center;
}

.files span {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ops {
  display: flex;
  gap: 6px;
}

button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(140, 220, 175, 0.28);
  border-radius: 8px;
  color: #d8ffe9;
  background: transparent;
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}

button:hover {
  border-color: rgba(140, 240, 174, 0.7);
}

.primary {
  border-color: transparent;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
}

.note {
  margin-top: 10px;
  color: rgba(214, 245, 228, 0.55);
  font-size: 13px;
}

.mask {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(2, 10, 8, 0.66);
}

.sheet {
  width: min(520px, 100%);
  padding: 18px;
  border: 1px solid rgba(140, 220, 175, 0.28);
  border-radius: 16px;
  background: #071910;
}

.sheet header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.close {
  border: none;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
}

.sheet p {
  color: rgba(214, 245, 228, 0.72);
}
</style>
