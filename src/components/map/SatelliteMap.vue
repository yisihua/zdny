<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import OlMap from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import ImageLayer from 'ol/layer/Image'
import XYZ from 'ol/source/XYZ'
import VectorSource from 'ol/source/Vector'
import ImageSource from 'ol/source/Image'
import ImageWMS from 'ol/source/ImageWMS'
import Feature from 'ol/Feature'
import Polygon from 'ol/geom/Polygon'
import GeoJSON from 'ol/format/GeoJSON'
import { getWidth, getHeight } from 'ol/extent'
import WMSCapabilities from 'ol/format/WMSCapabilities'
import { fromLonLat, get as getProjection, transformExtent } from 'ol/proj'
import { register } from 'ol/proj/proj4'
import proj4 from 'proj4'
import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style'
import { defaults as defaultControls } from 'ol/control/defaults'
import { blobToImage, fetchAuthMapPng } from '@/api/map'
import 'ol/ol.css'

proj4.defs('EPSG:32651', '+proj=utm +zone=51 +datum=WGS84 +units=m +no_defs +type=crs')
register(proj4)
{
  const utm51 = getProjection('EPSG:32651')
  if (utm51) utm51.setExtent([166021.44, 0, 833978.56, 9329005.18])
}

const DEFAULT_CENTER_LONLAT = [120.12, 30.28]
const VIEW_SRS = 'EPSG:3857'

const props = defineProps({
  /** 叠加图层：{ id, fileName, ext, geojson, mapUrl, wmsUrl, wmsLayer, visible } */
  layers: { type: Array, default: () => [] },
  /** 跳转到该图层范围 */
  fitLayerId: { type: String, default: '' },
})

const host = ref(null)
let map
let baseLayer
let observer
let loadSeq = 0
const blobUrls = []
const abortControllers = new Set()
/** id -> { olLayer, extent3857 } */
const overlayMap = new Map()

const GEOSERVER_ORIGIN = String(
  import.meta.env.VITE_GEOSERVER_ORIGIN || 'http://10.202.210.30:32860/geoserver',
).replace(/\/$/, '')
const GEOSERVER_PROXY = String(import.meta.env.VITE_GEOSERVER_BASE || '/geoserver').replace(/\/$/, '')

function isGeoJsonKind(kind) {
  return String(kind || '').toUpperCase().includes('GEOJSON')
}

function trackBlobUrl(url) {
  blobUrls.push(url)
  return url
}

function revokeBlobUrls() {
  while (blobUrls.length) URL.revokeObjectURL(blobUrls.pop())
}

function abortPendingLoads() {
  abortControllers.forEach((ctrl) => {
    try {
      ctrl.abort()
    } catch {
      // ignore
    }
  })
  abortControllers.clear()
}

function toProxiedMapUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (
    raw.startsWith('/api/') ||
    raw === GEOSERVER_PROXY ||
    raw.startsWith(`${GEOSERVER_PROXY}/`) ||
    raw.startsWith(`${GEOSERVER_PROXY}?`)
  ) {
    return raw
  }
  if (raw.startsWith(GEOSERVER_ORIGIN)) {
    return `${GEOSERVER_PROXY}${raw.slice(GEOSERVER_ORIGIN.length)}`
  }
  try {
    if (/^https?:\/\//i.test(raw)) {
      const parsed = new URL(raw)
      const index = parsed.pathname.toLowerCase().indexOf('/geoserver')
      if (index >= 0) {
        const rest = parsed.pathname.slice(index + '/geoserver'.length)
        return `${GEOSERVER_PROXY}${rest}${parsed.search || ''}`
      }
    }
  } catch {
    // keep
  }
  return raw
}

function queryValue(params, names) {
  for (const name of names) {
    const value = params.get(name)
    if (value != null && String(value).trim() !== '') return String(value).trim()
  }
  return ''
}

function ensureProjectedSrs(code) {
  const srs = String(code || '').toUpperCase()
  const match = srs.match(/EPSG:(\d+)/)
  if (!match) return ''
  return `EPSG:${match[1]}`
}

