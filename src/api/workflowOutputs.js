import { importDatasetByFilePaths } from './dataset'

/** 工作流运行产物默认入库的数据集 ID */
export const WORKFLOW_RESULT_DATASET_ID = '2121948883387981826'

function llmOrigin() {
  return String(import.meta.env.VITE_LLM_API_TARGET || '').replace(/\/$/, '')
}

function fileNameFromUrl(url, fallback = '') {
  try {
    const path = String(url).split('?')[0]
    const base = decodeURIComponent(path.split('/').pop() || '')
    return base || fallback
  } catch {
    return fallback
  }
}

function extFromName(name) {
  const match = String(name || '').match(/\.([a-z0-9]+)$/i)
  return match ? match[1].toLowerCase() : ''
}

/** 产物导入源站：filePaths = 该地址 + outs.url 真实路径 */
export function artifactImportOrigin() {
  return String(import.meta.env.VITE_ARTIFACT_IMPORT_ORIGIN || 'http://10.202.210.30:32862').replace(
    /\/$/,
    '',
  )
}

/**
 * 将 outs.url 规范为可提交的完整地址（给后端 filePaths 用）。
 * 例：/v1/artifacts/a.geojson → http://10.202.210.30:32862/v1/artifacts/a.geojson
 */
export function resolveArtifactUrl(url) {
  return toImportFilePath(url)
}

/**
 * 导入用完整地址：http://10.202.210.30:32862 + 真实路径
 */
export function toImportFilePath(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  const origin = artifactImportOrigin()

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw)
      return `${origin}${parsed.pathname || ''}${parsed.search || ''}`
    } catch {
      return raw
    }
  }

  let path = raw.startsWith('/') ? raw : `/${raw}`
  if (path.startsWith('/artifacts/')) path = `/v1${path}`
  else if (!path.startsWith('/v1/') && !path.startsWith('/data/') && !path.startsWith('/api/')) {
    path = path.startsWith('/v1/') ? path : `/v1${path}`
  }
  return `${origin}${path}`
}

/**
 * 浏览器预览/下载地址。
 * VITE_LLM_API_BASE 为绝对地址时直连；否则走同源 `/v1` 代理。
 */
export function toProxiedArtifactUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''

  const llmBase = String(import.meta.env.VITE_LLM_API_BASE || '/v1').replace(/\/$/, '')
  const origin = llmOrigin() || (/^https?:\/\//i.test(llmBase) ? new URL(llmBase).origin : '')
  const direct = /^https?:\/\//i.test(llmBase)

  const toPath = () => {
    if (raw.startsWith('/v1/') || raw.startsWith('/api/')) return raw
    try {
      if (/^https?:\/\//i.test(raw)) {
        const parsed = new URL(raw)
        if (parsed.pathname.startsWith('/v1/') || parsed.pathname.startsWith('/api/')) {
          return `${parsed.pathname}${parsed.search || ''}`
        }
        if (origin && raw.startsWith(origin)) {
          const path = raw.slice(origin.length) || '/'
          return path.startsWith('/') ? path : `/v1/${path}`
        }
      }
    } catch {
      // fall through
    }
    if (raw.startsWith('v1/')) return `/${raw}`
    if (raw.startsWith('artifacts/')) return `/v1/${raw}`
    if (raw.startsWith('/')) return `/v1${raw}`
    return `/v1/${raw.replace(/^\.\//, '')}`
  }

  const path = toPath()
  if (direct && origin && path.startsWith('/')) return `${origin}${path}`
  return path
}

