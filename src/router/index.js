import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/components/login/index.vue'),
      meta: { title: '登录', public: true },
    },
    {
      path: '/',
      component: MainLayout,
      redirect: '/agent',
      children: [
        {
          path: 'agent',
          name: 'agent',
          component: () => import('@/views/agent/index.vue'),
          meta: { title: '智能体模块' },
        },
        {
          path: 'data',
          name: 'data',
          component: () => import('@/views/data/index.vue'),
          meta: { title: '数据管理' },
        },
        {
          path: 'system',
          name: 'system',
          component: () => import('@/views/system/index.vue'),
          meta: { title: '系统管理' },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/agent',
    },
  ],
})

router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  if (to.meta.public) {
    if (token && to.name === 'login') return { path: '/' }
    return true
  }
  if (!token) {
    return {
      name: 'login',
      query: to.fullPath === '/' ? {} : { redirect: to.fullPath },
    }
  }
  return true
})

router.afterEach((to) => {
  if (to.name === 'login') {
    document.title = '登录 - 育种材料筛选智能体平台'
    return
  }
  const title = to.meta.title
  document.title = title ? `${title} - 育种材料筛选智能体平台` : '育种材料筛选智能体平台'
})

export default router