function parseBboxNumbers(bboxText) {
  const parts = String(bboxText || '')
    .split(',')
    .map(Number)
  if (parts.length !== 4 || parts.some((item) => !Number.isFinite(item))) return null
  return parts
}

function workspaceFromLayers(layers) {
  const text = String(layers || '').trim()
  if (!text || !text.includes(':')) return ''
  return text.slice(0, text.indexOf(':')).trim()
}

function resolveWorkspaceWmsPath(path, layers) {
  let next = String(path || '').replace(/\/$/, '')
  const workspace = workspaceFromLayers(layers)
  if (workspace) {
    if (/\/wms\/reflect$/i.test(next)) next = next.replace(/\/wms\/reflect$/i, `/${workspace}/wms`)
    else if (/\/geoserver\/wms$/i.test(next)) next = next.replace(/\/geoserver\/wms$/i, `/geoserver/${workspace}/wms`)
    else if (/\/geoserver$/i.test(next)) next = `${next}/${workspace}/wms`
  }
  if (!/\/(wms|ows)$/i.test(next)) next = `${next}/wms`
  return next
}

function parseWmsUrl(wmsUrl) {
  let raw = String(wmsUrl || '').trim()
  if (!raw) return null
  if (!raw.includes('/') && !raw.includes('?') && !/^https?:/i.test(raw)) {
    const workspace = workspaceFromLayers(raw)
    return {
      url: workspace ? `${GEOSERVER_PROXY}/${workspace}/wms` : `${GEOSERVER_PROXY}/wms`,
      layers: raw,
      styles: '',
      version: '1.1.1',
      format: 'image/jpeg',
      srs: 'EPSG:32651',
      nativeExtent: null,
    }
  }
  if (!/^https?:\/\//i.test(raw) && !raw.startsWith('/')) raw = `/${raw}`
  const proxied = toProxiedMapUrl(raw)
  const queryIndex = proxied.indexOf('?')
  let path = queryIndex >= 0 ? proxied.slice(0, queryIndex) : proxied
  const params = new URLSearchParams(queryIndex >= 0 ? proxied.slice(queryIndex + 1) : '')
  const layers = queryValue(params, ['layers', 'LAYERS', 'layer', 'LAYER'])
  const styles = queryValue(params, ['styles', 'STYLES'])
  let version = queryValue(params, ['version', 'VERSION']) || '1.1.1'
  if (version === '1.1.0') version = '1.1.1'
  const rawFormat = queryValue(params, ['format', 'FORMAT']) || 'image/jpeg'
  const format = /openlayers/i.test(rawFormat) || /jpe?g/i.test(rawFormat) ? 'image/jpeg' : rawFormat
  const srs = ensureProjectedSrs(queryValue(params, ['srs', 'SRS', 'crs', 'CRS'])) || 'EPSG:32651'
  const nativeExtent = parseBboxNumbers(queryValue(params, ['bbox', 'BBOX']))
  path = resolveWorkspaceWmsPath(path, layers)
  return { url: path, layers, styles, version, format, srs, nativeExtent }
}

function normalizeExtent(extent) {
  if (!extent || extent.length !== 4) return null
  const minX = Math.min(extent[0], extent[2])
  const minY = Math.min(extent[1], extent[3])
  const maxX = Math.max(extent[0], extent[2])
  const maxY = Math.max(extent[1], extent[3])
  if (![minX, minY, maxX, maxY].every((n) => Number.isFinite(n)) || minX === maxX || minY === maxY) {
    return null
  }
  return [minX, minY, maxX, maxY]
}

function toViewExtent(nativeExtent, nativeSrs) {
  const box = normalizeExtent(nativeExtent)
  if (!box) return null
  const srs = ensureProjectedSrs(nativeSrs) || 'EPSG:32651'
  if (srs === VIEW_SRS || srs.includes('3857')) return box
  try {
    return normalizeExtent(transformExtent(box, srs, VIEW_SRS))
  } catch (error) {
    console.warn('[map] extent transform', error)
    return null
  }
}

function layerStyle(kind) {
  const fill = isGeoJsonKind(kind) ? 'rgba(47, 191, 106, 0.28)' : 'rgba(80, 200, 140, 0.18)'
  return new Style({
    fill: new Fill({ color: fill }),
    stroke: new Stroke({ color: '#8cf0ae', width: 2 }),
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({ color: '#8cf0ae' }),
      stroke: new Stroke({ color: '#042117', width: 1 }),
    }),
  })
}

