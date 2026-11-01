<script setup>
import { useRouter } from 'vue-router'
import { Bell, MapLocation, Orange } from '@element-plus/icons-vue'

const router = useRouter()

const stats = [
  {
    title: '示范基地',
    value: '12',
    unit: '个',
    hint: '示例数据',
    icon: MapLocation,
    tone: 'green',
  },
  {
    title: '在田作物',
    value: '36',
    unit: '种',
    hint: '示例数据',
    icon: Orange,
    tone: 'orange',
  },
  {
    title: '待办事项',
    value: '5',
    unit: '项',
    hint: '示例数据',
    icon: Bell,
    tone: 'blue',
  },
]

const stack = [
  { name: 'Vue 3', desc: '页面与组件' },
  { name: 'Element Plus', desc: '表格、表单、布局' },
  { name: 'Axios', desc: '接口请求与拦截器' },
  { name: 'Vue Router', desc: '页面路由' },
]
</script>

<template>
  <div class="page">
    <section class="hero">
      <div>
        <p class="eyebrow">Vue 3 + Element Plus + Axios</p>
        <h1>浙大农业管理平台</h1>
        <p class="lead">
          这是一个可直接开工的前端脚手架。首页展示布局，列表页通过 Axios 读取数据。
        </p>
        <el-button type="primary" @click="router.push('/posts')">查看数据列表示例</el-button>
      </div>
    </section>

    <el-row :gutter="16">
      <el-col v-for="item in stats" :key="item.title" :xs="24" :sm="8">
        <el-card shadow="hover" class="stat-card">
          <div class="stat">
            <span class="stat-icon" :class="item.tone">
              <el-icon :size="22"><component :is="item.icon" /></el-icon>
            </span>
            <div>
              <div class="stat-title">{{ item.title }}</div>
              <div class="stat-value">
                {{ item.value }}<small>{{ item.unit }}</small>
              </div>
              <div class="stat-hint">{{ item.hint }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="stack-card" shadow="never">
      <template #header>项目组成</template>
      <div class="stack">
        <div v-for="item in stack" :key="item.name" class="stack-item">
          <strong>{{ item.name }}</strong>
          <span>{{ item.desc }}</span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero {
  padding: 28px 32px;
  border-radius: 16px;
  color: #fff;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.18), transparent 36%),
    linear-gradient(135deg, #145c3a, #1f7a4d 55%, #3d9b68);
}

.eyebrow {
  margin: 0 0 8px;
  font-size: 13px;
  letter-spacing: 0.04em;
  opacity: 0.85;
}

h1 {
  margin: 0;
  font-size: 30px;
  font-weight: 700;
}

.lead {
  max-width: 640px;
  margin: 12px 0 20px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.9);
}

.stat {
  display: flex;
  gap: 14px;
  align-items: center;
}

.stat-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 12px;
}

.stat-icon.green {
  color: #1f7a4d;
  background: #e7f6ee;
}

.stat-icon.orange {
  color: #c56a12;
  background: #fff3e6;
}

.stat-icon.blue {
  color: #1d6fbf;
  background: #e8f3ff;
}

.stat-title {
  color: #66756d;
  font-size: 13px;
}

.stat-value {
  margin-top: 4px;
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
}

.stat-value small {
  margin-left: 4px;
  font-size: 13px;
  font-weight: 500;
  color: #66756d;
}

.stat-hint {
  margin-top: 6px;
  color: #8a9891;
  font-size: 12px;
}

.stack {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.stack-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 12px;
  background: #f6faf7;
}

.stack-item span {
  color: #66756d;
  font-size: 13px;
}

@media (max-width: 900px) {
  .stack {
    grid-template-columns: 1fr 1fr;
  }

  h1 {
    font-size: 24px;
  }
}
</style>
