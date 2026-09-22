import { courseErrors } from '../domain/courses'
import { isMonday } from '../domain/calendar'
import { eventErrors } from '../domain/events'
import type { AppState, ScheduleEvent, Semester } from '../domain/types'

export const STORAGE_KEY = 'kejian.app.v1'
export const emptyState = (): AppState => ({
  version: 2,
  semesters: [],
  activeSemesterId: '',
  courses: [],
  batches: [],
  events: [],
})
export function validateState(value: unknown): AppState {
  const input = value as Partial<AppState> & { version?: number }
  if (
    !input ||
    ![1, 2].includes(input.version ?? 0) ||
    !Array.isArray(input.semesters) ||
    !Array.isArray(input.courses) ||
    !Array.isArray(input.batches)
  )
    throw new Error('本地数据格式不兼容')
  const s: AppState = {
    version: 2,
    semesters: input.semesters,
    activeSemesterId: input.activeSemesterId ?? '',
    courses: input.courses,
    batches: input.batches,
    events: Array.isArray(input.events) ? input.events : [],
  }
  const validSemester = (v: Semester) =>
    v &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    v.name.trim() &&
    isMonday(v.startDate) &&
    Number.isInteger(v.totalWeeks) &&
    v.totalWeeks >= 1 &&
    v.totalWeeks <= 52
  if (
    !s.semesters.every(validSemester) ||
    (s.semesters.length &&
      !s.semesters.some((v) => v.id === s.activeSemesterId))
  )
    throw new Error('学期数据无效')
  for (const c of s.courses) {
    const semester = s.semesters.find((v) => v.id === c.semesterId)
    if (
      !semester ||
      typeof c.id !== 'string' ||
      typeof c.name !== 'string' ||
      !Array.isArray(c.meetings) ||
      courseErrors(c, semester).length
    )
      throw new Error('课程数据无效')
  }
  if (
    !s.batches.every(
      (b) =>
        typeof b.id === 'string' &&
        Array.isArray(b.changes) &&
        Array.isArray(b.imageNames) &&
        Array.isArray(b.importedCourseIds) &&
        b.changes.every((c) => c.after && typeof c.after.id === 'string'),
    )
  )
    throw new Error('导入记录无效')
  if (
    !s.events.every(
      (event: ScheduleEvent) =>
        typeof event.id === 'string' &&
        typeof event.title === 'string' &&
        typeof event.date === 'string' &&
        typeof event.startTime === 'string' &&
        typeof event.endTime === 'string' &&
        typeof event.color === 'string' &&
        eventErrors(event).length === 0,
    )
  )
    throw new Error('个人日程数据无效')
  return s
}
export function loadState(): AppState {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? validateState(JSON.parse(raw)) : emptyState()
}
export function saveState(state: AppState): void {
  // Write before updating React state: quota/security errors cannot appear as a successful import.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
