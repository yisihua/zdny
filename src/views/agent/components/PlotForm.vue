<script setup>
import { plotOptions, plotStages } from '../plot.js'
import { t } from '@/i18n'

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
      <label>{{ t('plot.folder') }}<select :value="form.folder" :disabled="done" @change="patch('folder', $event.target.value)"><option v-for="item in plotOptions.folder" :key="item">{{ item }}</option></select></label>
      <label>{{ t('plot.pose') }}<select :value="form.pose" :disabled="done" @change="patch('pose', $event.target.value)"><option v-for="item in plotOptions.pose" :key="item.id" :value="item.id">{{ t(item.labelKey) }}</option></select></label>
      <label>{{ t('plot.model') }}<select :value="form.model" :disabled="done" @change="patch('model', $event.target.value)"><option v-for="item in plotOptions.model" :key="item">{{ item }}</option></select></label>
    </template>
    <template v-else>
      <label>{{ t('plot.source') }}<select :value="form.source" :disabled="done" @change="patch('source', $event.target.value)"><option v-for="item in plotOptions.source" :key="item.id" :value="item.id">{{ t(item.labelKey) }}</option></select></label>
      <label>{{ t('plot.shp') }}<select :value="form.shp" :disabled="done" @change="patch('shp', $event.target.value)"><option v-for="item in plotOptions.shp" :key="item">{{ item }}</option></select></label>
      <label v-if="form.source === 'both'">{{ t('plot.tif') }}<select :value="form.tif" :disabled="done" @change="patch('tif', $event.target.value)"><option v-for="item in plotOptions.tif" :key="item">{{ item }}</option></select></label>
      <label>{{ t('plot.quality') }}<select :value="form.quality" :disabled="done" @change="patch('quality', $event.target.value)"><option v-for="item in plotOptions.quality" :key="item">{{ item }}</option></select></label>
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

select,
button {
  height: 34px;
  border: 1px solid rgba(140, 220, 175, 0.32);
  border-radius: 8px;
  color: #f3fff8;
  background: rgba(3, 18, 14, 0.55);
  font: inherit;
}

select {
  min-width: 180px;
  padding: 0 8px;
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
