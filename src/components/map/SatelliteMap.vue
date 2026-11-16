<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import ImageLayer from 'ol/layer/Image'
import XYZ from 'ol/source/XYZ'
import VectorSource from 'ol/source/Vector'
import ImageSource from 'ol/source/Image'
import TileWMS from 'ol/source/TileWMS'
import Feature from 'ol/Feature'
import Polygon from 'ol/geom/Polygon'
import GeoJSON from 'ol/format/GeoJSON'
import { getWidth, getHeight } from 'ol/extent'
import { fromLonLat } from 'ol/proj'
import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style'
import { defaults as defaultControls } from 'ol/control/defaults'
import { blobToImage, fetchAuthMapPng } from '@/api/map'
import 'ol/ol.css'

const props = defineProps({
  fileName: { type: String, required: true },
  kind: { type: String, default: 'SHP' },
  geojson: { type: [Object, Array], default: null },
  /** 鉴权地图 PNG 入口，如 /api/maps/{id}；或 GeoServer WMS 地址 */
  mapUrl: { type: String, default: '' },
  /** GeoServer 图层名（可选）；有则走瓦片 WMS，加载更顺滑 */
  wmsLayer: { type: String, default: '' },
})

const host = ref(null)
let map
let observer
let loadSeq = 0
const blobUrls = []
const abortControllers = new Set()

const GEOSERVER_ORIGIN = 'http://10.202.210.30:8090/geoserver'
const GEOSERVER_PROXY = (import.meta.env.VITE_GEOSERVER_BASE || '/geoserver').replace(/\/$/, '')

function isGeoJsonKind(kind) {
  return String(kind || '').toUpperCase().includes('GEOJSON')
}

function trackBlobUrl(url) {
  blobUrls.push(url)
  return url
}

function revokeBlobUrls() {
  while (blobUrls.length) {
    URL.revokeObjectURL(blobUrls.pop())
  }
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

/** 把内网 GeoServer 绝对地址改写成本地代理前缀 */
function toProxiedMapUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (raw.startsWith('/api/') || raw.startsWith('/geoserver')) return raw
  if (/^https?:\/\/10\.202\.210\.30:8090\/geoserver/i.test(raw)) {
    return raw.replace(/^https?:\/\/10\.202\.210\.30:8090\/geoserver/i, GEOSERVER_PROXY)
  }
  if (raw.startsWith(GEOSERVER_ORIGIN)) {
    return `${GEOSERVER_PROXY}${raw.slice(GEOSERVER_ORIGIN.length)}`
  }
  return raw
}

function isGeoServerUrl(url) {
  const raw = String(url || '')
  return raw.includes('/geoserver') || /^https?:\/\/10\.202\.210\.30:8090\/geoserver/i.test(raw)
}

function fieldRing(name) {
  const seed = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const lon = 120.08 + (seed % 18) * 0.0016
  const lat = 30.26 + (seed % 14) * 0.0012
  const width = props.kind === 'TIF' ? 0.008 : 0.0042
  const height = props.kind === 'TIF' ? 0.0055 : 0.003
  return [
    [lon, lat],
    [lon + width, lat + height * 0.15],
    [lon + width * 0.82, lat + height],
    [lon - width * 0.08, lat + height * 0.72],
    [lon, lat],
  ].map((coord) => fromLonLat(coord))
}

function featureOf(name) {
  return new Feature({ geometry: new Polygon([fieldRing(name)]) })
}

function layerStyle() {
  const fill =
    props.kind === 'TIF'
      ? 'rgba(80, 200, 140, 0.18)'
      : isGeoJsonKind(props.kind)
        ? 'rgba(47, 191, 106, 0.28)'
        : 'rgba(47, 191, 106, 0.35)'
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
      featureProjection: 'EPSG:3857',
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
  })
}

/**
 * 对接文档 9.3：
 * GET /api/maps/{id}?width=&height=&srs=EPSG:3857&bbox=minX,minY,maxX,maxY
 * - 视图投影为 3857，bbox 直接用当前视图 extent（米）
 * - 带 Authorization，取 PNG Blob 再转图片
 */
