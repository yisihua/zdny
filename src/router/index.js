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
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/Home.vue'),
          meta: { title: '首页' },
        },
        {
          path: 'posts',
          name: 'posts',
          component: () => import('@/views/PostList.vue'),
          meta: { title: '数据列表示例' },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
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
    document.title = '登录 - 智农育种云平台'
    return
  }
  const title = to.meta.title
  document.title = title ? `${title} - 浙大农业` : '浙大农业'
})

export default router
