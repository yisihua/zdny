import request from './request'

export const DATASET_TYPES = [
  { value: 'RAW_RGB', labelKey: 'data.typeRawRgb' },
  { value: 'ORTHOMOSAIC', labelKey: 'data.typeOrthomosaic' },
  { value: 'PLOT_BOUNDARY', labelKey: 'data.typePlotBoundary' },
  { value: 'DSM', labelKey: 'data.typeDsm' },
  { value: 'PLOT_ELEVATION', labelKey: 'data.typePlotElevation' },
  { value: 'PLOT_RGB', labelKey: 'data.typePlotRgb' },
  { value: 'MATERIAL_MAPPING', labelKey: 'data.typeMaterialMapping' },
  { value: 'PHENOTYPE', labelKey: 'data.typePhenotype' },
  { value: 'VISUAL_FEATURES', labelKey: 'data.typeVisualFeatures' },
  { value: 'BREEDER_PREFERENCES', labelKey: 'data.typeBreederPreferences' },
  { value: 'SCREENING_RESULT', labelKey: 'data.typeScreeningResult' },
]

function cleanParams(params = {}) {
  const next = {}
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    next[key] = value
  })
  return next
}

export function fetchDatasets(params = {}) {
  return request.get('/datasets', {
    params: cleanParams({
      projectId: params.projectId,
      year: params.year,
      location: params.location,
      collectionDate: params.collectionDate,
      sensor: params.sensor,
      page: params.page || 1,
      pageSize: params.pageSize || 10,
    }),
  })
}

export function fetchDataset(id) {
  return request.get(`/datasets/${id}`)
}

function normalizeDescription(value) {
  if (value == null) return null
  const text = String(value).trim()
  return text ? text : null
}

export function createDataset(projectId, body) {
  return request.post(`/projects/${projectId}/datasets`, {
    name: String(body.name || '').trim(),
    description: normalizeDescription(body.description),
    dataType: body.dataType,
    collectionDate: body.collectionDate || null,
    batch: body.batch ? String(body.batch).trim() : null,
    sensor: body.sensor ? String(body.sensor).trim() : null,
  })
}

export function updateDataset(id, body) {
  return request.put(`/datasets/${id}`, {
    name: String(body.name || '').trim(),
    description: normalizeDescription(body.description),
    collectionDate: body.collectionDate || null,
    batch: body.batch ? String(body.batch).trim() : null,
    sensor: body.sensor ? String(body.sensor).trim() : null,
  })
}

export function fetchDatasetFiles(id, params = {}) {
  return request.get(`/datasets/${id}/files`, {
    params: {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
    },
  })
}

function postDatasetImport(id, form, { onProgress, signal } = {}) {
  const token = localStorage.getItem('token')
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const url = `${base}/datasets/${encodeURIComponent(id)}/imports`

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    const abort = () => {
      xhr.abort()
      const error = new Error('上传已取消')
      error.name = 'AbortError'
      reject(error)
    }
    if (signal) {
      if (signal.aborted) {
        abort()
        return
      }
      signal.addEventListener('abort', abort, { once: true })
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        onProgress?.({ loaded: event.loaded, total: 0, percent: 0, phase: 'upload' })
        return
      }
      const percent = Math.max(0, Math.min(99, Math.round((event.loaded / event.total) * 100)))
      onProgress?.({ loaded: event.loaded, total: event.total, percent, phase: 'upload' })
    }

    xhr.upload.onload = () => {
      onProgress?.({ loaded: 0, total: 0, percent: 99, phase: 'processing' })
    }

    xhr.onerror = () => reject(new Error('网络异常，上传失败'))
    xhr.onabort = () => {
      const error = new Error('上传已取消')
      error.name = 'AbortError'
      reject(error)
    }

    xhr.onload = () => {
      let payload = null
      try {
        payload = JSON.parse(xhr.responseText || 'null')
      } catch {
        payload = null
      }

      if (xhr.status === 409 || payload?.code === 409) {
        const error = new Error(payload?.msg || payload?.message || '存在同名文件，需确认覆盖')
        error.code = 409
        error.payload = payload
        reject(error)
        return
      }

      if (xhr.status < 200 || xhr.status >= 300 || (payload && payload.code !== 0 && payload.code !== 200)) {
        const message =
          payload?.msg ||
          payload?.message ||
          payload?.error?.message ||
          `上传失败（${xhr.status}）`
        const error = new Error(message)
        error.code = payload?.code || xhr.status
        error.payload = payload
        reject(error)
        return
      }

      onProgress?.({ loaded: 0, total: 0, percent: 100, phase: 'done' })
      resolve(payload?.data)
    }

    onProgress?.({ loaded: 0, total: 0, percent: 0, phase: 'upload' })
    xhr.send(form)
  })
}

