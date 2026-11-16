import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import { sanitizeRedirect } from './redirect'

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
  // 兼容旧 hash 模式书签：/#/login、/agent#/login → 干净 history 路径
  if (to.hash.startsWith('#/')) {
    const raw = to.hash.slice(1)
    const qIndex = raw.indexOf('?')
    const hashPath = qIndex >= 0 ? raw.slice(0, qIndex) : raw
    const hashSearch = qIndex >= 0 ? raw.slice(qIndex + 1) : ''
    const hashQuery = hashSearch ? Object.fromEntries(new URLSearchParams(hashSearch)) : {}
    return {
      path: hashPath || '/',
      query: { ...to.query, ...hashQuery },
      hash: '',
      replace: true,
    }
  }

  const token = localStorage.getItem('token')

  if (to.name === 'login') {
    const raw = to.query.redirect
    if (typeof raw === 'string') {
      const cleaned = sanitizeRedirect(raw)
      if (cleaned !== raw) {
        const query = { ...to.query }
        if (cleaned) query.redirect = cleaned
        else delete query.redirect
        return { name: 'login', query, hash: '', replace: true }
      }
    }
    if (token) return { path: '/agent' }
    return true
  }

  if (to.meta.public) return true

  if (!token) {
    const redirect = sanitizeRedirect(to.fullPath)
    return {
      name: 'login',
      query: redirect ? { redirect } : {},
    }
  }
  return true
})

export default router