function readGeoJsonFeatures(data) {
  if (!data) return []
  try {
    return new GeoJSON().readFeatures(data, {
      dataProjection: 'EPSG:4326',
      featureProjection: VIEW_SRS,
    })
  } catch (error) {
    console.warn('[map] invalid geojson', error)
    return []
  }
}

function createBaseLayer() {
  return new TileLayer({
    source: new XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attributions: 'Tiles © Esri',
      maxZoom: 16,
    }),
    zIndex: 0,
  })
}

function createMapUrlLoader(mapUrl) {
  const ratio = 1.5
  return async (extent, resolution, pixelRatio) => {
    const seq = ++loadSeq
    const ctrl = new AbortController()
    abortControllers.add(ctrl)
    const widthMeters = getWidth(extent)
    const heightMeters = getHeight(extent)
    const requestExtent = [
      extent[0] - (widthMeters * (ratio - 1)) / 2,
      extent[1] - (heightMeters * (ratio - 1)) / 2,
      extent[2] + (widthMeters * (ratio - 1)) / 2,
      extent[3] + (heightMeters * (ratio - 1)) / 2,
    ]
    const width = Math.min(2048, Math.max(1, Math.round((getWidth(requestExtent) / resolution) * pixelRatio)))
    const height = Math.min(2048, Math.max(1, Math.round((getHeight(requestExtent) / resolution) * pixelRatio)))
    try {
      const blob = await fetchAuthMapPng(mapUrl, {
        width,
        height,
        srs: VIEW_SRS,
        bbox: requestExtent,
        signal: ctrl.signal,
      })
      if (seq !== loadSeq) throw new DOMException('stale', 'AbortError')
      const { image, objectUrl } = await blobToImage(blob)
      trackBlobUrl(objectUrl)
      if (seq !== loadSeq) throw new DOMException('stale', 'AbortError')
      return { image, extent: requestExtent, pixelRatio }
    } finally {
      abortControllers.delete(ctrl)
    }
  }
}

function createGeoServerImageLayer(serviceUrl, layerName, options = {}) {
  const srs = ensureProjectedSrs(options.srs) || 'EPSG:32651'
  return new ImageLayer({
    source: new ImageWMS({
      ratio: 1,
      url: serviceUrl,
      crossOrigin: 'anonymous',
      params: {
        FORMAT: options.format || 'image/jpeg',
        VERSION: options.version || '1.1.1',
        STYLES: options.styles || '',
        LAYERS: layerName,
        exceptions: 'application/vnd.ogc.se_inimage',
      },
      // 视图 3857，请求按图层原生 SRS（如 32651）出图，由 OL 重投影叠加
      projection: getProjection(srs) || srs,
    }),
    opacity: 0.92,
  })
}

function createAuthImageLayer(mapUrl) {
  return new ImageLayer({
    source: new ImageSource({
      loader: createMapUrlLoader(toProxiedMapUrl(mapUrl)),
      interpolate: true,
    }),
    opacity: 0.92,
  })
}

function findCapabilitiesLayer(layer, name) {
  if (!layer || !name) return null
  const shortName = name.includes(':') ? name.slice(name.indexOf(':') + 1) : name
  const names = new Set([name, shortName])
  if (layer.Name && names.has(layer.Name)) return layer
  const children = Array.isArray(layer.Layer) ? layer.Layer : layer.Layer ? [layer.Layer] : []
  for (const child of children) {
    const found = findCapabilitiesLayer(child, name)
    if (found) return found
  }
  return null
}

