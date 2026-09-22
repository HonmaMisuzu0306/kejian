import { colorFor, newCourse } from '../domain/courses'
import type { TimetableImageRecognizer } from '../domain/types'
import {
  detectCourseBlocks,
  isSupportedNuistScreenshot,
  NUIST_MOBILE_LAYOUT,
  parseRecognizedCourse,
  type CellColor,
  type CourseBlock,
} from './recognizers/nuistLayout'

type DecodedImage = CanvasImageSource & { width: number; height: number }

function median(values: number[]) {
  const ordered = values.sort((a, b) => a - b)
  return ordered[Math.floor(ordered.length / 2)] ?? 255
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if ('createImageBitmap' in window) return createImageBitmap(file)
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

function imageCanvas(image: DecodedImage) {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('当前设备无法读取截图像素。')
  context.drawImage(image, 0, 0)
  return { canvas, context }
}

function cellColors(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): CellColor[][] {
  return Array.from({ length: NUIST_MOBILE_LAYOUT.sections }, (_, row) =>
    Array.from({ length: NUIST_MOBILE_LAYOUT.weekdays }, (_, column) => {
      const left = Math.round(
        width *
          (NUIST_MOBILE_LAYOUT.gridLeft +
            column * NUIST_MOBILE_LAYOUT.columnWidth),
      )
      const top = Math.round(
        height *
          (NUIST_MOBILE_LAYOUT.gridTop + row * NUIST_MOBILE_LAYOUT.rowHeight),
      )
      const cellWidth = Math.round(width * NUIST_MOBILE_LAYOUT.columnWidth)
      const cellHeight = Math.round(height * NUIST_MOBILE_LAYOUT.rowHeight)
      const inset = Math.max(
        5,
        Math.round(Math.min(cellWidth, cellHeight) * 0.06),
      )
      const pixels = context.getImageData(
        left + inset,
        top + inset,
        cellWidth - inset * 2,
        cellHeight - inset * 2,
      )
      const channels = {
        r: [] as number[],
        g: [] as number[],
        b: [] as number[],
      }
      const stride = Math.max(4, Math.floor(pixels.width / 24))
      for (let y = 0; y < pixels.height; y += stride)
        for (let x = 0; x < pixels.width; x += stride) {
          const offset = (y * pixels.width + x) * 4
          channels.r.push(pixels.data[offset])
          channels.g.push(pixels.data[offset + 1])
          channels.b.push(pixels.data[offset + 2])
        }
      return {
        r: median(channels.r),
        g: median(channels.g),
        b: median(channels.b),
      }
    }),
  )
}

function cropBlock(
  source: HTMLCanvasElement,
  block: CourseBlock,
): HTMLCanvasElement {
  const left = Math.round(
    source.width *
      (NUIST_MOBILE_LAYOUT.gridLeft +
        (block.weekday - 1) * NUIST_MOBILE_LAYOUT.columnWidth),
  )
  const top = Math.round(
    source.height *
      (NUIST_MOBILE_LAYOUT.gridTop +
        (block.startSection - 1) * NUIST_MOBILE_LAYOUT.rowHeight),
  )
  const width = Math.round(source.width * NUIST_MOBILE_LAYOUT.columnWidth)
  const height = Math.round(
    source.height *
      NUIST_MOBILE_LAYOUT.rowHeight *
      (block.endSection - block.startSection + 1),
  )
  const scale = 3
  const inset = 3
  const crop = document.createElement('canvas')
  crop.width = (width - inset * 2) * scale
  crop.height = (height - inset * 2) * scale
  const context = crop.getContext('2d')
  if (!context) throw new Error('当前设备无法生成 OCR 图像。')
  context.imageSmoothingEnabled = true
  context.filter = 'grayscale(1) contrast(1.45)'
  context.drawImage(
    source,
    left + inset,
    top + inset,
    width - inset * 2,
    height - inset * 2,
    0,
    0,
    crop.width,
    crop.height,
  )
  return crop
}

const asset = (path: string) => new URL(path, document.baseURI).href

export const nuistScreenshotRecognizer: TimetableImageRecognizer = {
  async recognize({ image, semesterId, weekNumber, onProgress }) {
    onProgress?.(0.02, '正在读取截图')
    const decoded = await decodeImage(image)
    if (!isSupportedNuistScreenshot(decoded.width, decoded.height))
      throw new Error(
        '暂不支持这张截图的版式。V1.0.1 目前适配南信大移动教务课表的竖屏周视图，请保留完整页面后重试。',
      )
    const { canvas, context } = imageCanvas(decoded)
    const blocks = detectCourseBlocks(
      cellColors(context, decoded.width, decoded.height),
    )
    if (!blocks.length)
      throw new Error('没有检测到课程色块，请确认截图包含完整周课表。')
    onProgress?.(0.08, `检测到 ${blocks.length} 个课程块`)

    const { createWorker, OEM, PSM } = await import('tesseract.js')
    let workerReady = false
    const worker = await createWorker('chi_sim', OEM.LSTM_ONLY, {
      workerPath: asset('ocr/worker.min.js'),
      corePath: asset('ocr/core'),
      langPath: asset('ocr/lang'),
      gzip: false,
      logger(message) {
        if (!workerReady)
          onProgress?.(
            0.08 + (Number(message.progress) || 0) * 0.06,
            '正在初始化本地中文识别',
          )
      },
    })
    workerReady = true
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_COLUMN,
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    })

    const warnings = [
      '实验性本地识别：图片只在当前设备处理，不会上传。中文小字可能有错字，请逐项对照原图。',
      'V1.0.1 只适配南信大移动教务课表的竖屏周视图；周次仍以你在上传页确认的数字为准。',
    ]
    try {
      const courses = []
      for (let index = 0; index < blocks.length; index++) {
        const block = blocks[index]
        onProgress?.(
          0.15 + (index / blocks.length) * 0.82,
          `正在识别课程 ${index + 1}/${blocks.length}`,
        )
        const result = await worker.recognize(cropBlock(canvas, block))
        const parsed = parseRecognizedCourse(result.data.text)
        const course = newCourse(semesterId, weekNumber)
        course.name = parsed.name
        course.location = parsed.location
        course.color = colorFor(
          parsed.name || `${block.weekday}-${block.startSection}`,
        )
        course.meetings = [
          {
            weekday: block.weekday,
            startSection: block.startSection,
            endSection: block.endSection,
            weeks: [weekNumber],
          },
        ]
        courses.push(course)
        if (!parsed.name)
          warnings.push(
            `周${block.weekday}第 ${block.startSection}–${block.endSection} 节未识别出课程名称。`,
          )
        else if (result.data.confidence < 65)
          warnings.push(
            `${parsed.name} 的文字置信度较低（${Math.round(result.data.confidence)}%），请重点核对。`,
          )
        if (!parsed.location)
          warnings.push(`${parsed.name || '未命名课程'} 未识别出教室。`)
      }
      onProgress?.(1, '识别草稿已生成')
      return {
        mode: 'local-ocr',
        courses,
        warnings: [...new Set(warnings)],
      }
    } finally {
      await worker.terminate()
      if ('close' in decoded && typeof decoded.close === 'function')
        decoded.close()
    }
  },
}
