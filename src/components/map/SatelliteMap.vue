<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import XYZ from 'ol/source/XYZ'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Polygon from 'ol/geom/Polygon'
import { fromLonLat } from 'ol/proj'
import { Fill, Stroke, Style } from 'ol/style'
import { defaults as defaultControls } from 'ol/control/defaults'
import 'ol/ol.css'

const props = defineProps({
  fileName: { type: String, required: true },
  kind: { type: String, default: 'SHP' },
})

const host = ref(null)
let map
let observer

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

function mountMap() {
  map?.setTarget(null)
  map?.dispose?.()
  const feature = featureOf(props.fileName)
  const vector = new VectorLayer({
    source: new VectorSource({ features: [feature] }),
    style: new Style({
      fill: new Fill({ color: props.kind === 'TIF' ? 'rgba(80, 200, 140, 0.18)' : 'rgba(47, 191, 106, 0.35)' }),
      stroke: new Stroke({ color: '#8cf0ae', width: 2 }),
    }),
  })
  map = new Map({
    target: host.value,
    layers: [
      new TileLayer({
        source: new XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attributions: 'Tiles © Esri',
        }),
      }),
      vector,
    ],
    controls: defaultControls({ attribution: false }),
    view: new View({
      center: fromLonLat([120.12, 30.28]),
      zoom: 15,
    }),
  })
  map.getView().fit(feature.getGeometry().getExtent(), { padding: [36, 36, 36, 36], maxZoom: 17 })
}

onMounted(() => {
  mountMap()
  observer = new ResizeObserver(() => map?.updateSize())
  observer.observe(host.value)
})

watch(
  () => [props.fileName, props.kind],
  () => {
    mountMap()
    requestAnimationFrame(() => map?.updateSize())
  },
)

onBeforeUnmount(() => {
  observer?.disconnect()
  map?.setTarget(null)
  map = null
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
