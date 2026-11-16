import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'
import { sanitizeRedirect } from '@/router/redirect'

const publicAuthPaths = [
  '/auth/captcha',
  '/auth/register',
  '/auth/login',
  '/auth/password/forgot',
  '/auth/password/reset',
]

const AUTH_KEYS = ['token', 'username', 'userId', 'expiresAt', 'user']

let authRedirecting = false

function errorText(body, status) {
  if (typeof body === 'string') {
    const text = body.trim()
    if (text && !text.startsWith('<')) return text
  }

  const record = body && typeof body === 'object' ? body : null
  const msg = record?.msg || record?.message || ''
  const fields = record?.data
  const extra =
    fields && typeof fields === 'object' && !Array.isArray(fields)
      ? Object.values(fields).filter((item) => typeof item === 'string' && item).join('；')
      : ''

  if (msg && extra && extra !== msg) return `${msg}：${extra}`
  if (msg) return msg
  if (extra) return extra
  if (status) return `请求失败（${status}）`
  return '网络异常，请稍后重试'
}

function clearAuth() {
  for (const key of AUTH_KEYS) localStorage.removeItem(key)
}

function redirectToLogin(message) {
  if (authRedirecting) return
  authRedirecting = true
  clearAuth()
  if (message) ElMessage.error(message)

  const current = router.currentRoute.value
  const onLogin = current.name === 'login'
  const redirect = sanitizeRedirect(current.fullPath)

  Promise.resolve(
    onLogin
      ? undefined
      : router.replace({
          name: 'login',
          query: redirect ? { redirect } : {},
        }),
  ).finally(() => {
    window.setTimeout(() => {
      authRedirecting = false
    }, 800)
  })
}

function isUnauthorized(payload, httpStatus) {
  if (httpStatus === 401) return true
  if (!payload || typeof payload !== 'object') return false
  if (payload.code === 401) return true
  const msg = String(payload.msg || payload.message || '')
  return /token\s*无效|未登录|登录已过期|unauthorized/i.test(msg)
}

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
})

request.interceptors.request.use((config) => {
  const url = config.url || ''
  const isPublicAuth = publicAuthPaths.some((path) => url === path || url.startsWith(`${path}?`))
  if (!isPublicAuth) {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  (response) => {
    const payload = response.data
    const wrapped =
      payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload) &&
      'code' in payload

    if (!wrapped) return payload

    if (isUnauthorized(payload, response.status)) {
      redirectToLogin(errorText(payload, response.status))
      return Promise.reject(payload)
    }

    const success = payload.code === 0 || payload.code === 200
    if (!success) {
      ElMessage.error(errorText(payload))
      return Promise.reject(payload)
    }
    return payload.data
  },
  (error) => {
    const status = error.response?.status
    const body = error.response?.data
    if (isUnauthorized(body, status)) {
      redirectToLogin(errorText(body, status))
      return Promise.reject(error)
    }
    ElMessage.error(errorText(body, status))
    return Promise.reject(error)
  },
)

export default request