function createMapUrlLoader(mapUrl) {
  const ratio = 1.5
  return async (extent, resolution, pixelRatio) => {
    const seq = ++loadSeq
    abortPendingLoads()
    const ctrl = new AbortController()
    abortControllers.add(ctrl)

    // 按 ratio 放大请求范围，减少拖动时反复打接口
    const widthMeters = getWidth(extent)
    const heightMeters = getHeight(extent)
    const requestExtent = [
      extent[0] - (widthMeters * (ratio - 1)) / 2,
      extent[1] - (heightMeters * (ratio - 1)) / 2,
      extent[2] + (widthMeters * (ratio - 1)) / 2,
      extent[3] + (heightMeters * (ratio - 1)) / 2,
    ]

    const width = Math.min(
      2048,
      Math.max(1, Math.round((getWidth(requestExtent) / resolution) * pixelRatio)),
    )
    const height = Math.min(
      2048,
      Math.max(1, Math.round((getHeight(requestExtent) / resolution) * pixelRatio)),
    )

    try {
      const blob = await fetchAuthMapPng(mapUrl, {
        width,
        height,
        srs: 'EPSG:3857',
        bbox: requestExtent,
        signal: ctrl.signal,
      })
      if (seq !== loadSeq) throw new DOMException('stale', 'AbortError')

      const { image, objectUrl } = await blobToImage(blob)
      trackBlobUrl(objectUrl)
      if (seq !== loadSeq) throw new DOMException('stale', 'AbortError')

      // 返回的图片覆盖 requestExtent，供 OL 正确贴图
      return { image, extent: requestExtent, pixelRatio }
    } finally {
      abortControllers.delete(ctrl)
    }
  }
}

function resolveWmsUrl(mapUrl) {
  const proxied = toProxiedMapUrl(mapUrl)
  if (proxied.includes('/wms')) return proxied.split('?')[0]
  if (isGeoServerUrl(mapUrl) || proxied.startsWith(GEOSERVER_PROXY)) {
    return `${GEOSERVER_PROXY}/wms`
  }
  return `${GEOSERVER_PROXY}/wms`
}

function createGeoServerTileLayer(mapUrl, layerName) {
  return new TileLayer({
    source: new TileWMS({
      url: resolveWmsUrl(mapUrl),
      params: {
        LAYERS: layerName,
        TILED: true,
        FORMAT: 'image/png',
        TRANSPARENT: true,
        VERSION: '1.1.1',
      },
      serverType: 'geoserver',
      transition: 0,
      maxZoom: 16,
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

function mountMap() {
  map?.setTarget(null)
  map?.dispose?.()
  abortPendingLoads()
  revokeBlobUrls()
  loadSeq += 1

  const layers = [createBaseLayer()]
  let fitExtent = null

  if (props.mapUrl) {
    const layerName = String(props.wmsLayer || '').trim()
    if (layerName) {
      // 明确图层名时走 GeoServer 瓦片（经 /geoserver 代理）
      layers.push(createGeoServerTileLayer(props.mapUrl, layerName))
    } else {
      // /api/maps/{id} 鉴权单图：取消过期请求 + 限制尺寸 + 放大请求范围减少刷新
      layers.push(createAuthImageLayer(props.mapUrl))
    }
  } else if (props.geojson) {
    const features = readGeoJsonFeatures(props.geojson)
    const source = new VectorSource({ features })
    layers.push(
      new VectorLayer({
        source,
        style: layerStyle(),
      }),
    )
    if (features.length) fitExtent = source.getExtent()
  } else {
    const feature = featureOf(props.fileName)
    const source = new VectorSource({ features: [feature] })
    layers.push(
      new VectorLayer({
        source,
        style: layerStyle(),
      }),
    )
    fitExtent = feature.getGeometry().getExtent()
  }

  map = new Map({
    target: host.value,
    layers,
    controls: defaultControls({ attribution: false }),
    view: new View({
      center: fromLonLat([120.12, 30.28]),
      zoom: 15,
      maxZoom: 20,
    }),
  })

  if (fitExtent && fitExtent.every((n) => Number.isFinite(n))) {
    map.getView().fit(fitExtent, { padding: [36, 36, 36, 36], maxZoom: 17 })
  }
}

onMounted(() => {
  mountMap()
  observer = new ResizeObserver(() => map?.updateSize())
  observer.observe(host.value)
})

watch(
  () => [props.fileName, props.kind, props.geojson, props.mapUrl, props.wmsLayer],
  () => {
    mountMap()
    requestAnimationFrame(() => map?.updateSize())
  },
)

onBeforeUnmount(() => {
  observer?.disconnect()
  abortPendingLoads()
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
