function llmBase() {
  return (import.meta.env.VITE_LLM_API_BASE || '/v1').replace(/\/$/, '')
}

export function llmSessionId(appSessionId) {
  const fixed = String(import.meta.env.VITE_LLM_SESSION_ID || 'sess_demo').trim()
  if (import.meta.env.VITE_LLM_USE_APP_SESSION === 'true' && appSessionId) {
    return String(appSessionId)
  }
  return fixed || 'sess_demo'
}

function normalizeNode(node) {
  if (!node || typeof node !== 'object') return null
  const inputs = Array.isArray(node.inputs)
    ? node.inputs.map((input) => ({
        ...input,
        files: Array.isArray(input.files) ? input.files : [],
      }))
    : []
  return {
    ...node,
    status: node.status || 'pending',
    progress: Number.isFinite(Number(node.progress)) ? Number(node.progress) : 0,
    description: node.description || '',
    inputs,
    children: Array.isArray(node.children) ? node.children.map(normalizeNode).filter(Boolean) : [],
  }
}

export function normalizeAlgorithmGroup(group) {
  if (!group || typeof group !== 'object') return null
  const algorithm = normalizeNode(group.algorithm)
  if (!algorithm) return null
  return {
    id: group.id || `ag_${Date.now()}`,
    name: group.name || '算法组',
    description: group.description || '',
    algorithm,
  }
}

/** 写入会话消息 content，便于历史恢复 */
export function serializeAlgorithmGroupMessage(group) {
  const normalized = normalizeAlgorithmGroup(group)
  if (!normalized) return ''
  return JSON.stringify({
    type: 'algorithm_group',
    algorithm_group: normalized,
  })
}

/** 从会话消息 content 还原算法组；不是算法组消息时返回 null */
export function parseAlgorithmGroupMessage(content) {
  const raw = String(content || '').trim()
  if (!raw.startsWith('{')) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.type !== 'algorithm_group') return null
    return normalizeAlgorithmGroup(parsed.algorithm_group || parsed.group || parsed)
  } catch {
    return null
  }
}

/** 写入会话：工作流开始运行 */
export function serializeWorkflowRunMessage(group) {
  const name = group?.name || group?.algorithm?.name || '工作流'
  return JSON.stringify({
    type: 'workflow_run',
    name,
    text: `开始运行：${name}`,
    at: new Date().toISOString(),
  })
}

export function parseWorkflowRunMessage(content) {
  const raw = String(content || '').trim()
  if (!raw.startsWith('{')) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.type !== 'workflow_run') return null
    return parsed
  } catch {
    return null
  }
}

/** 写入会话：运行输出列表 */
export function serializeWorkflowOutputsMessage(files) {
  return JSON.stringify({
    type: 'workflow_outputs',
    files: Array.isArray(files) ? files : [],
  })
}

export function parseWorkflowOutputsMessage(content) {
  const raw = String(content || '').trim()
  if (!raw.startsWith('{')) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.type !== 'workflow_outputs') return null
    return Array.isArray(parsed.files) ? parsed.files : []
  } catch {
    return null
  }
}

function parseSseBlock(block) {
  const lines = String(block || '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line && !line.startsWith(':'))

  if (!lines.length) return null

  let event = 'message'
  const dataLines = []
  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
      continue
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  const data = dataLines.join('\n')
  if (!data) return null
  return { event, data }
}

/**
 * 流式对话：POST /v1/sessions/{id}/chat
 * onEvent({ type:'output'|'algorithm_group'|'error'|'done', delta?, group?, error? })
 */
export async function streamSessionChat({ sessionId, question, attachmentId, signal, onEvent }) {
  const url = `${llmBase()}/sessions/${encodeURIComponent(sessionId)}/chat`
  const body = { question: String(question || '').trim() }
  if (attachmentId) body.attachment_id = String(attachmentId)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    let detail = ''
    try {
      detail = await response.text()
    } catch {
      detail = ''
    }
    let message = `对话请求失败（${response.status}）`
    try {
      const json = JSON.parse(detail)
      message = json?.message || json?.msg || json?.error?.message || message
    } catch {
      if (detail && !detail.startsWith('<')) message = detail.slice(0, 200)
    }
    throw new Error(message)
  }

  if (!response.body) {
    throw new Error('浏览器不支持流式响应')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  const emitData = (eventName, raw) => {
    if (raw === '[DONE]') {
      onEvent?.({ type: 'done' })
      return true
    }

    let payload = null
    try {
      payload = JSON.parse(raw)
    } catch {
      return false
    }

    if (payload?.error) {
      onEvent?.({
        type: 'error',
        error: payload.error?.message || payload.error?.code || '对话失败',
      })
      return true
    }

    const type = payload?.type || eventName
    if (type === 'output') {
      onEvent?.({ type: 'output', delta: payload.delta || '' })
      return false
    }
    if (type === 'algorithm_group') {
      const group = normalizeAlgorithmGroup(payload.algorithm_group || payload)
      if (group) onEvent?.({ type: 'algorithm_group', group })
      return false
    }
    return false
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const chunks = buffer.split(/\r?\n\r?\n/)
    buffer = chunks.pop() || ''
    for (const chunk of chunks) {
      const frame = parseSseBlock(chunk)
      if (!frame) continue
      if (emitData(frame.event, frame.data)) return
    }
  }

  if (buffer.trim()) {
    const frame = parseSseBlock(buffer)
    if (frame) emitData(frame.event, frame.data)
  }

  onEvent?.({ type: 'done' })
}
