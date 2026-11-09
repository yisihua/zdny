export const plotStages = [
  { id: 'free', labelKey: 'plot.stageFree' },
  { id: 'post', labelKey: 'plot.stagePost' },
]

export const plotOptions = {
  folder: ['田间航拍_20260509', '钱塘籼6航拍', '本地选系12航拍'],
  pose: [
    { id: 'exif', labelKey: 'plot.poseExif' },
    { id: 'cache', labelKey: 'plot.poseCache' },
  ],
  model: ['rseg-field-v1.3', 'rseg-field-v2.0'],
  source: [
    { id: 'both', labelKey: 'plot.sourceBoth' },
    { id: 'shp', labelKey: 'plot.sourceShp' },
  ],
  shp: ['plots_box_opt3.shp', '麦香9号_样点.shp', '地块边界.shp'],
  tif: ['钱塘籼6_遥感.tif', '本地选系12_田间.tif'],
  quality: ['0.60', '0.75', '0.85'],
}

export function plotChoice(form) {
  if (form.stage === 'free') {
    return {
      textKey: 'plot.choiceFree',
      params: {
        folder: form.folder,
        poseKey: form.pose === 'cache' ? 'plot.poseCache' : 'plot.poseExif',
        model: form.model,
      },
    }
  }
  return {
    textKey: 'plot.choicePost',
    params: {
      source: form.source === 'shp' ? undefined : `${form.tif} + ${form.shp}`,
      sourceKey: form.source === 'shp' ? 'plot.sourceShp' : undefined,
      quality: form.quality,
    },
  }
}

export function createPlotForm() {
  return {
    stage: 'free',
    folder: plotOptions.folder[0],
    pose: 'exif',
    model: plotOptions.model[0],
    source: 'both',
    shp: plotOptions.shp[0],
    tif: plotOptions.tif[0],
    quality: '0.75',
  }
}

function outputFile(name) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const types = { pdf: 'PDF', shp: 'SHP', tif: 'TIF', tiff: 'TIF' }
  return { name, ext: types[ext] || ext.toUpperCase() }
}

export function plotResult(form) {
  const count = 8 + (form.folder.length % 5)
  if (form.stage === 'free') {
    const poseText = form.pose === 'cache' ? '检测到完整 poses.csv，优先使用位姿缓存。' : '通过 ExifTool 读取经纬度、高度和姿态，构建 NED 位姿。'
    return {
      titleKey: 'plot.freeDone',
      summary: `${form.folder} · ${form.model} · 保留 ${count} 个田块`,
      steps: [
        '扫描输入目录第一层 JPG/JPEG，并加载 pipeline.yaml、model.yaml 和 metadata.yaml。',
        '调用 rseg 模型生成旋转框，四个角点按归一化坐标写入 detections。',
        poseText,
        '将每帧检测框投影到 BEV，在滑动窗口内按 IoU 合并同一田块，并保留距图像中心最近的观测帧。',
        '用邻域中位面积和 BEV IoU 过滤小目标及重复田块，按 NED 坐标排序编号。',
        '导出边界、预览和运行报告。',
      ],
      files: ['plots.json', 'plots.geojson', 'plots_box_opt3.shp', 'poses.csv', 'preview.pdf', 'timing_report.json'].map(outputFile),
    }
  }
  const sourceText = form.source === 'shp'
    ? '未提供 TIF，已按 SHP 范围生成白色合成 GeoTIFF，仅用于坐标映射和可视化。'
    : `读取 ${form.tif} 与 ${form.shp}。`
  return {
      titleKey: 'plot.postDone',
    summary: `${form.source === 'shp' ? '仅 SHP' : form.tif} · ${form.shp} · quality_min ${form.quality}`,
    steps: [
      sourceText,
      '将 SHP 几何转换为预览像素，去除高 IoU 重复田块，并按矩形边方向完成第一次转正。',
      `以田块中心做 DBSCAN 聚类，保留质量分不低于 ${form.quality} 的研究区。`,
      '每个研究区围绕 ROI 最长边旋转完整图像，不裁剪，仅导出区内田块和外扩 ROI。',
      '在 ROI 内完成行对齐、行补齐、列对齐和扩展补齐，缺失矩形标记 generated=1。',
      '按大区域空间顺序和区域内行主序连续编号，并复原到原始坐标系。',
      '导出编号、原始坐标系 SHP、叠加图和汇总报告。',
    ],
    files: ['plot_ids.txt', 'plots_original.shp', form.source === 'shp' ? 'synthetic.tif' : 'overlay.tif', 'field_report.pdf', 'aggregation_report.json'].map(outputFile),
  }
}
