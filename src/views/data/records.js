export function createPublicRecords() {
  return [
    { id: 'pub-1', fileName: '浙农稻18_表型.csv', sessionId: 's-2401', ext: 'CSV', sizeKb: 36, time: '09:12', code: 'R-2401', name: '浙农稻 18', crop: '水稻', trait: '耐旱、中熟', updatedAt: '2026-03-12' },
    { id: 'pub-2', fileName: '浙农稻18_地块.geojson', sessionId: 's-2401', ext: 'GeoJSON', sizeKb: 28, time: '10:06', code: 'R-2401', name: '浙农稻 18', crop: '水稻', trait: '耐旱、中熟', updatedAt: '2026-03-18' },
    { id: 'pub-3', fileName: '钱塘籼6_产量.csv', sessionId: 's-2408', ext: 'CSV', sizeKb: 42, time: '14:20', code: 'R-2408', name: '钱塘籼 6', crop: '水稻', trait: '高产、抗稻瘟', updatedAt: '2026-04-02' },
    { id: 'pub-4', fileName: '钱塘籼6_遥感.tif', sessionId: 's-2408', ext: 'TIF', sizeKb: 128, time: '15:18', code: 'R-2408', name: '钱塘籼 6', crop: '水稻', trait: '高产、抗稻瘟', updatedAt: '2026-04-06' },
    { id: 'pub-5', fileName: '麦香9号_倒伏.txt', sessionId: 's-1103', ext: 'TXT', sizeKb: 8, time: '11:02', code: 'W-1103', name: '麦香 9 号', crop: '小麦', trait: '抗倒伏', updatedAt: '2026-02-18' },
    { id: 'pub-6', fileName: '麦香9号_样点.shp', sessionId: 's-1103', ext: 'SHP', sizeKb: 64, time: '16:40', code: 'W-1103', name: '麦香 9 号', crop: '小麦', trait: '抗倒伏', updatedAt: '2026-02-20' },
    { id: 'pub-7', fileName: '甜玉3号_机收.pdf', sessionId: 's-0816', ext: 'PDF', sizeKb: 210, time: '08:26', code: 'M-0816', name: '甜玉 3 号', crop: '玉米', trait: '宜机收', updatedAt: '2026-01-26' },
    { id: 'pub-8', fileName: '甜玉3号_果穗.png', sessionId: 's-0816', ext: 'PNG', sizeKb: 96, time: '13:11', code: 'M-0816', name: '甜玉 3 号', crop: '玉米', trait: '宜机收', updatedAt: '2026-01-30' },
    { id: 'pub-9', fileName: '区域气象.zip', sessionId: 's-3001', ext: 'ZIP', sizeKb: 480, time: '17:05', code: 'R-2401', name: '浙农稻 18', crop: '水稻', trait: '田间环境', updatedAt: '2026-05-01' },
    { id: 'pub-10', fileName: '标记位点.json', sessionId: 's-3001', ext: 'JSON', sizeKb: 22, time: '18:33', code: 'R-2408', name: '钱塘籼 6', crop: '水稻', trait: '抗稻瘟', updatedAt: '2026-05-02' },
  ]
}

export function createPersonalRecords() {
  return [
    { id: 'mine-1', fileName: '本地选系12.csv', sessionId: 's-0902', ext: 'CSV', sizeKb: 18, time: '09:40', code: 'P-0902', name: '本地选系 12', crop: '水稻', trait: '待复测', updatedAt: '2026-05-08' },
    { id: 'mine-2', fileName: '本地选系12_田间.tif', sessionId: 's-0902', ext: 'TIF', sizeKb: 156, time: '15:18', code: 'P-0902', name: '本地选系 12', crop: '水稻', trait: '待复测', updatedAt: '2026-05-09' },
    { id: 'mine-3', fileName: '观察笔记.txt', sessionId: 's-0814', ext: 'TXT', sizeKb: 6, time: '11:27', code: 'P-0814', name: '早籼观察', crop: '水稻', trait: '抽穗期', updatedAt: '2026-04-22' },
    { id: 'mine-4', fileName: '组合照片.png', sessionId: 's-0814', ext: 'PNG', sizeKb: 88, time: '16:02', code: 'P-0814', name: '早籼观察', crop: '水稻', trait: '抽穗期', updatedAt: '2026-04-18' },
    { id: 'mine-5', fileName: '原始包.zip', sessionId: 's-0706', ext: 'ZIP', sizeKb: 320, time: '10:15', code: 'P-0706', name: '本地组合 A', crop: '小麦', trait: '待整理', updatedAt: '2026-03-30' },
    { id: 'mine-6', fileName: '地块边界.shp', sessionId: 's-0706', ext: 'SHP', sizeKb: 45, time: '14:48', code: 'P-0706', name: '本地组合 A', crop: '小麦', trait: '待整理', updatedAt: '2026-03-02' },
    { id: 'mine-7', fileName: '表型注释.json', sessionId: 's-0611', ext: 'JSON', sizeKb: 14, time: '19:06', code: 'P-0611', name: '春玉米笔记', crop: '玉米', trait: '株高', updatedAt: '2026-02-11' },
  ]
}

const EXT_MAP = {
  tif: 'TIF',
  tiff: 'TIF',
  shp: 'SHP',
  png: 'PNG',
  zip: 'ZIP',
  csv: 'CSV',
  geojson: 'GeoJSON',
  json: 'JSON',
  txt: 'TXT',
  pdf: 'PDF',
}

export function canLoadMap(ext) {
  return ext === 'TIF' || ext === 'SHP' || ext === 'GeoJSON'
}

export function extOf(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return EXT_MAP[ext] || ext.toUpperCase() || '其他'
}
