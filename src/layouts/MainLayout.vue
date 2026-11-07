<script setup>
import AppHead from '@/components/head/index.vue'
</script>

<template>
  <div class="layout">
    <AppHead />
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.layout {
  height: 100%;
  overflow: auto;
}

.main {
  min-height: calc(100% - 64px);
  padding: 20px;
  color: #edfff6;
  background:
    radial-gradient(90% 50% at 12% 0%, rgba(40, 140, 90, 0.22), transparent 46%),
    #04140f;
}

.main :deep(.el-card) {
  border: 1px solid rgba(140, 220, 175, 0.22);
  background: rgba(8, 36, 28, 0.72);
  color: #edfff6;
  box-shadow: none;
  backdrop-filter: blur(14px);
}

.main :deep(.el-card__header) {
  border-bottom-color: rgba(140, 220, 175, 0.18);
  color: #edfff6;
}

.main :deep(.el-input__wrapper),
.main :deep(.el-textarea__inner) {
  color: #f3fff8;
  background: rgba(3, 18, 14, 0.55);
  box-shadow: 0 0 0 1px rgba(138, 214, 176, 0.32) inset;
}

.main :deep(.el-input__inner),
.main :deep(.el-textarea__inner) {
  color: #f3fff8;
}

.main :deep(.el-input__inner::placeholder),
.main :deep(.el-textarea__inner::placeholder) {
  color: rgba(198, 224, 210, 0.55);
}

.main :deep(.el-table) {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: rgba(255, 255, 255, 0.04);
  --el-table-row-hover-bg-color: rgba(80, 200, 140, 0.12);
  --el-table-text-color: #edfff6;
  --el-table-header-text-color: rgba(214, 245, 228, 0.82);
  --el-fill-color-lighter: rgba(255, 255, 255, 0.04);
  --el-table-border-color: rgba(140, 220, 175, 0.16);
  background: transparent;
}

.main :deep(.el-empty__description p) {
  color: rgba(214, 245, 228, 0.72);
}
</style>
