<script setup>
import { t } from '@/i18n'

defineProps({
  projectId: { type: String, default: '' },
  year: { type: [String, Number], default: '' },
  location: { type: String, default: '' },
  collectionDate: { type: String, default: '' },
  sensor: { type: String, default: '' },
  projects: { type: Array, default: () => [] },
})

defineEmits([
  'update:projectId',
  'update:year',
  'update:location',
  'update:collectionDate',
  'update:sensor',
  'search',
  'reset',
])
</script>

<template>
  <div class="filters">
    <p class="caption">{{ t('data.caption') }}</p>
    <div class="row">
      <el-select
        :model-value="projectId"
        clearable
        filterable
        :placeholder="t('data.project')"
        class="field"
        popper-class="data-filter-popper"
        @update:model-value="$emit('update:projectId', $event || '')"
      >
        <el-option
          v-for="item in projects"
          :key="item.id"
          :label="item.name"
          :value="String(item.id)"
        />
      </el-select>
      <el-input
        :model-value="year === '' || year == null ? '' : String(year)"
        clearable
        :placeholder="t('data.year')"
        class="field short"
        @update:model-value="$emit('update:year', $event)"
      />
      <el-input
        :model-value="location"
        clearable
        :placeholder="t('data.location')"
        class="field"
        @update:model-value="$emit('update:location', $event)"
      />
      <el-date-picker
        :model-value="collectionDate || null"
        type="date"
        value-format="YYYY-MM-DD"
        :placeholder="t('data.collectionDate')"
        class="field date"
        popper-class="data-filter-popper"
        @update:model-value="$emit('update:collectionDate', $event || '')"
      />
      <el-input
        :model-value="sensor"
        clearable
        :placeholder="t('data.sensor')"
        class="field"
        @update:model-value="$emit('update:sensor', $event)"
      />
      <button type="button" class="primary" @click="$emit('search')">{{ t('data.search') }}</button>
      <button type="button" class="ghost" @click="$emit('reset')">{{ t('data.reset') }}</button>
    </div>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid rgba(140, 220, 175, 0.16);
  border-radius: 12px;
  background: rgba(3, 18, 14, 0.35);
}

.caption {
  margin: 0;
  color: rgba(214, 245, 228, 0.62);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.field {
  width: min(180px, 100%);
}

.field.short {
  width: 110px;
}

.field.date {
  width: min(180px, 100%);
}

.filters :deep(.el-input__wrapper),
.filters :deep(.el-select__wrapper),
.filters :deep(.el-date-editor.el-input__wrapper),
.filters :deep(.el-date-editor .el-input__wrapper) {
  min-height: 34px;
  border-radius: 8px;
  color: #f3fff8;
  background: rgba(3, 18, 14, 0.72);
  box-shadow: 0 0 0 1px rgba(140, 220, 175, 0.32) inset !important;
  transition: box-shadow 0.15s ease, background 0.15s ease;
}

.filters :deep(.el-input__wrapper:hover),
.filters :deep(.el-select__wrapper:hover),
.filters :deep(.el-date-editor.el-input__wrapper:hover) {
  background: rgba(4, 26, 20, 0.88);
  box-shadow: 0 0 0 1px rgba(140, 220, 175, 0.48) inset !important;
}

.filters :deep(.el-input__wrapper.is-focus),
.filters :deep(.el-select__wrapper.is-focused),
.filters :deep(.el-select__wrapper.is-hovering),
.filters :deep(.el-date-editor.el-input__wrapper.is-focus) {
  background: rgba(4, 28, 22, 0.92);
  box-shadow: 0 0 0 1px #3dce7c inset, 0 0 0 3px rgba(61, 206, 124, 0.16) !important;
}

.filters :deep(.el-input__inner),
.filters :deep(.el-select__selected-item),
.filters :deep(.el-select__input),
.filters :deep(.el-range-input) {
  color: #f3fff8;
  color-scheme: dark;
}

.filters :deep(.el-input__inner::placeholder),
.filters :deep(.el-select__placeholder),
.filters :deep(.el-range-input::placeholder) {
  color: rgba(198, 224, 210, 0.5);
}

.filters :deep(.el-input__prefix),
.filters :deep(.el-input__suffix),
.filters :deep(.el-select__caret),
.filters :deep(.el-select__clear),
.filters :deep(.el-input__clear),
.filters :deep(.el-range__icon),
.filters :deep(.el-range__close-icon) {
  color: rgba(198, 232, 214, 0.78);
}

.filters :deep(.el-select__caret:hover),
.filters :deep(.el-select__clear:hover),
.filters :deep(.el-input__clear:hover) {
  color: #8dffc8;
}

button {
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

button.ghost {
  border: 1px solid rgba(140, 220, 175, 0.32);
  color: #f3fff8;
  background: rgba(3, 18, 14, 0.55);
}

button.ghost:hover {
  border-color: rgba(140, 220, 175, 0.5);
  background: rgba(4, 26, 20, 0.75);
}

button.primary {
  border: none;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
}
</style>

<style>
/* 下拉/日期弹层挂到 body，需全局类名 */
.data-filter-popper.el-popper,
.data-filter-popper.el-picker__popper {
  border: 1px solid rgba(140, 220, 175, 0.28) !important;
  border-radius: 10px !important;
  background: rgba(6, 28, 22, 0.98) !important;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4) !important;
  color: #edfff6 !important;
}

.data-filter-popper .el-select-dropdown__item,
.data-filter-popper .el-picker-panel,
.data-filter-popper .el-date-picker__header-label,
.data-filter-popper .el-date-table th,
.data-filter-popper .el-date-table td .el-date-table-cell__text {
  color: #edfff6;
}

.data-filter-popper .el-select-dropdown__item.is-hovering,
.data-filter-popper .el-select-dropdown__item:hover {
  background: rgba(61, 206, 124, 0.16);
  color: #8dffc8;
}

.data-filter-popper .el-select-dropdown__item.is-selected {
  color: #8cf0ae;
  font-weight: 700;
  background: transparent;
}

.data-filter-popper .el-picker-panel,
.data-filter-popper .el-date-picker {
  background: transparent;
  color: #edfff6;
}

.data-filter-popper .el-picker-panel__icon-btn,
.data-filter-popper .el-date-table td.available:hover .el-date-table-cell__text {
  color: #8dffc8;
}

.data-filter-popper .el-date-table td.current:not(.disabled) .el-date-table-cell__text {
  color: #042117;
  background: #2fbf6a;
}

.data-filter-popper .el-popper__arrow::before {
  border: 1px solid rgba(140, 220, 175, 0.28) !important;
  background: rgba(6, 28, 22, 0.98) !important;
}
</style>
