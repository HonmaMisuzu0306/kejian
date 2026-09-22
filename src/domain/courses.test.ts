import { describe, expect, it } from 'vitest'
import {
  courseErrors,
  detectConflicts,
  importCourses,
  mergeCourses,
  newCourse,
  undoLatestImport,
} from './courses'
import type { AppState, Course } from './types'

const semester = {
  id: 's',
  name: '学期',
  startDate: '2026-08-31',
  totalWeeks: 20,
}
const state = (): AppState => ({
  version: 2,
  semesters: [semester],
  activeSemesterId: 's',
  courses: [],
  batches: [],
  events: [],
})
const course = (weeks = [3], extra: Partial<Course> = {}): Course => ({
  ...newCourse('s'),
  name: '数据结构',
  location: 'C401',
  meetings: [{ weekday: 1, startSection: 3, endSection: 4, weeks }],
  ...extra,
})
describe('合并与冲突检测', () => {
  it('相同课程合并去重周次且不修改原数组', () => {
    const a = course()
    const before = JSON.stringify(a)
    const result = mergeCourses([a], [course([3, 5])])
    expect(result).toHaveLength(1)
    expect(result[0].meetings[0].weeks).toEqual([3, 5])
    expect(JSON.stringify(a)).toBe(before)
  })
  it('同一课程不同上课安排保持独立', () => {
    const a = course()
    const b = course()
    b.meetings[0].weekday = 3
    expect(mergeCourses([a], [b])[0].meetings).toHaveLength(2)
  })
  it('不同教室、教师或学期不被错误合并', () => {
    expect(
      mergeCourses(
        [course()],
        [
          course([3], { location: 'C402' }),
          course([3], { teacher: '王老师' }),
          course([3], { semesterId: 'other' }),
        ],
      ),
    ).toHaveLength(4)
  })
  it('OCR 未识别出名称的课程块保持独立，等待逐条校对', () => {
    const monday = course([3], { name: '' })
    const tuesday = course([3], { name: '' })
    tuesday.meetings[0].weekday = 2
    expect(mergeCourses([], [monday, tuesday])).toHaveLength(2)
  })
  it('仅重叠周、日、节次产生冲突', () => {
    const a = course()
    const b = course([3], { name: '数学' })
    expect(detectConflicts([a, b])).toHaveLength(1)
    b.meetings[0].weeks = [4]
    expect(detectConflicts([a, b])).toHaveLength(0)
    b.meetings[0].weeks = [3]
    b.meetings[0].startSection = 5
    b.meetings[0].endSection = 6
    expect(detectConflicts([a, b])).toHaveLength(0)
  })
  it('不同学期、星期无冲突，端点节次重叠有冲突', () => {
    const a = course()
    const b = course([3], { name: '数学', semesterId: 'other' })
    expect(detectConflicts([a, b])).toHaveLength(0)
    b.semesterId = 's'
    b.meetings[0].weekday = 2
    expect(detectConflicts([a, b])).toHaveLength(0)
    b.meetings[0].weekday = 1
    b.meetings[0].startSection = 4
    b.meetings[0].endSection = 5
    expect(detectConflicts([a, b])).toHaveLength(1)
  })
  it('同一课程内部重叠安排也会告警', () => {
    const a = course()
    a.meetings.push({ ...a.meetings[0], startSection: 4, endSection: 5 })
    expect(detectConflicts([a])).toHaveLength(1)
  })
  it('缺失名称、倒序节次和非法周次阻止保存', () => {
    const a = course([], { name: '' })
    a.meetings[0].endSection = 1
    expect(courseErrors(a, semester)).toHaveLength(3)
  })
})
describe('导入事务与撤销', () => {
  it('完全重复导入不添加批次，撤销仍指向最后一次实际变更', () => {
    const first = importCourses(state(), [course()], ['a.png'])
    const second = importCourses(first.state, [course()], ['a.png'])
    expect(second.state.batches).toHaveLength(1)
    expect(second.skipped).toBe(1)
    expect(undoLatestImport(second.state).courses).toHaveLength(0)
  })
  it('撤销更新时恢复原周次，同时删除本批新增课程', () => {
    const initial = state()
    initial.courses = [course([1])]
    const result = importCourses(
      initial,
      [course([3]), course([3], { name: '数学' })],
      ['a.png'],
    )
    expect(result.added).toBe(1)
    expect(result.updated).toBe(1)
    const undone = undoLatestImport(result.state)
    expect(undone.courses).toEqual(initial.courses)
    expect(undone.batches[0].undoneAt).toBeTruthy()
  })
  it('撤销保护导入后的编辑，但不阻塞无关编辑', () => {
    const imported = importCourses(state(), [course()], ['a.png']).state
    const unrelated = course([3], { name: '手工新增' })
    expect(
      undoLatestImport({
        ...imported,
        courses: [...imported.courses, unrelated],
      }).courses,
    ).toEqual([unrelated])
    imported.courses[0].name = '编辑后的课程'
    expect(() => undoLatestImport(imported)).toThrow('已被编辑')
  })
  it('非法数据在写入前被拒绝', () =>
    expect(() => importCourses(state(), [course([99])], ['a.png'])).toThrow())
})
