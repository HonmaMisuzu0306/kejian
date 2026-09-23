import type { CellColor, CourseBlock } from './nuistLayout'

export type Pixels = { width: number; height: number; data: Uint8ClampedArray }
export type GridGeometry = {
  left: number
  top: number
  columnWidth: number
  rowHeight: number
}

// Calibrated from the supported NUIST full-screen weekly view. Used only
// after line detection fails; course-block detection still has to confirm it.
export function proportionalNuistGrid(
  width: number,
  height: number,
): GridGeometry {
  return {
    left: width * (113 / 1080),
    top: height * (624 / 2400),
    columnWidth: width * (138.3333333333 / 1080),
    rowHeight: height * (149.1818181818 / 2400),
  }
}

function luma(image: Pixels, x: number, y: number) {
  const i = (y * image.width + x) * 4
  return (image.data[i] + image.data[i + 1] + image.data[i + 2]) / 3
}

// Grid strokes are darker than both adjacent pixels over a long distance.
// Text strokes contribute only locally, and solid course fills cancel out.
function linePeaks(
  image: Pixels,
  axis: 'x' | 'y',
  crossStart: number,
  crossEnd: number,
) {
  const size = axis === 'x' ? image.width : image.height
  const radius = Math.max(3, Math.round(image.width / 270))
  const scores: number[] = Array(size).fill(0)
  for (let pos = radius; pos < size - radius; pos++) {
    let total = 0,
      count = 0
    for (let cross = crossStart; cross < crossEnd; cross += 4) {
      const at = (offset: number) =>
        axis === 'x'
          ? luma(image, pos + offset, cross)
          : luma(image, cross, pos + offset)
      total += Math.max(0, Math.min(at(-radius), at(radius)) - at(0))
      count++
    }
    scores[pos] = total / count
  }
  const peaks: { position: number; score: number }[] = []
  for (let pos = radius; pos < size - radius; pos++) {
    if (scores[pos] < 2.5) continue
    let end = pos
    while (end + 1 < size && scores[end + 1] >= 2.5) end++
    let best = pos
    for (let p = pos + 1; p <= end; p++) if (scores[p] > scores[best]) best = p
    peaks.push({ position: best, score: scores[best] })
    pos = end
  }
  return peaks
}

function fitLines(
  peaks: { position: number; score: number }[],
  count: number,
  size: number,
  startRange: [number, number],
  stepRange: [number, number],
  endRange: [number, number],
  accept: (start: number, step: number) => boolean = () => true,
) {
  let best: { start: number; step: number; score: number } | undefined
  const tolerance = Math.max(2, size * 0.0015)
  for (const first of peaks) {
    if (
      first.position < size * startRange[0] ||
      first.position > size * startRange[1]
    )
      continue
    for (const last of peaks) {
      const step = (last.position - first.position) / count
      if (
        step < size * stepRange[0] ||
        step > size * stepRange[1] ||
        last.position < size * endRange[0] ||
        last.position > size * endRange[1]
      )
        continue
      if (!accept(first.position, step)) continue
      let matched = 0,
        score = 0
      for (let i = 0; i <= count; i++) {
        const target = first.position + i * step
        const match = peaks.find(
          (p) => Math.abs(p.position - target) <= tolerance,
        )
        if (match) {
          matched++
          score += Math.min(20, match.score)
        }
      }
      // Two-section classes hide alternate horizontal rules: 0,2,4,6,8,10,11.
      if (matched < (count === 11 ? 7 : 6)) continue
      score += matched * 20
      if (!best || score > best.score)
        best = { start: first.position, step, score }
    }
  }
  return best
}

export function detectGrid(image: Pixels): GridGeometry | undefined {
  const { width, height } = image
  const proportional = proportionalNuistGrid(width, height)

  // Weekend columns are normally empty and expose the horizontal rules even
  // when course blocks cover most weekday lines. The page can show less of the
  // bottom area on devices without a navigation bar, so fit rows 0,2,...,10
  // rather than requiring the final row-11 boundary to be visible.
  const doubleRows = fitLines(
    linePeaks(
      image,
      'y',
      Math.round(proportional.left + proportional.columnWidth * 5 + 8),
      width - 8,
    ),
    5,
    height,
    [0.23, 0.3],
    [0.115, 0.145],
    [0.84, 0.97],
  )
  if (doubleRows)
    return {
      left: proportional.left,
      top: doubleRows.start,
      columnWidth: proportional.columnWidth,
      rowHeight: doubleRows.step / 2,
    }

  // The final screen edge may clip the eighth vertical line; fit the first seven.
  const columns = fitLines(
    linePeaks(image, 'x', Math.round(height * 0.35), Math.round(height * 0.88)),
    6,
    width,
    [0.07, 0.16],
    [0.115, 0.135],
    [0.85, 0.93],
  )
  if (!columns) return undefined
  const rows = fitLines(
    linePeaks(image, 'y', Math.round(columns.start + 8), width - 8),
    11,
    height,
    [0.18, 0.34],
    [0.05, 0.071],
    [0.86, 0.985],
    (start, step) => {
      let strokes = 0
      for (let col = 0; col < 7; col++) {
        const x = Math.round(columns.start + col * columns.step)
        const y = Math.round(start + step * 0.5)
        let contrast = 0
        for (let dx = -2; dx <= 2; dx++)
          contrast = Math.max(
            contrast,
            Math.min(luma(image, x + dx - 5, y), luma(image, x + dx + 5, y)) -
              luma(image, x + dx, y),
          )
        if (contrast > 4) strokes++
      }
      return strokes >= 5
    },
  )
  if (!rows) return undefined
  return {
    left: columns.start,
    top: rows.start,
    columnWidth: columns.step,
    rowHeight: rows.step,
  }
}

