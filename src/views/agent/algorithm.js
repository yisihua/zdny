const FILES = [
  { id: 'pub-1', filename: '浙农稻18_表型.csv', ext: 'CSV' },
  { id: 'pub-2', filename: '浙农稻18_地块.geojson', ext: 'GEOJSON' },
  { id: 'pub-3', filename: '钱塘籼6_产量.csv', ext: 'CSV' },
  { id: 'pub-4', filename: '钱塘籼6_遥感.tif', ext: 'TIF' },
  { id: 'pub-6', filename: '麦香9号_样点.shp', ext: 'SHP' },
  { id: 'pub-7', filename: '甜玉3号_机收.pdf', ext: 'PDF' },
  { id: 'pub-8', filename: '甜玉3号_果穗.png', ext: 'PNG' },
  { id: 'pub-10', filename: '标记位点.json', ext: 'JSON' },
  { id: 'mine-2', filename: '本地选系12_田间.tif', ext: 'TIF' },
  { id: 'mine-6', filename: '地块边界.shp', ext: 'SHP' },
  { id: 'mine-7', filename: '表型注释.json', ext: 'JSON' },
]

function param(name, label, extra) {
  return {
    name,
    label,
    required: true,
    default: null,
    value: null,
    description: '',
    ...extra,
  }
}

function choice(name, label, options, value, description) {
  return param(name, label, {
    data_type: 'string',
    widget: 'select',
    options,
    default: value,
    value,
    description,
  })
}

function fileList(name, label, ids, valueId, description) {
  const files = FILES.filter((item) => ids.includes(item.id))
  const chosen = files.find((item) => item.id === valueId) || null
  return param(name, label, {
    data_type: 'file',
    widget: 'file',
    files,
    default: null,
    value: chosen ? { id: chosen.id, filename: chosen.filename } : null,
    description,
  })
}

function node(id, name, inputs) {
  return { id, name, description: '', inputs, status: 'pending', progress: 0, children: [] }
}

export function createPhenoGroup() {
  return {
    id: 'ag_pheno',
    name: '表型解析',
    description: '先确认任务，再并行解析田块、地形、影像和育种家经验。',
    algorithm: {
      ...node('plan', '需求解析与任务规划', [
        choice('version', '任务版本', [
          { value: 'v2', label: 'V2' },
          { value: 'v3', label: 'V3' },
        ], 'v3', '本次规划使用的任务版本。'),
        param('completeness', '完整性阈值', {
          data_type: 'number',
          widget: 'number',
          default: 90,
          value: 92,
          description: '数据完整性低于该值时不进入执行。',
        }),
        fileList('task_file', '任务材料', ['pub-10', 'mine-7', 'pub-1'], 'pub-10', '规划时参考的材料文件。'),
      ]),
      children: [
        node('field', '田块提取', [
          choice('model', '检测模型', [
            { value: 'rseg-field-v1.3', label: 'rseg-field-v1.3' },
            { value: 'rseg-field-v2.0', label: 'rseg-field-v2.0' },
          ], 'rseg-field-v1.3', '田块旋转框检测模型。'),
          choice('pose', '位姿来源', [
            { value: 'exif', label: '读取 EXIF/XMP' },
            { value: 'csv', label: '使用已有 poses.csv' },
          ], 'exif', '跨帧拼接使用的位姿。'),
          fileList('boundary', '田块边界', ['pub-2', 'pub-6', 'mine-6', 'pub-4'], 'pub-2', '提取时使用的边界或影像。'),
        ]),
        node('dem', 'DEM 表型解析', [
          choice('resolution', '分辨率', [
            { value: '1m', label: '1 米' },
            { value: '5m', label: '5 米' },
          ], '1m', '地形栅格的采样间距。'),
          fileList('dem_file', '地形文件', ['pub-4', 'mine-2'], 'pub-4', '数字高程或配套影像。'),
        ]),
        node('rgb', 'RGB 表型解析', [
          param('quality', '质量阈值', {
            data_type: 'number',
            widget: 'number',
            default: 0.6,
            value: 0.6,
            description: '低于该分数的影像帧不参与解析。',
          }),
          fileList('rgb_file', '可见光影像', ['pub-4', 'mine-2', 'pub-8'], 'mine-2', '本次解析使用的可见光文件。'),
        ]),
        node('expert', '育种家经验解析', [
          choice('weight', '权重配置', [
            { value: 'balanced', label: '均衡' },
            { value: 'yield', label: '产量优先' },
          ], null, '经验项在综合评分中的权重。'),
          fileList('note_file', '经验材料', ['pub-1', 'pub-3', 'pub-7', 'mine-7'], 'pub-7', '育种家记录或表型表。'),
        ]),
      ],
    },
  }
}

export function inputText(input) {
  const value = input.value ?? input.default
  if (value == null || value === '') return ''
  if (input.widget === 'select') {
    return input.options?.find((item) => item.value === value)?.label ?? String(value)
  }
  if (input.data_type === 'dataset') return value.name || value.id || ''
  if (input.data_type === 'file') return value.filename || value.id || ''
  if (typeof value === 'boolean') return value ? '是' : '否'
  return String(value)
}
