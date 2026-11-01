<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { getPosts } from '@/api/post'

const loading = ref(false)
const posts = ref([])
const keyword = ref('')
const page = ref(1)
const pageSize = ref(10)
const current = ref(null)
const dialogVisible = ref(false)

const filtered = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return posts.value
  return posts.value.filter((item) =>
    [item.title, item.category, item.id].some((field) =>
      String(field).toLowerCase().includes(text),
    ),
  )
})

const pageData = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

watch(keyword, () => {
  page.value = 1
})

async function loadPosts() {
  loading.value = true
  try {
    const data = await getPosts()
    posts.value = Array.isArray(data) ? data : []
  } catch {
    posts.value = []
  } finally {
    loading.value = false
  }
}

function openDetail(row) {
  current.value = row
  dialogVisible.value = true
}

function excerpt(text) {
  if (!text) return ''
  return text.length > 72 ? `${text.slice(0, 72)}...` : text
}

onMounted(loadPosts)
</script>

<template>
  <el-card shadow="never">
    <div class="toolbar">
      <el-input
        v-model="keyword"
        clearable
        placeholder="搜索标题、类别或编号"
        class="search"
      />
      <el-button type="primary" :loading="loading" @click="loadPosts">刷新</el-button>
    </div>

    <el-table v-loading="loading" :data="pageData" stripe>
      <el-table-column prop="id" label="编号" width="80" />
      <el-table-column prop="category" label="类别" width="100" />
      <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
      <el-table-column label="摘要" min-width="260" show-overflow-tooltip>
        <template #default="{ row }">{{ excerpt(row.body) }}</template>
      </el-table-column>
      <el-table-column prop="updatedAt" label="更新日期" width="120" />
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">查看</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="filtered.length"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        background
      />
    </div>
  </el-card>

  <el-dialog v-model="dialogVisible" title="内容详情" width="640px">
    <template v-if="current">
      <p class="detail-id">{{ current.category }} · 编号 {{ current.id }} · {{ current.updatedAt }}</p>
      <h3>{{ current.title }}</h3>
      <p class="detail-body">{{ current.body }}</p>
    </template>
  </el-dialog>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.search {
  width: 280px;
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.detail-id {
  margin: 0 0 8px;
  color: #8a9891;
  font-size: 13px;
}

h3 {
  margin: 0 0 12px;
  font-size: 18px;
}

.detail-body {
  margin: 0;
  line-height: 1.7;
  white-space: pre-wrap;
}
</style>