async function fetchWmsLayerExtent(serviceUrl, layerName, targetSrs, signal) {
  const response = await fetch(`${serviceUrl}?service=WMS&version=1.1.1&request=GetCapabilities`, {
    signal,
  })
  if (!response.ok) throw new Error(`GetCapabilities 失败（${response.status}）`)
  const caps = new WMSCapabilities().read(await response.text())
  const layer = findCapabilitiesLayer(caps?.Capability?.Layer, layerName)
  if (!layer) return null
  const boxes = Array.isArray(layer.BoundingBox)
    ? layer.BoundingBox
    : layer.BoundingBox
      ? [layer.BoundingBox]
      : []
  const wanted = String(targetSrs || '').toUpperCase()
  const match =
    boxes.find((item) => String(item.crs || item.SRS || item.srs || '').toUpperCase() === wanted) ||
    boxes.find((item) => /32651/i.test(String(item.crs || item.SRS || item.srs || '')))
  if (match && Number.isFinite(match.extent?.[0])) return normalizeExtent(match.extent)
  const geo = layer.EX_GeographicBoundingBox || layer.LatLonBoundingBox
  let west
  let south
  let east
  let north
  if (Array.isArray(geo) && geo.length === 4) [west, south, east, north] = geo.map(Number)
  else if (geo && typeof geo === 'object') {
    west = Number(geo.west ?? geo.minx ?? geo.extent?.[0])
    south = Number(geo.south ?? geo.miny ?? geo.extent?.[1])
    east = Number(geo.east ?? geo.maxx ?? geo.extent?.[2])
    north = Number(geo.north ?? geo.maxy ?? geo.extent?.[3])
  }
  if (![west, south, east, north].every((n) => Number.isFinite(n))) return null
  try {
    return normalizeExtent(transformExtent([west, south, east, north], 'EPSG:4326', targetSrs))
  } catch {
    return null
  }
}

function fitViewToExtent(extent, { animate = true } = {}) {
  const box = normalizeExtent(extent)
  if (!box || !map) return
  const run = () => {
    if (!map) return
    map.updateSize()
    const size = map.getSize()
    if (!size || size[0] < 2 || size[1] < 2) {
      requestAnimationFrame(run)
      return
    }
    map.getView().fit(box, {
      size,
      padding: [48, 48, 48, 48],
      maxZoom: 20,
      duration: animate ? 450 : 0,
    })
  }
  requestAnimationFrame(() => requestAnimationFrame(run))
}

function buildOverlay(entry) {
  const parsedWms = entry.wmsUrl ? parseWmsUrl(entry.wmsUrl) : null
  const wmsLayerName = String(parsedWms?.layers || entry.wmsLayer || '').trim()
  let olLayer = null
  let extent3857 = null
  let pendingWms = null

  if (parsedWms?.url && wmsLayerName) {
    const layerSrs = ensureProjectedSrs(parsedWms.srs) || 'EPSG:32651'
    olLayer = createGeoServerImageLayer(parsedWms.url, wmsLayerName, {
      ...parsedWms,
      srs: layerSrs,
    })
    extent3857 = toViewExtent(parsedWms.nativeExtent, layerSrs)
    if (!extent3857) pendingWms = { url: parsedWms.url, layers: wmsLayerName, srs: layerSrs }
  } else if (entry.mapUrl) {
    olLayer = createAuthImageLayer(entry.mapUrl)
  } else if (entry.geojson) {
    const features = readGeoJsonFeatures(entry.geojson)
    const source = new VectorSource({ features })
    olLayer = new VectorLayer({
      source,
      style: layerStyle(entry.ext),
    })
    if (features.length) extent3857 = normalizeExtent(source.getExtent())
  } else {
    const seed = [...String(entry.fileName || 'layer')].reduce((sum, char) => sum + char.charCodeAt(0), 0)
    const lon = 120.08 + (seed % 18) * 0.0016
    const lat = 30.26 + (seed % 14) * 0.0012
    const ring = [
      [lon, lat],
      [lon + 0.004, lat + 0.0004],
      [lon + 0.003, lat + 0.003],
      [lon - 0.0003, lat + 0.002],
      [lon, lat],
    ].map((coord) => fromLonLat(coord))
    const feature = new Feature({ geometry: new Polygon([ring]) })
    const source = new VectorSource({ features: [feature] })
    olLayer = new VectorLayer({ source, style: layerStyle(entry.ext) })
    extent3857 = normalizeExtent(feature.getGeometry().getExtent())
  }

  olLayer.set('layerId', entry.id)
  olLayer.setVisible(entry.visible !== false)
  return { olLayer, extent3857, pendingWms }
}

