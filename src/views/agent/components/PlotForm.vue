<script setup>
import { plotOptions, plotStages } from '../plot.js'
import { t } from '@/i18n'
import SelectMenu from '@/components/SelectMenu.vue'

defineProps({
  form: { type: Object, required: true },
  done: { type: Boolean, default: false },
})

const emit = defineEmits(['update', 'run'])

function patch(key, value) {
  emit('update', { [key]: value })
}
</script>

<template>
  <div class="form">
    <p>{{ t('plot.hint') }}</p>
    <div class="stages">
      <button
        v-for="item in plotStages"
        :key="item.id"
        type="button"
        :class="{ 'is-on': form.stage === item.id }"
        :disabled="done"
        @click="patch('stage', item.id)"
      >
        {{ t(item.labelKey) }}
      </button>
    </div>
    <template v-if="form.stage === 'free'">
      <label>{{ t('plot.folder') }}<SelectMenu :model-value="form.folder" :options="plotOptions.folder" :disabled="done" @update:model-value="patch('folder', $event)" /></label>
      <label>{{ t('plot.pose') }}<SelectMenu :model-value="form.pose" :options="plotOptions.pose.map((item) => ({ value: item.id, label: t(item.labelKey) }))" :disabled="done" @update:model-value="patch('pose', $event)" /></label>
      <label>{{ t('plot.model') }}<SelectMenu :model-value="form.model" :options="plotOptions.model" :disabled="done" @update:model-value="patch('model', $event)" /></label>
    </template>
    <template v-else>
      <label>{{ t('plot.source') }}<SelectMenu :model-value="form.source" :options="plotOptions.source.map((item) => ({ value: item.id, label: t(item.labelKey) }))" :disabled="done" @update:model-value="patch('source', $event)" /></label>
      <label>{{ t('plot.shp') }}<SelectMenu :model-value="form.shp" :options="plotOptions.shp" :disabled="done" @update:model-value="patch('shp', $event)" /></label>
      <label v-if="form.source === 'both'">{{ t('plot.tif') }}<SelectMenu :model-value="form.tif" :options="plotOptions.tif" :disabled="done" @update:model-value="patch('tif', $event)" /></label>
      <label>{{ t('plot.quality') }}<SelectMenu :model-value="form.quality" :options="plotOptions.quality" :disabled="done" @update:model-value="patch('quality', $event)" /></label>
    </template>
    <button type="button" class="run" :disabled="done" @click="emit('run')">{{ done ? t('plot.ran') : t('plot.run') }}</button>
  </div>
</template>

<style scoped>
.form {
  display: grid;
  gap: 10px;
}

p {
  margin: 0;
}

.stages,
label {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

label {
  color: rgba(214, 245, 228, 0.72);
}

button {
  height: 34px;
  border: 1px solid rgba(140, 220, 175, 0.32);
  border-radius: 8px;
  color: #f3fff8;
  background: rgba(3, 18, 14, 0.55);
  font: inherit;
}

.stages button {
  padding: 0 12px;
  cursor: pointer;
}

.stages button.is-on,
.run {
  border-color: transparent;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
}

.run {
  justify-self: start;
  padding: 0 18px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
