import { describe, expect, it } from 'vitest'
import {
  detectCourseBlocks,
  isSupportedNuistScreenshot,
  parseRecognizedCourse,
  type CellColor,
} from './nuistLayout'

const empty = (): CellColor[][] =>
  Array.from({ length: 11 }, () =>
    Array.from({ length: 7 }, () => ({ r: 249, g: 250, b: 252 })),
  )

describe('南信大移动课表版式', () => {
  it('把同色连续节次合并，同时分开紧邻的另一门课', () => {
    const cells = empty()
    cells[0][4] = { r: 237, g: 244, b: 252 }
    cells[1][4] = { r: 237, g: 244, b: 252 }
    cells[2][4] = { r: 237, g: 246, b: 251 }
    cells[3][4] = { r: 237, g: 246, b: 251 }
    expect(detectCourseBlocks(cells)).toEqual([
      {
        weekday: 5,
        startSection: 1,
        endSection: 2,
        color: { r: 237, g: 244, b: 252 },
      },
      {
        weekday: 5,
        startSection: 3,
        endSection: 4,
        color: { r: 237, g: 246, b: 251 },
      },
    ])
  })

  it('从分行 OCR 文字中拆出课程名和教室并纠正常见楼名误识别', () => {
    expect(parseRecognizedCourse('电子技术基础\n扩江楼C\n303')).toEqual({
      name: '电子技术基础',
      location: '揽江楼C303',
    })
    expect(parseRecognizedCourse('大学物理Ⅱ（2）\n阅江楼222')).toEqual({
      name: '大学物理Ⅱ（2）',
      location: '阅江楼222',
    })
  })

  it('只接受当前适配的竖屏截图范围', () => {
    expect(isSupportedNuistScreenshot(1080, 2400)).toBe(true)
    expect(isSupportedNuistScreenshot(2400, 1080)).toBe(false)
    expect(isSupportedNuistScreenshot(390, 844)).toBe(false)
  })
})