function clearOverlays() {
  if (!map) {
    overlayMap.clear()
    return
  }
  overlayMap.forEach((item) => {
    map.removeLayer(item.olLayer)
  })
  overlayMap.clear()
}

function syncOverlays({ fitId = '' } = {}) {
  if (!map) return
  const list = Array.isArray(props.layers) ? props.layers : []
  const keep = new Set(list.map((item) => item.id))

  ;[...overlayMap.keys()].forEach((id) => {
    if (keep.has(id)) return
    const prev = overlayMap.get(id)
    map.removeLayer(prev.olLayer)
    overlayMap.delete(id)
  })

  list.forEach((entry, index) => {
    let slot = overlayMap.get(entry.id)
    if (!slot) {
      slot = buildOverlay(entry)
      overlayMap.set(entry.id, slot)
      map.addLayer(slot.olLayer)
      if (slot.pendingWms) {
        const ctrl = new AbortController()
        abortControllers.add(ctrl)
        fetchWmsLayerExtent(slot.pendingWms.url, slot.pendingWms.layers, slot.pendingWms.srs, ctrl.signal)
          .then((nativeExtent) => {
            const extent3857 = toViewExtent(nativeExtent, slot.pendingWms.srs)
            if (!extent3857) return
            const current = overlayMap.get(entry.id)
            if (current) current.extent3857 = extent3857
            if (fitId === entry.id || (!fitId && entry.id === list[list.length - 1]?.id)) {
              fitViewToExtent(extent3857, { animate: true })
            }
          })
          .catch((error) => {
            if (error?.name !== 'AbortError') console.warn('[map] layer extent', error)
          })
          .finally(() => abortControllers.delete(ctrl))
      }
    }
    slot.olLayer.setVisible(entry.visible !== false)
    // 数组越后层级越高
    slot.olLayer.setZIndex(10 + index)
  })

  if (fitId) {
    const target = overlayMap.get(fitId)
    if (target?.extent3857) fitViewToExtent(target.extent3857, { animate: true })
  }
}

function ensureMap() {
  if (map) return
  baseLayer = createBaseLayer()
  map = new OlMap({
    target: host.value,
    layers: [baseLayer],
    controls: defaultControls({ attribution: false }),
    view: new View({
      projection: VIEW_SRS,
      center: fromLonLat(DEFAULT_CENTER_LONLAT, VIEW_SRS),
      zoom: 15,
      maxZoom: 20,
    }),
  })
}

onMounted(() => {
  ensureMap()
  syncOverlays({ fitId: props.fitLayerId || props.layers?.[props.layers.length - 1]?.id || '' })
  observer = new ResizeObserver(() => map?.updateSize())
  observer.observe(host.value)
})

watch(
  () => props.layers.map((item) => `${item.id}:${item.visible}`).join('|'),
  () => {
    ensureMap()
    const newest = props.layers[props.layers.length - 1]
    const known = newest && overlayMap.has(newest.id)
    syncOverlays({ fitId: known ? '' : newest?.id || '' })
    requestAnimationFrame(() => map?.updateSize())
  },
)

watch(
  () => props.fitLayerId,
  (id) => {
    if (!id) return
    ensureMap()
    syncOverlays({ fitId: id })
  },
)

onBeforeUnmount(() => {
  observer?.disconnect()
  abortPendingLoads()
  clearOverlays()
  map?.setTarget(null)
  map = null
  revokeBlobUrls()
})
</script>

<template>
  <div ref="host" class="map"></div>
</template>

<style scoped>
.map {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #04140f;
}

.map :deep(.ol-zoom) {
  top: 12px;
  left: 12px;
}

.map :deep(.ol-zoom button) {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  color: #e7fff4;
  background: rgba(4, 20, 15, 0.82);
}
</style>
