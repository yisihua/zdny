import { createRouter, createWebHashHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'

const router = createRouter({
  history: createWebHashHistory(),
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
  if (to.meta.public || to.name === 'login') return true
  if (localStorage.getItem('token')) return true
  return { name: 'login' }
})

export default router
