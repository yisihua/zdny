import { ref } from 'vue'
import zh from './zh.js'
import en from './en.js'

const saved = localStorage.getItem('locale')
export const locale = ref(saved === 'en' ? 'en' : 'zh')
const messages = { zh, en }

document.documentElement.lang = locale.value === 'en' ? 'en' : 'zh-CN'

export function t(key, params = {}) {
  const pack = messages[locale.value] || zh
  const text = pack[key] ?? zh[key] ?? key
  return String(text).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '')
}

export function formatMessage(message) {
  if (!message?.textKey) return message?.content || ''
  const params = { ...(message.params || {}) }
  Object.entries(params).forEach(([key, value]) => {
    if (key.endsWith('Key') && typeof value === 'string') params[key.slice(0, -3)] = t(value)
  })
  return t(message.textKey, params)
}

export function setLocale(next) {
  locale.value = next === 'en' ? 'en' : 'zh'
  localStorage.setItem('locale', locale.value)
  document.documentElement.lang = locale.value === 'en' ? 'en' : 'zh-CN'
}
