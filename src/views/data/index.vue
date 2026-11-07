<script setup>
import { computed, ref } from 'vue'

const keyword = ref('')
const materials = [
  { code: 'R-2401', name: '浙农稻 18', type: '水稻', trait: '耐旱、中熟', updatedAt: '2026-03-12' },
  { code: 'R-2408', name: '钱塘籼 6', type: '水稻', trait: '高产、抗稻瘟', updatedAt: '2026-04-02' },
  { code: 'W-1103', name: '麦香 9 号', type: '小麦', trait: '抗倒伏', updatedAt: '2026-02-18' },
  { code: 'M-0816', name: '甜玉 3 号', type: '玉米', trait: '宜机收', updatedAt: '2026-01-26' },
]

const filtered = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return materials
  return materials.filter((item) =>
    [item.code, item.name, item.type, item.trait].some((field) => field.toLowerCase().includes(text)),
  )
})
</script>

<template>
  <div class="page">
    <header class="heading">
      <h1>数据管理</h1>
      <p>管理育种材料的基础信息。下表为示例数据。</p>
    </header>

    <el-card shadow="never">
      <div class="toolbar">
        <el-input v-model="keyword" clearable placeholder="搜索编号、名称、作物或性状" class="search" />
      </div>
      <el-table :data="filtered" stripe>
        <el-table-column prop="code" label="材料编号" width="120" />
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="type" label="作物" width="100" />
        <el-table-column prop="trait" label="目标性状" min-width="180" />
        <el-table-column prop="updatedAt" label="更新日期" width="140" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.heading h1 {
  margin: 0;
  font-size: 22px;
}

.heading p {
  margin: 8px 0 0;
  color: rgba(214, 245, 228, 0.72);
}

.toolbar {
  margin-bottom: 16px;
}

.search {
  width: min(360px, 100%);
}
</style>
