<script setup>
import { Delete, Download, FolderOpened, Upload } from '@element-plus/icons-vue'
import { t } from '@/i18n'

defineProps({
  rows: { type: Array, required: true },
  loading: { type: Boolean, default: false },
})

defineEmits(['open', 'upload', 'download', 'remove'])

function meta(row) {
  return t('data.datasetMeta', {
    project: row.projectName || row.projectId || '-',
    year: row.collectionYear ?? '-',
    location: row.location || '-',
    date: row.collectionDate || '-',
    batch: row.batch || '-',
    sensor: row.sensor || '-',
    type: row.dataTypeLabel || row.dataType || '-',
  })
}
</script>

<template>
  <div class="scroll">
    <p v-if="loading" class="empty">{{ t('system.loading') }}</p>
    <p v-else-if="!rows.length" class="empty">{{ t('data.empty') }}</p>
    <ul v-else class="list">
      <li v-for="row in rows" :key="row.id">
        <div class="main">
          <strong>{{ row.name }}</strong>
          <p>{{ meta(row) }}</p>
          <p class="sub">
            {{ t('data.owner') }}：{{ row.ownerLabel || row.ownerId || '-' }}
            <template v-if="row.sharedLabel"> · {{ row.sharedLabel }}</template>
          </p>
        </div>
        <div class="ops">
          <button v-if="row.canUpload" type="button" class="upload" @click="$emit('upload', row)">
            <el-icon><Upload /></el-icon>{{ t('data.appendUpload') }}
          </button>
          <button type="button" @click="$emit('open', row)">
            <el-icon><FolderOpened /></el-icon>{{ t('data.openFiles') }}
          </button>
          <button v-if="row.canDownload" type="button" @click="$emit('download', row)">
            <el-icon><Download /></el-icon>{{ t('data.download') }}
          </button>
          <button v-if="row.canDelete" type="button" @click="$emit('remove', row)">
            <el-icon><Delete /></el-icon>{{ t('data.remove') }}
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: #3dca78 rgba(8, 36, 28, 0.72);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0 8px 0 0;
  list-style: none;
}

li {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid rgba(140, 220, 175, 0.18);
  border-radius: 12px;
  background: rgba(3, 18, 14, 0.45);
}

.main {
  min-width: 0;
  flex: 1;
}

strong {
  display: block;
  font-size: 15px;
}

p,
.empty {
  margin: 6px 0 0;
  color: rgba(214, 245, 228, 0.62);
  font-size: 13px;
}

.sub {
  color: rgba(214, 245, 228, 0.5);
}

.ops {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid rgba(140, 220, 175, 0.32);
  border-radius: 8px;
  color: #e7fff4;
  background: transparent;
  font: inherit;
  cursor: pointer;
}

button.upload {
  border-color: transparent;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
}

@media (max-width: 800px) {
  li {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .ops {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
