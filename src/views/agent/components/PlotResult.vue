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
        <span>{{ file.name }}</span>
        <button v-if="file.ext === 'PDF'" type="button" @click="openPdf(file)">{{ t('plot.open') }}</button>
        <button v-if="file.ext === 'SHP' || file.ext === 'TIF'" type="button" @click="load(file)">{{ t('plot.map') }}</button>
        <button type="button" @click="download(file)">{{ t('plot.download') }}</button>
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
}

.files {
  display: grid;
  gap: 8px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.files li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.files span {
  min-width: 0;
  margin-right: auto;
}

button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(140, 220, 175, 0.32);
  border-radius: 8px;
  color: #e7fff4;
  background: transparent;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
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
