<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { House, List } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const activeMenu = computed(() => route.path)
const username = computed(() => localStorage.getItem('username') || '管理员')

function logout() {
  localStorage.removeItem('token')
  router.push('/login')
}
</script>

<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="brand">
        <span class="brand-mark">农</span>
        <div>
          <div class="brand-title">浙大农业</div>
          <div class="brand-sub">管理平台</div>
        </div>
      </div>
      <el-menu
        router
        :default-active="activeMenu"
        class="menu"
        background-color="transparent"
        text-color="#d5ebe1"
        active-text-color="#ffffff"
      >
        <el-menu-item index="/">
          <el-icon><House /></el-icon>
          <span>首页</span>
        </el-menu-item>
        <el-menu-item index="/posts">
          <el-icon><List /></el-icon>
          <span>数据列表示例</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container class="content">
      <el-header class="header">
        <span class="header-title">{{ route.meta.title || '浙大农业' }}</span>
        <span class="header-user">
          <span>{{ username }}</span>
          <button type="button" class="logout" @click="logout">退出</button>
        </span>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout {
  height: 100%;
}

.aside {
  display: flex;
  flex-direction: column;
  background: var(--agri-sidebar);
  color: #fff;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 64px;
  padding: 0 18px;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #1f7a4d;
  font-weight: 700;
}

.brand-title {
  font-size: 16px;
  font-weight: 650;
  line-height: 1.2;
}

.brand-sub {
  margin-top: 2px;
  color: #b7d4c8;
  font-size: 12px;
}

.menu {
  border-right: none;
  flex: 1;
}

.menu :deep(.el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.08);
}

.menu :deep(.el-menu-item.is-active) {
  background: #1f7a4d;
}

.content {
  min-width: 0;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  background: #fff;
  border-bottom: 1px solid #e6eee9;
}

.header-title {
  font-size: 16px;
  font-weight: 650;
}

.header-user {
  display: flex;
  gap: 12px;
  align-items: center;
  color: #5d6b64;
  font-size: 14px;
}

.logout {
  border: none;
  color: #1f7a4d;
  background: transparent;
  cursor: pointer;
  font: inherit;
}

.main {
  background: var(--agri-bg);
}
</style>
