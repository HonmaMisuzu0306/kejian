import { courseErrors } from '../domain/courses'
import { isMonday } from '../domain/calendar'
import type { AppState, Semester } from '../domain/types'

export const STORAGE_KEY = 'kejian.app.v1'
export const emptyState = (): AppState => ({
  version: 1,
  semesters: [],
  activeSemesterId: '',
  courses: [],
  batches: [],
})
export function validateState(value: unknown): AppState {
  const s = value as AppState
  if (
    !s ||
    s.version !== 1 ||
    !Array.isArray(s.semesters) ||
    !Array.isArray(s.courses) ||
    !Array.isArray(s.batches)
  )
    throw new Error('本地数据格式不兼容')
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
