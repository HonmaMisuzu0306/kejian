import { formatWeeks } from './calendar'
import { createId } from './id'
import type { AppState, Course, ImportBatch, Semester } from './types'

export const palette = [
  '#376e61',
  '#59658f',
  '#39768a',
  '#9a6b36',
  '#8a5364',
  '#627548',
]
export function colorFor(name: string): string {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return palette[Math.abs(hash) % palette.length]
}
export function newCourse(semesterId: string, week = 1): Course {
  const now = new Date().toISOString()
  return {
    id: createId(),
    semesterId,
    name: '',
    color: palette[0],
    meetings: [{ weekday: 1, startSection: 1, endSection: 2, weeks: [week] }],
    createdAt: now,
    updatedAt: now,
  }
}
const clean = (text = '') => text.trim().replace(/\s+/g, ' ')
function identity(c: Course) {
  return JSON.stringify([
    c.semesterId,
    clean(c.name),
    clean(c.teacher),
    clean(c.location),
  ])
}
function slot(m: Course['meetings'][number]) {
  return `${m.weekday}:${m.startSection}:${m.endSection}`
}
export function mergeCourses(existing: Course[], incoming: Course[]): Course[] {
  const result = structuredClone(existing)
  for (const input of incoming) {
    const course = structuredClone(input)
    course.name = clean(course.name)
    course.location = clean(course.location)
    course.teacher = clean(course.teacher)
    const found = course.name
      ? result.find((c) => identity(c) === identity(course))
      : undefined
    if (!found) {
      course.meetings = normalizeMeetings(course.meetings)
      result.push(course)
      continue
    }
    const meetings = normalizeMeetings([...found.meetings, ...course.meetings])
    if (JSON.stringify(meetings) !== JSON.stringify(found.meetings)) {
      found.meetings = meetings
      found.updatedAt = course.updatedAt
    }
  }
  return result
}
function normalizeMeetings(meetings: Course['meetings']) {
  const map = new Map<string, Course['meetings'][number]>()
  for (const meeting of meetings) {
    const key = slot(meeting)
    const previous = map.get(key)
    map.set(key, {
      ...meeting,
      weeks: [...new Set([...(previous?.weeks ?? []), ...meeting.weeks])].sort(
        (a, b) => a - b,
      ),
    })
  }
  return [...map.values()].sort(
    (a, b) =>
      a.weekday - b.weekday ||
      a.startSection - b.startSection ||
      a.endSection - b.endSection,
  )
}
export function courseErrors(c: Course, semester: Semester): string[] {
  const errors: string[] = []
  if (!c.name.trim()) errors.push('缺少课程名称')
  if (c.semesterId !== semester.id) errors.push('学期不匹配')
  if (!/^#[0-9a-f]{6}$/i.test(c.color)) errors.push('颜色无效')
  if (!c.meetings.length) errors.push('至少需要一条上课安排')
  for (const m of c.meetings) {
    if (!Number.isInteger(m.weekday) || m.weekday < 1 || m.weekday > 7)
      errors.push('星期应为周一至周日')
    if (
      !Number.isInteger(m.startSection) ||
      !Number.isInteger(m.endSection) ||
      m.startSection < 1 ||
      m.endSection > 11 ||
      m.endSection < m.startSection
    )
      errors.push('节次应在 1–11 之间且结束不能早于开始')
    if (
      !m.weeks.length ||
      m.weeks.some(
        (w) => !Number.isInteger(w) || w < 1 || w > semester.totalWeeks,
      )
    )
      errors.push('请检查上课周次')
  }
  return [...new Set(errors)]
}
export type Conflict = { a: string; b: string; message: string }
export function detectConflicts(courses: Course[]): Conflict[] {
  const entries = courses.flatMap((c) => c.meetings.map((m) => ({ c, m })))
  const result: Conflict[] = []
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]
      const b = entries[j]
      if (
        a.c.semesterId !== b.c.semesterId ||
        a.m.weekday !== b.m.weekday ||
        a.m.endSection < b.m.startSection ||
        b.m.endSection < a.m.startSection
      )
        continue
      const weeks = a.m.weeks.filter((w) => b.m.weeks.includes(w))
      if (weeks.length)
        result.push({
          a: a.c.id,
          b: b.c.id,
          message: `${a.c.name || '未命名课程'} 与 ${b.c.name || '未命名课程'} 在第 ${formatWeeks(weeks)} 周存在时间重叠`,
        })
    }
  return result
}
export function importCourses(
  state: AppState,
  drafts: Course[],
  imageNames: string[],
  sourceKind:
    'screenshot-demo' | 'screenshot-local-ocr' = 'screenshot-local-ocr',
): { state: AppState; added: number; updated: number; skipped: number } {
  for (const course of drafts) {
    const semester = state.semesters.find((s) => s.id === course.semesterId)
    if (!semester || courseErrors(course, semester).length)
      throw new Error('请先修正课程中的错误')
  }
  const batchId = createId()
  const source = { kind: sourceKind, batchId, imageNames }
  const merged = mergeCourses(
    state.courses,
    drafts.map((c) => ({ ...c, source })),
  )
  const changes: ImportBatch['changes'] = []
  for (const after of merged) {
    const before = state.courses.find((c) => c.id === after.id) ?? null
    if (JSON.stringify(before) !== JSON.stringify(after))
      changes.push(structuredClone({ before, after }))
  }
  const added = changes.filter((c) => !c.before).length
  const updated = changes.length - added
  const skipped = Math.max(0, mergeCourses([], drafts).length - changes.length)
  if (!changes.length) return { state, added, updated, skipped }
  const batch: ImportBatch = {
    id: batchId,
    createdAt: new Date().toISOString(),
    imageNames,
    importedCourseIds: changes.map((c) => c.after.id),
    changes,
  }
  return {
    state: { ...state, courses: merged, batches: [...state.batches, batch] },
    added,
    updated,
    skipped,
  }
}
export function undoLatestImport(state: AppState): AppState {
  const batch = state.batches.findLast((b) => !b.undoneAt)
  if (!batch) throw new Error('暂无可以撤销的导入')
  for (const change of batch.changes) {
    const current = state.courses.find((c) => c.id === change.after.id)
    if (JSON.stringify(current) !== JSON.stringify(change.after))
      throw new Error(
        '这次导入的课程已被编辑或删除。为保留你的修改，无法直接撤销。',
      )
  }
  const ids = new Set(batch.importedCourseIds)
  return {
    ...state,
    courses: [
      ...state.courses.filter((c) => !ids.has(c.id)),
      ...batch.changes.flatMap((c) => (c.before ? [c.before] : [])),
    ],
    batches: state.batches.map((b) =>
      b.id === batch.id ? { ...b, undoneAt: new Date().toISOString() } : b,
    ),
  }
}
