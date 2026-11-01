import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
})

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
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

    const success = payload.code === 0 || payload.code === 200
    if (!success) {
      ElMessage.error(payload.message || '请求失败')
      return Promise.reject(payload)
    }
    return payload.data
  },
  (error) => {
    const status = error.response?.status
    const message =
      error.response?.data?.message ||
      (status ? `请求失败（${status}）` : '网络异常，请稍后重试')
    ElMessage.error(message)
    return Promise.reject(error)
  },
)

export default request
