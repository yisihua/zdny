/**
 * 9.3 鉴权地图 PNG
 * GET /api/maps/{id}?width=512&height=512&srs=EPSG:3857&bbox=minX,minY,maxX,maxY
 * 返回 image/png；须带 Authorization。
 */

function clampSize(n, fallback = 512) {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return fallback
  return Math.min(2048, Math.max(1, v))
}

/**
 * @param {string} mapUrl 如 /api/maps/{id}
 * @param {{ width?: number, height?: number, srs?: string, bbox?: string|number[], signal?: AbortSignal }} [options]
 * @returns {Promise<Blob>}
 */
export async function fetchAuthMapPng(mapUrl, options = {}) {
  const url = String(mapUrl || '').trim()
  if (!url) throw new Error('缺少 mapUrl')

  const width = clampSize(options.width, 512)
  const height = clampSize(options.height, 512)
  const srs = String(options.srs || 'EPSG:3857').trim() || 'EPSG:3857'

  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    srs,
  })

  if (options.bbox != null && options.bbox !== '') {
    const bbox = Array.isArray(options.bbox) ? options.bbox.join(',') : String(options.bbox)
    params.set('bbox', bbox)
  }

  const token = localStorage.getItem('token')
  const response = await fetch(`${url}?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal: options.signal,
  })

  if (!response.ok) {
    let message = `地图加载失败（${response.status}）`
    try {
      const text = await response.text()
      const json = JSON.parse(text)
      message = json?.msg || json?.message || message
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('json') || contentType.includes('text/html')) {
    throw new Error('地图接口未返回 PNG')
  }

  return response.blob()
}

/** Blob → HTMLImageElement（再给 OpenLayers / ObjectURL 用） */
export function blobToImage(blob) {
  const objectUrl = URL.createObjectURL(blob)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ image: img, objectUrl })
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('地图图片解析失败'))
    }
    img.src = objectUrl
  })
}
