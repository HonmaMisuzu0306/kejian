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
import {
  detectGrid,
  enhanceText,
  countRomanStrokes,
  proportionalNuistGrid,
  splitCourseBlocksAtSeams,
  type GridGeometry,
} from './recognizers/imageProcessing'

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
  grid: GridGeometry,
): CellColor[][] {
  return Array.from({ length: NUIST_MOBILE_LAYOUT.sections }, (_, row) =>
    Array.from({ length: NUIST_MOBILE_LAYOUT.weekdays }, (_, column) => {
      const left = Math.round(grid.left + column * grid.columnWidth)
      const top = Math.round(grid.top + row * grid.rowHeight)
      const cellWidth = Math.round(grid.columnWidth)
      const cellHeight = Math.round(grid.rowHeight)
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
  grid: GridGeometry,
): HTMLCanvasElement {
  const left = Math.round(grid.left + (block.weekday - 1) * grid.columnWidth)
  const top = Math.round(grid.top + (block.startSection - 1) * grid.rowHeight)
  const width = Math.round(grid.columnWidth)
  const height = Math.round(
    grid.rowHeight * (block.endSection - block.startSection + 1),
  )
  const scale = 2
  const inset = Math.max(3, Math.round(source.width / 270))
  const padding = 20
  const original = document.createElement('canvas')
  original.width = width - inset * 2
  original.height = height - inset * 2
  const originalContext = original.getContext('2d')
  if (!originalContext) throw new Error('当前设备无法生成 OCR 图像。')
  originalContext.drawImage(
    source,
    left + inset,
    top + inset,
    original.width,
    original.height,
    0,
    0,
    original.width,
    original.height,
  )
  const pixels = originalContext.getImageData(
    0,
    0,
    original.width,
    original.height,
  )
  pixels.data.set(enhanceText(pixels, block.color))
  originalContext.putImageData(pixels, 0, 0)
  const crop = document.createElement('canvas')
  crop.width = original.width * scale + padding * 2
  crop.height = original.height * scale + padding * 2
  const context = crop.getContext('2d')
  if (!context) throw new Error('当前设备无法生成 OCR 图像。')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.fillStyle = '#fff'
  context.fillRect(0, 0, crop.width, crop.height)
  context.drawImage(
    original,
    padding,
    padding,
    original.width * scale,
    original.height * scale,
  )
  return crop
}

const asset = (path: string) => new URL(path, document.baseURI).href

export const nuistScreenshotRecognizer: TimetableImageRecognizer = {
  async recognize({ image, semesterId, weekNumber, onProgress }) {
    onProgress?.(0.02, '正在读取截图')
    const decoded = await decodeImage(image)
    try {
      if (!isSupportedNuistScreenshot(decoded.width, decoded.height))
        throw new Error(
          '暂不支持这张截图的版式。V1.0.1 目前适配南信大移动教务课表的竖屏周视图，请保留完整页面后重试。',
        )
      const { canvas, context } = imageCanvas(decoded)
      const detectedGrid = detectGrid(
        context.getImageData(0, 0, canvas.width, canvas.height),
      )
      const grid =
        detectedGrid ?? proportionalNuistGrid(canvas.width, canvas.height)
      const blocks = splitCourseBlocksAtSeams(
        context.getImageData(0, 0, canvas.width, canvas.height),
        grid,
        detectCourseBlocks(cellColors(context, grid)),
      )
      if (!blocks.length)
        throw new Error(
          '没有检测到课程色块。当前仅支持南信大移动教务系统的完整竖屏周课表，请确认截图未裁切且画面清晰。',
        )
      onProgress?.(0.08, `检测到 ${blocks.length} 个课程块`)

      const { createWorker, OEM, PSM } = await import('tesseract.js')
      let workerReady = false
      const worker = await createWorker('chi_sim', OEM.LSTM_ONLY, {
        workerPath: asset('ocr/worker.min.js'),
        corePath: asset('ocr/core'),
        langPath: asset('ocr/lang-full-v2'),
        // A different model must never reuse the previous quantized IndexedDB cache.
        cachePath: 'kejian-chi-sim-full-v2',
        gzip: false,
        logger(message) {
          if (!workerReady)
            onProgress?.(
              0.08 + (Number(message.progress) || 0) * 0.06,
              '正在初始化本地中文识别',
            )
        },
      })
      try {
        workerReady = true
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300',
        })

        const warnings = [
          '实验性本地识别：图片只在当前设备处理，不会上传。中文小字可能有错字，请逐项对照原图。',
          'V1.0.1 只适配南信大移动教务课表的竖屏周视图；周次仍以你在上传页确认的数字为准。',
          ...(!detectedGrid
            ? [
                '截图中的网格线较浅，已按南信大完整周课表版式定位；星期和节次请在导入前核对。',
              ]
            : []),
        ]
        const courses = []
        for (let index = 0; index < blocks.length; index++) {
          const block = blocks[index]
          onProgress?.(
            0.15 + (index / blocks.length) * 0.82,
            `正在识别课程 ${index + 1}/${blocks.length}`,
          )
          const crop = cropBlock(canvas, block, grid)
          const result = await worker.recognize(
            crop,
            {},
            { text: true, blocks: true },
          )
          let recognizedText = result.data.text
          if (
            /[|丨IⅠⅡⅢ工]/u.test(recognizedText) &&
            result.data.blocks?.length
          ) {
            const pixels = crop
              .getContext('2d')!
              .getImageData(0, 0, crop.width, crop.height)
            const lines = result.data.blocks.flatMap((b) =>
              b.paragraphs.flatMap((p) => p.lines),
            )
            recognizedText = lines
              .map((line) =>
                line.words
                  .map((word) => {
                    if (!/^[|丨IⅠⅡⅢ]+$|^工$/u.test(word.text)) return word.text
                    const count = countRomanStrokes(pixels, word.bbox)
                    return count && (word.text !== '工' || count > 1)
                      ? 'I'.repeat(count)
                      : word.text
                  })
                  .join(' '),
              )
              .join('\n')
          }
          const parsed = parseRecognizedCourse(recognizedText)
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
          if (/[|丨ⅠⅡⅢ]/u.test(result.data.text))
            warnings.push(
              `${parsed.name || '未命名课程'}：请对照原图核对罗马数字（Ⅰ/Ⅱ/Ⅲ），识别可能漏掉笔画。`,
            )
          if (parsed.remainder)
            warnings.push(
              `${parsed.name || '未命名课程'} 的教室后还有文字「${parsed.remainder}」，可能是课程备注或另一门课，请对照原图确认。`,
            )
          if (!parsed.name)
            warnings.push(
              `周${block.weekday}第 ${block.startSection}–${block.endSection} 节未识别出课程名称。`,
            )
          else if (result.data.confidence < 85)
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
      }
    } finally {
      if ('close' in decoded && typeof decoded.close === 'function')
        decoded.close()
    }
  },
}
