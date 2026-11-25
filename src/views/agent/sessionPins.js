const STORAGE_KEY = 'agent.sessionPinOrder'

function storageKey() {
  const userId = localStorage.getItem('userId') || localStorage.getItem('username') || 'anonymous'
  return `${STORAGE_KEY}:${userId}`
}

export function readPinnedSessionIds() {
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) return []
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    return list.map((id) => String(id)).filter(Boolean)
  } catch {
    return []
  }
}

export function writePinnedSessionIds(ids) {
  const list = Array.isArray(ids) ? ids.map((id) => String(id)).filter(Boolean) : []
  localStorage.setItem(storageKey(), JSON.stringify(list))
  return list
}

export function isSessionPinned(id, pinnedIds = readPinnedSessionIds()) {
  return pinnedIds.includes(String(id))
}

export function pinSessionId(id) {
  const key = String(id)
  const next = [key, ...readPinnedSessionIds().filter((item) => item !== key)]
  return writePinnedSessionIds(next)
}

export function unpinSessionId(id) {
  const key = String(id)
  return writePinnedSessionIds(readPinnedSessionIds().filter((item) => item !== key))
}

export function removePinnedSessionId(id) {
  return unpinSessionId(id)
}

/** 按缓存置顶顺序排序；未置顶项保持原有相对顺序 */
export function sortSessionsByPinOrder(sessions, pinnedIds = readPinnedSessionIds()) {
  const list = Array.isArray(sessions) ? [...sessions] : []
  if (!list.length) return list

  const rank = new Map(pinnedIds.map((id, index) => [String(id), index]))
  return list.sort((a, b) => {
    const aRank = rank.has(String(a.id)) ? rank.get(String(a.id)) : Number.POSITIVE_INFINITY
    const bRank = rank.has(String(b.id)) ? rank.get(String(b.id)) : Number.POSITIVE_INFINITY
    if (aRank !== bRank) return aRank - bRank
    return 0
  })
}
