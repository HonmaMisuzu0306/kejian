import type { Course, CourseMeeting, Semester } from './types'

export const weekdays = ['一', '二', '三', '四', '五', '六', '日']
export const sections = [
  ['08:00', '08:45'],
  ['08:55', '09:40'],
  ['10:10', '10:55'],
  ['11:05', '11:50'],
  ['13:45', '14:30'],
  ['14:40', '15:25'],
  ['15:55', '16:40'],
  ['16:50', '17:35'],
  ['18:45', '19:30'],
  ['19:40', '20:25'],
  ['20:35', '21:20'],
]
// Calendar arithmetic uses UTC day indices, avoiding daylight-saving and UTC parsing shifts.
const DAY = 86_400_000
export function dayIndex(iso: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso))
    throw new Error('日期格式应为 YYYY-MM-DD')
  const time = Date.parse(`${iso}T00:00:00Z`)
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== iso
  )
    throw new Error('日期无效')
  return time / DAY
}
export function localISO(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function dateForWeek(
  startDate: string,
  week: number,
  weekday = 1,
): string {
  return new Date((dayIndex(startDate) + (week - 1) * 7 + weekday - 1) * DAY)
    .toISOString()
    .slice(0, 10)
}
export function weekForDate(startDate: string, date: string): number {
  return Math.floor((dayIndex(date) - dayIndex(startDate)) / 7) + 1
}
export function isMonday(date: string): boolean {
  try {
    return new Date(dayIndex(date) * DAY).getUTCDay() === 1
  } catch {
    return false
  }
}
export function weekdayOf(date: string): number {
  return new Date(dayIndex(date) * DAY).getUTCDay() || 7
}
export function shiftDate(date: string, days: number): string {
  return new Date((dayIndex(date) + days) * DAY).toISOString().slice(0, 10)
}
export function parseWeeks(input: string, max: number): number[] {
  if (!input.trim()) throw new Error('请填写上课周次')
  const result = new Set<number>()
  for (const token of input
    .replaceAll('，', ',')
    .replaceAll('、', ',')
    .split(',')) {
    const match = token.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!match) throw new Error('周次请填写 1,3,5-8 这样的格式')
    const first = Number(match[1])
    const last = Number(match[2] ?? match[1])
    if (first < 1 || last > max || last < first)
      throw new Error(`周次应在 1–${max} 之间，范围不能倒序`)
    for (let i = first; i <= last; i++) result.add(i)
  }
  return [...result].sort((a, b) => a - b)
}
export function formatWeeks(weeks: number[]): string {
  const values = [...new Set(weeks)].sort((a, b) => a - b)
  const parts: string[] = []
  for (let i = 0; i < values.length; i++) {
    const start = values[i]
    let end = start
    while (values[i + 1] === end + 1) end = values[++i]
    parts.push(start === end ? `${start}` : `${start}-${end}`)
  }
  return parts.join(',')
}
export function meetingTime(meeting: CourseMeeting): string {
  return `${sections[meeting.startSection - 1][0]}–${sections[meeting.endSection - 1][1]}`
}
export function coursesOnDate(
  courses: Course[],
  semester: Semester,
  date: string,
) {
  const week = weekForDate(semester.startDate, date)
  if (week < 1 || week > semester.totalWeeks) return []
  return courses
    .filter((c) => c.semesterId === semester.id)
    .flatMap((course) =>
      course.meetings
        .filter((m) => m.weekday === weekdayOf(date) && m.weeks.includes(week))
        .map((meeting) => ({ course, meeting })),
    )
    .sort((a, b) => a.meeting.startSection - b.meeting.startSection)
}
export function localDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`)
}
export function nextClass(courses: Course[], semester: Semester, now: Date) {
  const today = localISO(now)
  const first = Math.max(dayIndex(today), dayIndex(semester.startDate))
  const end = dayIndex(semester.startDate) + semester.totalWeeks * 7
  for (let day = first; day < end; day++) {
    const date = new Date(day * DAY).toISOString().slice(0, 10)
    for (const item of coursesOnDate(courses, semester, date)) {
      const start = localDateTime(
        date,
        sections[item.meeting.startSection - 1][0],
      )
      if (start.getTime() >= now.getTime()) return { ...item, date, start }
    }
  }
  return null
}
