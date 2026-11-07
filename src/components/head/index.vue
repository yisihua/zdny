<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const username = computed(() => localStorage.getItem('username') || '管理员')
const initial = computed(() => username.value.trim().charAt(0) || '用')

const menus = [
  { to: '/agent', label: '智能体模块' },
  { to: '/data', label: '数据管理' },
  { to: '/system', label: '系统管理' },
]

function logout() {
  localStorage.removeItem('token')
  router.push('/login')
}
</script>

<template>
  <header class="app-head">
    <router-link class="brand" to="/agent">
      <img class="logo" src="/head/logo.png" alt="" />
      <span class="divider" aria-hidden="true"></span>
      <span class="title">
        <span class="title-shine" aria-hidden="true">育种材料筛选智能体平台</span>
        育种材料筛选智能体平台
      </span>
    </router-link>

    <nav class="nav" aria-label="页面导航">
      <router-link
        v-for="item in menus"
        :key="item.to"
        :to="item.to"
        exact-active-class="is-active"
      >
        {{ item.label }}
      </router-link>
    </nav>

    <div class="user">
      <span class="avatar" aria-hidden="true">{{ initial }}</span>
      <span class="name">{{ username }}</span>
      <button type="button" class="logout" @click="logout">注销</button>
    </div>
  </header>
</template>

<style scoped>
.app-head {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  flex: 0 0 64px;
  gap: 18px;
  align-items: center;
  height: 64px;
  padding: 0 22px 0 16px;
  color: #edfff6;
  background: linear-gradient(180deg, rgba(3, 18, 14, 0.78) 0%, rgba(28, 96, 68, 0.38) 100%);
  border-bottom: 1px solid rgba(198, 255, 226, 0.22);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 10px 28px rgba(4, 20, 15, 0.16);
  backdrop-filter: blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
}

.brand {
  display: flex;
  flex: 0 1 auto;
  gap: 12px;
  align-items: center;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.logo {
  width: 42px;
  height: 42px;
  object-fit: contain;
  filter: drop-shadow(0 0 8px rgba(60, 220, 140, 0.5));
}

.divider {
  width: 1px;
  height: 22px;
  background: linear-gradient(180deg, transparent, rgba(190, 255, 220, 0.75), transparent);
}

.title {
  position: relative;
  z-index: 1;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.06em;
  white-space: nowrap;
  color: #b9bfbd;
  text-shadow:
    0 0 2px rgba(210, 255, 235, 0.22),
    0 0 5px rgba(80, 235, 175, 0.18);
}

.title-shine {
  position: absolute;
  inset: 0;
  color: transparent;
  background-image: linear-gradient(
    100deg,
    transparent 0%,
    transparent 36%,
    rgba(255, 255, 255, 0.15) 44%,
    #ffffff 50%,
    rgba(190, 255, 225, 0.95) 56%,
    transparent 66%,
    transparent 100%
  );
  background-size: 220% 100%;
  background-repeat: no-repeat;
  background-position: 120% 0;
  -webkit-background-clip: text;
  background-clip: text;
  pointer-events: none;
  animation: title-sweep 3.2s ease-in-out infinite;
}

.nav {
  display: flex;
  flex: 1;
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.nav a {
  padding: 6px 12px;
  border-radius: 8px;
  color: rgba(214, 245, 228, 0.78);
  font-size: 14px;
  text-decoration: none;
  white-space: nowrap;
}

.nav a:hover,
.nav a.is-active {
  color: #fff;
  background: rgba(61, 206, 124, 0.28);
}

.user {
  display: flex;
  flex: 0 0 auto;
  gap: 10px;
  align-items: center;
}

.avatar {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  color: #042117;
  background: linear-gradient(180deg, #8cf0ae, #2fbf6a);
  box-shadow: 0 0 0 2px rgba(90, 220, 150, 0.35);
  font-size: 14px;
  font-weight: 700;
  text-transform: lowercase;
}

.name {
  color: rgba(232, 255, 242, 0.92);
  font-size: 14px;
}

.logout {
  height: 32px;
  padding: 0 16px;
  border: 1px solid rgba(150, 230, 185, 0.55);
  border-radius: 16px;
  color: #edfff6;
  background: linear-gradient(180deg, rgba(50, 180, 120, 0.55), rgba(16, 90, 60, 0.55));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.logout:hover {
  filter: brightness(1.08);
}

@keyframes title-sweep {
  0% {
    background-position: 130% 0;
  }

  70%,
  100% {
    background-position: -30% 0;
  }
}

@media (max-width: 860px) {
  .app-head {
    gap: 10px;
    padding-right: 12px;
  }

  .title {
    max-width: 42vw;
    font-size: 18px;
  }

  .name {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .title-shine {
    animation: none;
  }
}
</style>
