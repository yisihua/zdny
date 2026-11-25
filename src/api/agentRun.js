function llmBase() {
  return (import.meta.env.VITE_LLM_API_BASE || '/v1').replace(/\/$/, '')
}

const DEBUG = true

function log(...args) {
  if (!DEBUG) return
  console.log('[agent-runs]', ...args)
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
      continue
    }
    // 兼容没有 data: 前缀的纯 JSON 行
    if (line.startsWith('{') || line === '[DONE]') {
      dataLines.push(line)
    }
  }

  const data = dataLines.join('\n')
  if (!data) return null
  return { event, data }
}

/** 提交执行时去掉前端选择用的 files 字段 */
export function toAgentRunAlgorithm(node) {
  if (!node || typeof node !== 'object') return null
  return {
    id: node.id,
    name: node.name,
    description: node.description || '',
    inputs: Array.isArray(node.inputs)
      ? node.inputs.map((input) => {
          const { files, ...rest } = input || {}
          return { ...rest }
        })
      : [],
    children: Array.isArray(node.children)
      ? node.children.map(toAgentRunAlgorithm).filter(Boolean)
      : [],
  }
}

/**
 * 触发算法执行：POST /v1/agent-runs（SSE）
 * onEvent({ type:'progress'|'error'|'done', eventId?, status?, algorithm?, error? })
 */
export async function streamAgentRun({ algorithm, signal, onEvent }) {
  const payload = toAgentRunAlgorithm(algorithm)
  if (!payload) throw new Error('缺少 algorithm')

  const url = `${llmBase()}/agent-runs`
  const body = JSON.stringify({ algorithm: payload })
  const token = localStorage.getItem('token')
  const headers = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  log('request', {
    url,
    method: 'POST',
    headers,
    bodyPreview: body.slice(0, 500),
    algorithmId: payload.id,
    childCount: payload.children?.length || 0,
  })

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
    signal,
  })

  const contentType = response.headers.get('content-type') || ''
  log('response meta', {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    contentType,
    hasBody: Boolean(response.body),
  })

  if (!response.ok) {
    let detail = ''
    try {
      detail = await response.text()
    } catch {
      detail = ''
    }
    log('response error body', detail.slice(0, 1000))
    let message = `启动执行失败（${response.status}）`
    try {
      const json = JSON.parse(detail)
      message = json?.error?.message || json?.message || json?.msg || message
    } catch {
      if (detail && !detail.startsWith('<')) message = detail.slice(0, 200)
    }
    throw new Error(message)
  }

  if (!response.body) {
    throw new Error('浏览器不支持流式响应')
  }

  // 若服务端误返回普通 JSON（非 SSE），直接读完并打印
  if (contentType.includes('application/json') && !contentType.includes('text/event-stream')) {
    const text = await response.text()
    log('non-SSE json body', text.slice(0, 2000))
    try {
      const json = JSON.parse(text)
      if (json?.error) {
        onEvent?.({
          type: 'error',
          error: json.error?.message || json.error?.code || '执行失败',
        })
        return
      }
      if (json?.algorithm || json?.event_id) {
        onEvent?.({
          type: 'progress',
          eventId: json.event_id || '',
          status: json.status || '',
          algorithm: json.algorithm || null,
        })
        onEvent?.({ type: 'done' })
        return
      }
    } catch {
      // fall through
    }
    throw new Error('执行接口返回了非流式 JSON，未包含 progress 数据')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let chunkIndex = 0
  let frameCount = 0

  const emitData = (eventName, raw) => {
    log('frame', { eventName, rawPreview: String(raw).slice(0, 800) })
    frameCount += 1

    if (raw === '[DONE]') {
      log('done frame received')
      onEvent?.({ type: 'done' })
      return true
    }

    let parsed = null
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      log('frame JSON parse failed', { eventName, error: String(error), rawPreview: String(raw).slice(0, 300) })
      return false
    }

    if (parsed?.error) {
      const message = parsed.error?.message || parsed.error?.code || '执行失败'
      log('frame error', parsed.error)
      onEvent?.({ type: 'error', error: message })
      return true
    }

    const type = parsed?.type || eventName
    if (type === 'progress' || parsed?.algorithm || parsed?.event_id) {
      log('progress', {
        type,
        eventId: parsed.event_id || '',
        status: parsed.status || '',
        rootStatus: parsed.algorithm?.status,
        rootProgress: parsed.algorithm?.progress,
      })
      onEvent?.({
        type: 'progress',
        eventId: parsed.event_id || '',
        status: parsed.status || '',
        algorithm: parsed.algorithm || null,
      })
      return false
    }

    log('ignored frame type', { type, keys: Object.keys(parsed || {}) })
    return false
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        log('stream reader done', { chunkIndex, frameCount, bufferLeft: buffer.length })
        break
      }

      const text = decoder.decode(value, { stream: true })
      chunkIndex += 1
      log('chunk', {
        index: chunkIndex,
        bytes: value?.byteLength || 0,
        textPreview: text.slice(0, 500),
        textLen: text.length,
      })
      buffer += text

      // 优先按 SSE 空行分帧；同时兼容仅用换行分隔的 JSON
      const chunks = buffer.split(/\r?\n\r?\n/)
      buffer = chunks.pop() || ''
      for (const chunk of chunks) {
        const frame = parseSseBlock(chunk)
        if (!frame) {
          log('empty/unparsed sse block', chunk.slice(0, 200))
          continue
        }
        if (emitData(frame.event, frame.data)) return
      }

      // 缓冲里可能是一行一个 JSON（无空行分隔）
      if (buffer.includes('\n')) {
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith(':')) continue
          if (trimmed.startsWith('data:') || trimmed.startsWith('event:') || trimmed.startsWith('{') || trimmed === '[DONE]') {
            const frame = parseSseBlock(trimmed.startsWith('{') || trimmed === '[DONE]' ? `data: ${trimmed}` : trimmed)
            if (frame && emitData(frame.event, frame.data)) return
          }
        }
      }
    }
  } catch (error) {
    log('stream read error', error)
    throw error
  }

  if (buffer.trim()) {
    log('flush remaining buffer', buffer.slice(0, 800))
    const frame = parseSseBlock(buffer)
    if (frame) emitData(frame.event, frame.data)
    else if (buffer.trim().startsWith('{')) emitData('progress', buffer.trim())
  }

  log('stream finished', { chunkIndex, frameCount })
  onEvent?.({ type: 'done' })
}
