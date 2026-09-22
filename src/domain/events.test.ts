import { describe, expect, it } from 'vitest'
import {
  assignTimeLanes,
  detectScheduleConflicts,
  eventErrors,
  eventsOnDate,
  newScheduleEvent,
} from './events'
import { newCourse } from './courses'
import type { ScheduleEvent } from './types'

const semester = {
  id: 's',
  name: '学期',
  startDate: '2026-08-31',
  totalWeeks: 20,
}

const event = (
  title: string,
  startTime: string,
  endTime: string,
  extra: Partial<ScheduleEvent> = {},
): ScheduleEvent => ({
  ...newScheduleEvent('2026-09-14', startTime),
  title,
  endTime,
  ...extra,
})

describe('个人日程规则', () => {
  it('校验标题、时间格式、范围和结束顺序', () => {
    expect(eventErrors(event('', '09:00', '08:00'))).toEqual([
      '请填写日程标题',
      '结束时间必须晚于开始时间',
    ])
    expect(
      eventErrors(event('早餐', '06:00', '06:30', { startTime: '05:30' })),
    ).toContain('日程时间应在 06:00–23:59 之间')
  })

  it('按开始和结束时间排序当天日程', () => {
    const values = [
      event('晚', '10:00', '11:00'),
      event('早', '08:00', '09:00'),
      event('短', '10:00', '10:30'),
    ]
    expect(eventsOnDate(values, '2026-09-14').map((v) => v.title)).toEqual([
      '早',
      '短',
      '晚',
    ])
  })

  it('检测日程之间的重叠，但不把首尾相接视为冲突', () => {
    const a = event('阅读', '09:00', '10:00')
    const b = event('跑步', '09:30', '10:30')
    const c = event('午饭', '10:30', '11:30')
    expect(detectScheduleConflicts([a, b, c], [], semester)).toHaveLength(1)
  })

  it('检测个人日程与课程的实际时间冲突', () => {
    const course = {
      ...newCourse('s', 3),
      name: '数据结构',
      meetings: [
        { weekday: 1 as const, startSection: 3, endSection: 4, weeks: [3] },
      ],
    }
    expect(
      detectScheduleConflicts(
        [event('小组讨论', '10:30', '12:00')],
        [course],
        semester,
      )[0].message,
    ).toContain('数据结构')
    expect(
      detectScheduleConflicts(
        [event('午饭', '11:50', '12:30')],
        [course],
        semester,
      ),
    ).toHaveLength(0)
  })

  it('为链式重叠块分配一致的并排列数', () => {
    const lanes = assignTimeLanes([
      { id: 'a', startMinute: 540, endMinute: 600 },
      { id: 'b', startMinute: 570, endMinute: 630 },
      { id: 'c', startMinute: 620, endMinute: 660 },
    ])
    expect(lanes.get('a')).toEqual({ lane: 0, count: 2 })
    expect(lanes.get('b')).toEqual({ lane: 1, count: 2 })
    expect(lanes.get('c')?.count).toBe(2)
  })
})