function formatOutValue(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'object') {
    if (value.name != null) return String(value.name)
    if (value.id != null) return String(value.id)
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function normalizeOutItem(node, item, index = 0) {
  if (item == null) return null

  if (typeof item === 'string') {
    const text = item.trim()
    if (!text) return null
    const looksUrl = /^(https?:\/\/|\/|v1\/|artifacts\/)/i.test(text)
    const url = looksUrl ? resolveArtifactUrl(text) : ''
    const value = looksUrl ? '' : text
    const name = fileNameFromUrl(url) || value || `${node?.id || 'node'}-${index + 1}`
    return {
      id: `out-${node?.id || 'node'}-${index}-${name}`,
      nodeId: String(node?.id || ''),
      nodeName: node?.name || '',
      name: String(name),
      originalName: String(name),
      url,
      value,
      display: url || value,
      ext: extFromName(name) || (url ? extFromName(url) : ''),
      uploadOk: true,
      error: '',
      previewUrl: '',
      fileUrl: '',
      sourceUrl: url,
    }
  }

  if (typeof item !== 'object') return null

  const rawUrl = item.url || item.URL || item.fileUrl || ''
  const url = rawUrl ? resolveArtifactUrl(rawUrl) : ''
  const value = formatOutValue(item.value)
  if (!url && !value && !item.name && !item.filename && !item.originalName && !item.label) {
    return null
  }

  const name =
    item.name ||
    item.filename ||
    item.originalName ||
    item.label ||
    fileNameFromUrl(url) ||
    value ||
    `${node?.id || 'node'}-${index + 1}`

  return {
    id: `out-${node?.id || 'node'}-${index}-${name}`,
    nodeId: String(node?.id || ''),
    nodeName: node?.name || '',
    name: String(name),
    originalName: String(name),
    url,
    value,
    display: url || value,
    ext: String(item.ext || extFromName(name) || extFromName(url)).toLowerCase().replace(/^\./, ''),
    uploadOk: true,
    error: '',
    previewUrl: '',
    fileUrl: '',
    sourceUrl: url,
  }
}

function outsToItems(raw) {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') return [raw]
  if (typeof raw === 'object') {
    // 支持 { url } / { value } 单对象，或 { key: outItem } 字典
    if ('url' in raw || 'value' in raw || 'fileUrl' in raw || 'name' in raw || 'filename' in raw) {
      return [raw]
    }
    return Object.entries(raw).map(([key, value]) => {
      if (value && typeof value === 'object') {
        return { name: value.name || key, ...value }
      }
      return { name: key, value }
    })
  }
  return []
}

/** 从算法树收集各节点 outs：有 url 用 url，否则用 value */
export function collectAlgorithmOuts(algorithm) {
  const list = []
  const walk = (node) => {
    if (!node) return
    const items = outsToItems(node.outs)
    items.forEach((item, index) => {
      const normalized = normalizeOutItem(node, item, index)
      if (normalized) list.push(normalized)
    })
    ;(node.children || []).forEach(walk)
  }
  walk(algorithm)

  const seen = new Set()
  return list.filter((item) => {
    const key = `${item.nodeId}|${item.name}|${item.display}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function matchProjectFile(projectFiles, out) {
  const name = out.name
  return (
    projectFiles.find((item) => item?.originalName === name) ||
    projectFiles.find((item) => String(item?.relativePath || '').endsWith(`/${name}`)) ||
    projectFiles.find((item) => String(item?.relativePath || '') === name) ||
    null
  )
}

function collectConflictInfo(value, ids, revisions) {
  if (value == null) return
  if (Array.isArray(value)) {
    value.forEach((item) => collectConflictInfo(item, ids, revisions))
    return
  }
  if (typeof value !== 'object') return

  for (const key of ['id', 'fileId']) {
    const id = value[key]
    if (id != null && /^\d{16,}$/.test(String(id))) ids.add(String(id))
  }
  if (value.revision != null && Number.isFinite(Number(value.revision))) {
    revisions.add(Number(value.revision))
  }
  Object.values(value).forEach((item) => {
    if (item && typeof item === 'object') collectConflictInfo(item, ids, revisions)
  })
}

/**
 * 从 409 取出冲突文件 ID（expectedRevisions 值统一填 2），
 * 以及 revision（0 去掉第 1 个 filePath，1 去掉第 2 个，以此类推）。
 */
function conflictFromError(error) {
  const ids = new Set()
  const revisions = new Set()
  const payload = error?.payload
  collectConflictInfo(payload?.data, ids, revisions)

  const text = [
    error?.message,
    payload?.msg,
    payload?.message,
    typeof payload?.data === 'string' ? payload.data : '',
  ]
    .filter(Boolean)
    .join('\n')

  for (const match of text.matchAll(/\d{16,}/g)) ids.add(match[0])
  for (const match of text.matchAll(/(?:revision|rev|修订号?)\s*[=:：]?\s*(\d+)/gi)) {
    revisions.add(Number(match[1]))
  }

  const expectedRevisions = {}
  ids.forEach((id) => {
    expectedRevisions[id] = 2
  })
  return { expectedRevisions, revisions: [...revisions] }
}

/** revision 0 → 去掉第 1 个地址，1 → 去掉第 2 个 */
function dropFilePathsByRevision(filePaths, revisions) {
  const remove = new Set(
    (revisions || []).map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0),
  )
  if (!remove.size) return [...filePaths]
  return filePaths.filter((_, index) => !remove.has(index))
}

/**
 * 列出各算法输出；有 url 的按 http://10.202.210.30:32862 + 真实路径 提交 filePaths。
 */
export async function uploadAlgorithmOutsToDataset(
  algorithm,
  datasetId = WORKFLOW_RESULT_DATASET_ID,
) {
  const listed = collectAlgorithmOuts(algorithm)
  const withUrl = listed.filter((item) => item.url)
  const filePaths = withUrl.map((item) => toImportFilePath(item.url)).filter(Boolean)

  let uploaded = null
  if (filePaths.length) {
    try {
      uploaded = await importDatasetByFilePaths(datasetId, {
        filePaths,
        overwrite: false,
      })
    } catch (error) {
      if (error?.code === 409) {
        const { expectedRevisions, revisions } = conflictFromError(error)
        const retryPaths = dropFilePathsByRevision(filePaths, revisions)
        if (!retryPaths.length) {
          console.warn('[workflow-outputs] 409 后无可提交 filePaths', error?.message || error)
          return listed.map((out) =>
            out.url
              ? { ...out, uploadOk: false, error: error?.message || '存在同名文件' }
              : out,
          )
        }
        uploaded = await importDatasetByFilePaths(datasetId, {
          filePaths: retryPaths,
          overwrite: true,
          expectedRevisions,
        })
      } else {
        console.warn('[workflow-outputs] upload failed', error)
        return listed.map((out) =>
          out.url
            ? { ...out, uploadOk: false, error: error?.message || '上传失败' }
            : out,
        )
      }
    }
  }

  const projectFiles = Array.isArray(uploaded) ? uploaded : uploaded ? [uploaded] : []

  return listed.map((out) => {
    if (!out.url) return out
    const importUrl = toImportFilePath(out.url)
    const matched =
      matchProjectFile(projectFiles, out) ||
      projectFiles.find((item) => String(item?.originalName || '') === out.name) ||
      null
    if (!matched) {
      return {
        ...out,
        sourceUrl: importUrl,
        uploadOk: false,
        error: projectFiles.length ? '未匹配到入库文件' : '上传未返回文件',
      }
    }
    return {
      ...out,
      id: matched.id ? String(matched.id) : out.id,
      originalName: matched.originalName || out.originalName,
      name: matched.originalName || out.name,
      ext: String(matched.ext || out.ext || '').toLowerCase().replace(/^\./, ''),
      sourceUrl: importUrl,
      previewUrl: matched.previewUrl || '',
      fileUrl: matched.fileUrl || '',
      uploadOk: true,
      error: '',
    }
  })
}
