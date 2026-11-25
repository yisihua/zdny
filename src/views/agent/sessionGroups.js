import { sortSessionsByPinOrder } from './sessionPins.js'

const STORAGE_KEY = 'agent.sessionGroups'
export const UNGROUPED_ID = ''

function storageKey() {
  const userId = localStorage.getItem('userId') || localStorage.getItem('username') || 'anonymous'
  return `${STORAGE_KEY}:${userId}`
}

function emptyStore() {
  return {
    groups: [],
    membership: {},
    ungroupedCollapsed: false,
  }
}

export function readSessionGroupStore() {
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw)
    const groups = Array.isArray(parsed?.groups)
      ? parsed.groups
          .map((item) => ({
            id: String(item?.id || ''),
            name: String(item?.name || '').trim(),
            collapsed: Boolean(item?.collapsed),
          }))
          .filter((item) => item.id && item.name)
      : []
    const membership = {}
    if (parsed?.membership && typeof parsed.membership === 'object') {
      Object.entries(parsed.membership).forEach(([sessionId, groupId]) => {
        const sid = String(sessionId || '')
        const gid = String(groupId || '')
        if (!sid || !gid) return
        if (!groups.some((group) => group.id === gid)) return
        membership[sid] = gid
      })
    }
    return {
      groups,
      membership,
      ungroupedCollapsed: Boolean(parsed?.ungroupedCollapsed),
    }
  } catch {
    return emptyStore()
  }
}

export function writeSessionGroupStore(store) {
  const next = {
    groups: Array.isArray(store?.groups) ? store.groups : [],
    membership: store?.membership && typeof store.membership === 'object' ? store.membership : {},
    ungroupedCollapsed: Boolean(store?.ungroupedCollapsed),
  }
  localStorage.setItem(storageKey(), JSON.stringify(next))
  return next
}

export function createSessionGroup(name, store = readSessionGroupStore()) {
  const title = String(name || '').trim()
  if (!title) return store
  const group = {
    id: `sg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: title.slice(0, 64),
    collapsed: false,
  }
  return writeSessionGroupStore({
    ...store,
    groups: [...store.groups, group],
  })
}

export function renameSessionGroup(groupId, name, store = readSessionGroupStore()) {
  const title = String(name || '').trim().slice(0, 64)
  if (!title) return store
  return writeSessionGroupStore({
    ...store,
    groups: store.groups.map((item) => (item.id === String(groupId) ? { ...item, name: title } : item)),
  })
}

export function deleteSessionGroup(groupId, store = readSessionGroupStore()) {
  const id = String(groupId)
  const membership = { ...store.membership }
  Object.keys(membership).forEach((sessionId) => {
    if (membership[sessionId] === id) delete membership[sessionId]
  })
  return writeSessionGroupStore({
    ...store,
    groups: store.groups.filter((item) => item.id !== id),
    membership,
  })
}

export function toggleSessionGroup(groupId, store = readSessionGroupStore()) {
  const id = String(groupId)
  if (id === UNGROUPED_ID) {
    return writeSessionGroupStore({
      ...store,
      ungroupedCollapsed: !store.ungroupedCollapsed,
    })
  }
  return writeSessionGroupStore({
    ...store,
    groups: store.groups.map((item) =>
      item.id === id ? { ...item, collapsed: !item.collapsed } : item,
    ),
  })
}

export function moveSessionToGroup(sessionId, groupId, store = readSessionGroupStore()) {
  const sid = String(sessionId)
  const gid = groupId ? String(groupId) : UNGROUPED_ID
  const membership = { ...store.membership }
  if (!gid || !store.groups.some((item) => item.id === gid)) {
    delete membership[sid]
  } else {
    membership[sid] = gid
  }
  return writeSessionGroupStore({ ...store, membership })
}

export function removeSessionFromGroups(sessionId, store = readSessionGroupStore()) {
  const sid = String(sessionId)
  if (!(sid in store.membership)) return store
  const membership = { ...store.membership }
  delete membership[sid]
  return writeSessionGroupStore({ ...store, membership })
}

export function pruneSessionGroupStore(aliveIds, store = readSessionGroupStore()) {
  const alive = new Set((aliveIds || []).map(String))
  const membership = {}
  Object.entries(store.membership || {}).forEach(([sessionId, groupId]) => {
    if (!alive.has(String(sessionId))) return
    if (!store.groups.some((item) => item.id === String(groupId))) return
    membership[String(sessionId)] = String(groupId)
  })
  return writeSessionGroupStore({ ...store, membership })
}

export function buildSessionSections(sessions, store = readSessionGroupStore(), pinnedIds = []) {
  const list = Array.isArray(sessions) ? sessions : []
  const byId = new Map(list.map((item) => [String(item.id), item]))
  const used = new Set()

  const sections = store.groups.map((group) => {
    const items = []
    Object.entries(store.membership).forEach(([sessionId, groupId]) => {
      if (String(groupId) !== group.id) return
      const session = byId.get(String(sessionId))
      if (!session) return
      items.push(session)
      used.add(String(sessionId))
    })
    return {
      id: group.id,
      name: group.name,
      collapsed: Boolean(group.collapsed),
      sessions: sortSessionsByPinOrder(items, pinnedIds),
    }
  })

  const ungrouped = list.filter((item) => !used.has(String(item.id)))
  sections.push({
    id: UNGROUPED_ID,
    nameKey: 'agent.ungrouped',
    collapsed: Boolean(store.ungroupedCollapsed),
    sessions: sortSessionsByPinOrder(ungrouped, pinnedIds),
  })

  return sections
}
