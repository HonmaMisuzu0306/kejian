import { describe, expect, it } from 'vitest'
import {
  dateForWeek,
  dayIndex,
  formatWeeks,
  isMonday,
  nextClass,
  parseWeeks,
  weekForDate,
} from './calendar'
import { newCourse } from './courses'

describe('教学周与自然日期', () => {
  it('参考截图第三周从 2026-09-14 开始', () => {
    expect(dateForWeek('2026-08-31', 3)).toBe('2026-09-14')
    expect(weekForDate('2026-08-31', '2026-09-20')).toBe(3)
    expect(weekForDate('2026-08-31', '2026-09-21')).toBe(4)
  })
  it('学期开始前不被错误归为第一周', () =>
    expect(weekForDate('2026-08-31', '2026-08-30')).toBe(0))
  it('跨年、闰日和 DST 周不改变日期间隔', () => {
    expect(dateForWeek('2026-12-28', 2)).toBe('2027-01-04')
    expect(dateForWeek('2024-02-26', 1, 4)).toBe('2024-02-29')
    expect(dateForWeek('2026-03-02', 2)).toBe('2026-03-09')
  })
  it('拒绝无效日期并确认周一起点', () => {
    expect(() => dayIndex('2026-02-30')).toThrow()
    expect(isMonday('2026-08-31')).toBe(true)
    expect(isMonday('2026-09-01')).toBe(false)
  })
  it('支持离散周次、范围、中文分隔符及去重', () => {
    expect(parseWeeks('1，3,5-7,6', 20)).toEqual([1, 3, 5, 6, 7])
    expect(formatWeeks([7, 1, 5, 6, 3, 5])).toBe('1,3,5-7')
  })
  it.each(['', '0', '21', '8-2', '1-999999', '1,,2', 'abc'])(
    '拒绝非法周次 %s',
    (s) => expect(() => parseWeeks(s, 20)).toThrow(),
  )
  it('下一节课程尊重离散周次并跳过已开始课程', () => {
    const semester = {
      id: 's',
      name: '学期',
      startDate: '2026-08-31',
      totalWeeks: 20,
    }
    const c = {
      ...newCourse('s'),
      name: '数学',
      meetings: [
        { weekday: 1 as const, startSection: 1, endSection: 2, weeks: [3, 5] },
      ],
    }
    const next = nextClass([c], semester, new Date('2026-09-14T09:00:00'))
    expect(next?.date).toBe('2026-09-28')
  })
})