/** 规范为 string[]；单个字符串不拆成字符 */
function normalizeFilePathList(filePaths) {
  if (filePaths == null || filePaths === '') return []
  const list = typeof filePaths === 'string' ? [filePaths] : Array.from(filePaths)
  return list.map((item) => String(item || '').trim()).filter(Boolean)
}

/**
 * 批量导入（对接文档 8.5）。
 * FormData：
 * - files: File[]，同名字段重复追加
 * - filePaths: URL/路径字符串（可多项，FormData 同名重复追加）
 * - overwrite / expectedRevisions
 * 二者至少一项；409 时抛出 { code:409, message }
 *
 * @example
 * form.append('filePaths', 'http://10.202.210.30:32862/v1/artifacts/jiaxing-height-map.geojson')
 */
export function importDatasetFiles(
  id,
  { files, filePaths, overwrite = false, expectedRevisions = {}, onProgress, signal } = {},
) {
  const fileList = Array.from(files || [])
  const pathList = normalizeFilePathList(filePaths)

  if (!fileList.length && !pathList.length) {
    return Promise.reject(new Error('请选择要上传的文件或提供 filePaths'))
  }

  const form = new FormData()
  fileList.forEach((file) => {
    const relative = file.webkitRelativePath || file.name
    form.append('files', file, relative)
  })
  pathList.forEach((path) => {
    form.append('filePaths', path)
  })
  form.append('overwrite', overwrite ? 'true' : 'false')
  form.append('expectedRevisions', JSON.stringify(expectedRevisions || {}))
  return postDatasetImport(id, form, { onProgress, signal })
}

/**
 * 仅 filePaths 导入（服务器路径或 http(s) 地址）。
 */
export function importDatasetByFilePaths(
  id,
  { filePaths, overwrite = false, expectedRevisions = {}, onProgress, signal } = {},
) {
  return importDatasetFiles(id, {
    filePaths: normalizeFilePathList(filePaths),
    overwrite,
    expectedRevisions,
    onProgress,
    signal,
  })
}

export function createDatasetShare(id, body) {
  return request.post(`/datasets/${id}/shares`, {
    fileId: body.fileId ?? null,
    targetType: body.targetType,
    targetId: body.targetType === 'ALL' ? null : body.targetId || null,
  })
}

export function fetchDatasetShares(id, params = {}) {
  return request.get(`/datasets/${id}/shares`, {
    params: {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
    },
  })
}

export function revokeDatasetShare(id, shareId) {
  return request.post(`/datasets/${id}/shares/${shareId}/revoke`)
}

export function deleteDataset(id) {
  return request.post(`/datasets/${id}/delete`)
}

export function deleteDatasetFile(id) {
  return request.post(`/datasets/files/${id}/delete`)
}

function authFetch(url) {
  const token = localStorage.getItem('token')
  return fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
}

export async function downloadDatasetFile(file) {
  const url = file?.fileUrl
  if (!url) throw new Error('缺少下载地址')
  const response = await authFetch(url)
  if (!response.ok) throw new Error(`下载失败（${response.status}）`)
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = file.originalName || 'download'
  link.click()
  URL.revokeObjectURL(objectUrl)
}

export function fileExt(file) {
  const direct = String(file?.ext || '')
    .toLowerCase()
    .replace(/^\./, '')
  if (direct) return direct
  const name = String(file?.originalName || file?.name || file?.relativePath || '')
  const match = name.match(/\.([a-z0-9]+)$/i)
  return match ? match[1].toLowerCase() : ''
}

export function isPreviewableImage(file) {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt(file))
}

export function isPreviewableTable(file) {
  return ['csv', 'tsv', 'txt', 'json', 'geojson', 'xlsx', 'xls'].includes(fileExt(file))
}

export function isPreviewablePdf(file) {
  return fileExt(file) === 'pdf'
}

export function isExcelFile(file) {
  return ['xlsx', 'xls'].includes(fileExt(file))
}

export function canPreviewFile(file) {
  return isPreviewableImage(file) || isPreviewableTable(file) || isPreviewablePdf(file)
}

