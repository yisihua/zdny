/** 去掉旧 hash 路由残留，并禁止回跳到登录页本身。 */
export function sanitizeRedirect(fullPath) {
  if (typeof fullPath !== 'string' || !fullPath) return ''
  const noHash = fullPath.split('#')[0]
  if (!noHash.startsWith('/') || noHash.startsWith('//')) return ''
  const path = noHash.split('?')[0]
  if (path === '/login' || path.startsWith('/login/')) return ''
  if (noHash === '/') return ''
  return noHash
}