// Use the largest channel difference: grayscale alone washes out pale yellow,
// cyan and purple text. Keep antialiased edges instead of a hard binary cutoff.
export function enhanceText(
  image: Pixels,
  background: CellColor,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(image.data.length)
  const darkBackground = (background.r + background.g + background.b) / 3 < 220
  for (let i = 0; i < image.data.length; i += 4) {
    const delta = darkBackground
      ? Math.max(
          image.data[i] - background.r,
          image.data[i + 1] - background.g,
          image.data[i + 2] - background.b,
        )
      : Math.max(
          background.r - image.data[i],
          background.g - image.data[i + 1],
          background.b - image.data[i + 2],
        )
    const value = 255 - Math.max(0, Math.min(255, (delta - 15) * 4))
    output[i] = output[i + 1] = output[i + 2] = value
    output[i + 3] = 255
  }
  return output
}

function horizontalLuma(image: Pixels, left: number, right: number, y: number) {
  let total = 0,
    count = 0
  for (let x = left; x < right; x += 2) {
    total += luma(image, x, y)
    count++
  }
  return total / count
}

// A row rule is hidden inside one multi-section course, but remains visible
// between adjacent cards even when both cards share the same fill color.
export function splitCourseBlocksAtSeams(
  image: Pixels,
  grid: GridGeometry,
  blocks: CourseBlock[],
): CourseBlock[] {
  const output: CourseBlock[] = []
  const inset = Math.max(5, Math.round(grid.columnWidth * 0.06))
  for (const block of blocks) {
    let start = block.startSection
    const left = Math.round(
      grid.left + (block.weekday - 1) * grid.columnWidth + inset,
    )
    const right = Math.round(left + grid.columnWidth - inset * 2)
    for (
      let section = block.startSection;
      section < block.endSection;
      section++
    ) {
      // The mobile timetable uses two-section cards for adjacent lessons. A
      // visible rule inside a three-section lesson can be a normal grid line,
      // so only accept seams that leave at least two sections on both sides.
      if (section - start + 1 < 2 || block.endSection - section < 2) continue
      const y = Math.round(grid.top + section * grid.rowHeight)
      const nearby = Math.min(
        horizontalLuma(image, left, right, y - 6),
        horizontalLuma(image, left, right, y + 6),
      )
      let boundary = 255
      for (let offset = -2; offset <= 2; offset++)
        boundary = Math.min(
          boundary,
          horizontalLuma(image, left, right, y + offset),
        )
      if (nearby - boundary < 4) continue
      output.push({ ...block, startSection: start, endSection: section })
      start = section + 1
    }
    output.push({ ...block, startSection: start })
  }
  return output
}

// Resolve only isolated I/II/III-shaped OCR tokens from their actual strokes.
// Reject curved, connected or mixed glyphs; never infer a course's level by name.
export function countRomanStrokes(
  image: Pixels,
  box: { x0: number; y0: number; x1: number; y1: number },
): number | undefined {
  const left = Math.max(0, Math.floor(box.x0)),
    right = Math.min(image.width, Math.ceil(box.x1))
  const top = Math.max(0, Math.floor(box.y0)),
    bottom = Math.min(image.height, Math.ceil(box.y1))
  const columns: { count: number; top: number; bottom: number }[] = []
  let firstY = bottom,
    lastY = top,
    total = 0
  for (let x = left; x < right; x++) {
    const column = { count: 0, top: bottom, bottom: top }
    for (let y = top; y < bottom; y++)
      if (luma(image, x, y) < 128) {
        column.count++
        column.top = Math.min(column.top, y)
        column.bottom = y
        firstY = Math.min(firstY, y)
        lastY = Math.max(lastY, y)
        total++
      }
    columns.push(column)
  }
  const height = lastY - firstY + 1
  if (height < 10) return undefined
  // Serif Roman numerals may share top/bottom caps (and be read as 工).
  // Count stems in the middle of the glyph, excluding those caps.
  const middleTop = firstY + Math.ceil(height * 0.18)
  const middleBottom = lastY - Math.ceil(height * 0.18)
  const middleHeight = middleBottom - middleTop + 1
  total = 0
  for (let x = left; x < right; x++) {
    const column = columns[x - left]
    column.count = 0
    for (let y = middleTop; y <= middleBottom; y++)
      if (luma(image, x, y) < 128) {
        column.count++
        total++
      }
  }
  let strokes = 0,
    covered = 0
  for (let x = 0; x < columns.length; x++) {
    if (columns[x].count < middleHeight * 0.75) continue
    const start = x
    while (x < columns.length && columns[x].count >= middleHeight * 0.75) {
      covered += columns[x].count
      x++
    }
    if (x - start > height * 0.25) return undefined
    strokes++
  }
  return strokes >= 1 && strokes <= 3 && covered >= total * 0.9
    ? strokes
    : undefined
}