function splitDelimitedLine(line, delimiter) {
  const cells = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === delimiter && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current)
  return cells
}

/** 表格预览默认展示行数（含表头） */
export const TABLE_PREVIEW_LIMIT = 201

export function parseTableText(text, ext) {
  const raw = String(text || '').replace(/^\uFEFF/, '')
  if (!raw.trim()) return { kind: 'empty', rows: [] }

  if (ext === 'json' || ext === 'geojson') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
        const keys = []
        parsed.forEach((item) => {
          Object.keys(item).forEach((key) => {
            if (!keys.includes(key)) keys.push(key)
          })
        })
        return {
          kind: 'table',
          rows: [keys, ...parsed.map((item) => keys.map((key) => {
            const value = item[key]
            if (value == null) return ''
            if (typeof value === 'object') return JSON.stringify(value)
            return String(value)
          }))],
        }
      }
      return { kind: 'json', text: JSON.stringify(parsed, null, 2) }
    } catch {
      return { kind: 'text', text: raw }
    }
  }

  const delimiter = ext === 'tsv' ? '\t' : ','
  const lines = raw.split(/\r?\n/).filter((line, index, arr) => !(index === arr.length - 1 && line === ''))
  if (ext === 'txt') {
    const sample = lines.slice(0, 5).join('\n')
    const looksDelimited = sample.includes('\t') || (sample.match(/,/g) || []).length >= 2
    if (!looksDelimited) return { kind: 'text', text: raw }
  }

  const rows = lines.map((line) => splitDelimitedLine(line, delimiter))
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const normalized = rows.map((row) => {
    const next = row.slice()
    while (next.length < width) next.push('')
    return next
  })
  return {
    kind: 'table',
    rows: normalized,
    truncated: normalized.length > TABLE_PREVIEW_LIMIT,
    totalRows: normalized.length,
  }
}

async function parseExcelBlob(blob) {
  const XLSX = await import('xlsx')
  const buffer = await blob.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames?.[0]
  if (!sheetName) return { kind: 'empty', rows: [] }
  const sheet = workbook.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: '',
  })
  const rows = matrix.map((row) => (Array.isArray(row) ? row.map((cell) => (cell == null ? '' : String(cell))) : []))
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const normalized = rows.map((row) => {
    const next = row.slice()
    while (next.length < width) next.push('')
    return next
  })
  return {
    kind: 'table',
    rows: normalized,
    truncated: normalized.length > TABLE_PREVIEW_LIMIT,
    totalRows: normalized.length,
    sheetName,
  }
}

/** 拉取预览内容：图片返回 objectUrl；表格返回解析后的 table/json/text；PDF 返回 objectUrl */
export async function previewDatasetFile(file) {
  const url = file?.previewUrl || file?.fileUrl || file?.sourceUrl || file?.url
  if (!url) throw new Error('缺少预览地址')
  const response = await authFetch(url)
  if (!response.ok) throw new Error(`预览失败（${response.status}）`)
  const blob = await response.blob()
  const contentType = blob.type || response.headers.get('content-type') || ''
  const ext = fileExt(file)

  if (isPreviewableImage(file) || contentType.startsWith('image/')) {
    return {
      kind: 'image',
      objectUrl: URL.createObjectURL(blob),
      contentType,
    }
  }

  if (isPreviewablePdf(file) || contentType.includes('application/pdf')) {
    const pdfBlob = blob.type === 'application/pdf'
      ? blob
      : new Blob([blob], { type: 'application/pdf' })
    return {
      kind: 'pdf',
      objectUrl: URL.createObjectURL(pdfBlob),
      contentType: 'application/pdf',
    }
  }

  if (isExcelFile(file) || contentType.includes('spreadsheet') || contentType.includes('excel')) {
    const parsed = await parseExcelBlob(blob)
    return {
      ...parsed,
      contentType,
    }
  }

  if (isPreviewableTable(file) || contentType.startsWith('text/') || contentType.includes('json') || contentType.includes('geo+json')) {
    const text = await blob.text()
    const parsed = parseTableText(
      text,
      ext || (contentType.includes('json') || contentType.includes('geo+json') ? (ext === 'geojson' ? 'geojson' : 'json') : 'csv'),
    )
    return {
      ...parsed,
      contentType,
    }
  }

  throw new Error('当前文件类型暂不支持预览')
}
