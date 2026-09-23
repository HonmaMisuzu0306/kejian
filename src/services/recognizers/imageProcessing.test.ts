import { describe, expect, it } from 'vitest'
import {
  countRomanStrokes,
  detectGrid,
  enhanceText,
  proportionalNuistGrid,
  splitCourseBlocksAtSeams,
  type Pixels,
} from './imageProcessing'

function paper(width: number, height: number): Pixels {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4).fill(255),
  }
}
function rectangle(
  image: Pixels,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
) {
  for (let row = y; row < y + h; row++)
    for (let col = x; col < x + w; col++) {
      const offset = (row * image.width + col) * 4
      image.data[offset] =
        image.data[offset + 1] =
        image.data[offset + 2] =
          color
    }
}

describe('课表像素定位与文字增强', () => {
  it.each([0, 30])(
    '从真实线条定位网格，适应顶部偏移 %i px 和缺失的奇数行线',
    (offset) => {
      const image = paper(800, 1800)
      for (let col = 0; col <= 6; col++)
        rectangle(image, 84 + col * 102, 450 + offset, 2, 1211, 220)
      for (const row of [0, 2, 4, 6, 8, 10, 11])
        rectangle(image, 84, 450 + offset + row * 110, 716, 2, 236)
      // Header separators must not shift the grid up by a teaching section.
      rectangle(image, 84, 340 + offset, 716, 2, 236)
      const grid = detectGrid(image)
      expect(grid).toBeDefined()
      expect(grid!.top).toBeCloseTo(450 + offset, 0)
      expect(grid!.left).toBeCloseTo(84, 0)
      expect(grid!.rowHeight).toBeCloseTo(110, 0)
    },
  )

  it('底部第11节边线被屏幕裁切时仍通过周末空列计算动态行高', () => {
    const image = paper(1080, 2400)
    const left = 113
    const columnWidth = 138.33
    for (let col = 0; col <= 7; col++)
      rectangle(image, Math.round(left + col * columnWidth), 624, 2, 1776, 220)
    for (const row of [0, 2, 4, 6, 8, 10])
      rectangle(image, left, 624 + row * 161, 967, 2, 236)
    const grid = detectGrid(image)
    expect(grid).toBeDefined()
    expect(grid!.top).toBeCloseTo(624, 0)
    expect(grid!.rowHeight).toBeCloseTo(161, 0)
  })

  it('没有有效网格时拒绝猜测坐标', () => {
    expect(detectGrid(paper(800, 1800))).toBeUndefined()
  })

  it('按已适配版式提供与原图校准一致的回退网格', () => {
    expect(proportionalNuistGrid(1080, 2400)).toEqual({
      left: 113,
      top: 624,
      columnWidth: 138.3333333333,
      rowHeight: 149.1818181818,
    })
  })

  it('将浅色文字变深，同时将同色面板变白', () => {
    const image = paper(2, 1)
    image.data.set([249, 246, 239, 255, 230, 192, 116, 255])
    const enhanced = enhanceText(image, { r: 249, g: 246, b: 239 })
    expect(enhanced[0]).toBe(255)
    expect(enhanced[4]).toBe(0)
  })

  it('将深色选中课程中的白字转换为黑字', () => {
    const image = paper(2, 1)
    image.data.set([80, 120, 210, 255, 250, 250, 250, 255])
    const enhanced = enhanceText(image, { r: 80, g: 120, b: 210 })
    expect(enhanced[0]).toBe(255)
    expect(enhanced[4]).toBe(0)
  })

  it('通过可见横线拆开相邻同色课程，不拆开连续节次内部', () => {
    const image = paper(200, 500)
    rectangle(image, 20, 20, 100, 400, 240)
    rectangle(image, 20, 220, 100, 2, 225)
    const blocks = splitCourseBlocksAtSeams(
      image,
      { left: 20, top: 20, columnWidth: 100, rowHeight: 100 },
      [
        {
          weekday: 1,
          startSection: 1,
          endSection: 4,
          color: { r: 240, g: 240, b: 240 },
        },
      ],
    )
    expect(
      blocks.map(({ startSection, endSection }) => [startSection, endSection]),
    ).toEqual([
      [1, 2],
      [3, 4],
    ])
  })

  it.each([1, 2, 3])('通过图像中的 %i 根笔画保留罗马数字级别', (count) => {
    const image = paper(40, 40)
    for (let i = 0; i < count; i++) rectangle(image, 8 + i * 8, 7, 3, 26, 0)
    expect(countRomanStrokes(image, { x0: 0, y0: 0, x1: 40, y1: 40 })).toBe(
      count,
    )
  })

  it('相连的字形不能被当成罗马数字', () => {
    const image = paper(40, 40)
    rectangle(image, 5, 5, 3, 30, 0)
    rectangle(image, 25, 5, 3, 30, 0)
    rectangle(image, 5, 18, 23, 4, 0)
    expect(
      countRomanStrokes(image, { x0: 0, y0: 0, x1: 40, y1: 40 }),
    ).toBeUndefined()
  })

  it('衬线字体Ⅱ的顶部和底部横线不合并竖向笔画', () => {
    const image = paper(40, 40)
    rectangle(image, 12, 5, 3, 30, 0)
    rectangle(image, 23, 5, 3, 30, 0)
    rectangle(image, 8, 5, 22, 3, 0)
    rectangle(image, 8, 32, 22, 3, 0)
    expect(countRomanStrokes(image, { x0: 0, y0: 0, x1: 40, y1: 40 })).toBe(2)
  })
})
