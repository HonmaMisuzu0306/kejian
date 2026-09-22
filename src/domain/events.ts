import { coursesOnDate, dayIndex, localISO, sections } from './calendar'
import { createId } from './id'
import type { Course, ScheduleEvent, Semester } from './types'

export const eventPalette = [
  '#2f8069',
  '#4c6f9c',
  '#8a5b77',
  '#927039',
  '#5f7250',
  '#53666e',
]

export const AGENDA_START_MINUTE = 6 * 60
export const AGENDA_END_MINUTE = 24 * 60

export function minutesFromTime(time: string): number {
  const match = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  if (!match) throw new Error('时间格式应为 HH:mm')
  return Number(match[1]) * 60 + Number(match[2])
}

export function timeFromMinutes(minutes: number): string {
  const value = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)))
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

export function newScheduleEvent(
  date = localISO(),
  startTime = '09:00',
): ScheduleEvent {
  const now = new Date().toISOString()
  const start = Math.max(
    AGENDA_START_MINUTE,
    Math.min(23 * 60 + 30, minutesFromTime(startTime)),
  )
  return {
    id: createId(),
    title: '',
    date,
    startTime: timeFromMinutes(start),
    endTime: timeFromMinutes(Math.min(23 * 60 + 59, start + 60)),
    color: eventPalette[0],
    createdAt: now,
    updatedAt: now,
  }
}

export function eventErrors(event: ScheduleEvent): string[] {
  const errors: string[] = []
  if (!event.title.trim()) errors.push('请填写日程标题')
  try {
    dayIndex(event.date)
  } catch {
    errors.push('请选择有效日期')
  }
  try {
    const start = minutesFromTime(event.startTime)
    const end = minutesFromTime(event.endTime)
    if (start < AGENDA_START_MINUTE || end >= AGENDA_END_MINUTE)
      errors.push('日程时间应在 06:00–23:59 之间')
    if (end <= start) errors.push('结束时间必须晚于开始时间')
  } catch {
    errors.push('请填写有效的开始和结束时间')
  }
  if (!/^#[0-9a-f]{6}$/i.test(event.color)) errors.push('日程颜色无效')
  return [...new Set(errors)]
}

export function eventsOnDate(events: ScheduleEvent[], date: string) {
  return events
    .filter((event) => event.date === date)
    .sort(
      (a, b) =>
        minutesFromTime(a.startTime) - minutesFromTime(b.startTime) ||
        minutesFromTime(a.endTime) - minutesFromTime(b.endTime) ||
        a.title.localeCompare(b.title, 'zh-CN'),
    )
}

export function nextScheduleEvent(events: ScheduleEvent[], now: Date) {
  const timestamp = now.getTime()
  return events
    .map((event) => ({
      event,
      start: new Date(`${event.date}T${event.startTime}:00`),
    }))
    .filter(({ start }) => start.getTime() >= timestamp)
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0]
}

export type ScheduleConflict = {
  key: string
  date: string
  eventIds: string[]
  courseId?: string
  message: string
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd

export function detectScheduleConflicts(
  events: ScheduleEvent[],
  courses: Course[],
  semester: Semester,
  onlyDate?: string,
): ScheduleConflict[] {
  const relevant = onlyDate
    ? eventsOnDate(events, onlyDate)
    : [...events].sort((a, b) => a.date.localeCompare(b.date))
  const result: ScheduleConflict[] = []
  for (let i = 0; i < relevant.length; i++) {
    const a = relevant[i]
    const aStart = minutesFromTime(a.startTime)
    const aEnd = minutesFromTime(a.endTime)
    for (let j = i + 1; j < relevant.length; j++) {
      const b = relevant[j]
      if (a.date !== b.date) continue
      if (
        overlaps(
          aStart,
          aEnd,
          minutesFromTime(b.startTime),
          minutesFromTime(b.endTime),
        )
      )
        result.push({
          key: `event:${a.id}:${b.id}`,
          date: a.date,
          eventIds: [a.id, b.id],
          message: `${a.title} 与 ${b.title} 的时间重叠`,
        })
    }
    for (const { course, meeting } of coursesOnDate(
      courses,
      semester,
      a.date,
    )) {
      const start = minutesFromTime(sections[meeting.startSection - 1][0])
      const end = minutesFromTime(sections[meeting.endSection - 1][1])
      if (overlaps(aStart, aEnd, start, end))
        result.push({
          key: `course:${a.id}:${course.id}:${meeting.startSection}`,
          date: a.date,
          eventIds: [a.id],
          courseId: course.id,
          message: `${a.title} 与课程“${course.name}”的时间重叠`,
        })
    }
  }
  return result
}

export type TimeBlock = {
  id: string
  startMinute: number
  endMinute: number
}

export function assignTimeLanes(blocks: TimeBlock[]) {
  const result = new Map<string, { lane: number; count: number }>()
  const sorted = [...blocks].sort(
    (a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute,
  )
  let index = 0
  while (index < sorted.length) {
    const group: TimeBlock[] = [sorted[index++]]
    let groupEnd = group[0].endMinute
    while (index < sorted.length && sorted[index].startMinute < groupEnd) {
      group.push(sorted[index])
      groupEnd = Math.max(groupEnd, sorted[index].endMinute)
      index++
    }
    const laneEnds: number[] = []
    const assignments: { block: TimeBlock; lane: number }[] = []
    for (const block of group) {
      let lane = laneEnds.findIndex((end) => end <= block.startMinute)
      if (lane < 0) lane = laneEnds.length
      laneEnds[lane] = block.endMinute
      assignments.push({ block, lane })
    }
    for (const { block, lane } of assignments)
      result.set(block.id, { lane, count: laneEnds.length })
  }
  return result
}
