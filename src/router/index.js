import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/components/login/index.vue'),
      meta: { titleKey: 'login.page', public: true },
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
          meta: { titleKey: 'nav.agent' },
        },
        {
          path: 'data',
          name: 'data',
          component: () => import('@/views/data/index.vue'),
          meta: { titleKey: 'nav.data' },
        },
        {
          path: 'system',
          name: 'system',
          component: () => import('@/views/system/index.vue'),
          meta: { titleKey: 'nav.system' },
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

export default router
