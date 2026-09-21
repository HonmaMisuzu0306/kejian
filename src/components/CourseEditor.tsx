import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { courseErrors, palette } from '../domain/courses'
import { formatWeeks, parseWeeks, weekdays } from '../domain/calendar'
import type { Course, Semester, Weekday } from '../domain/types'
import { ConfirmDialog } from './ConfirmDialog'

export function CourseEditor({
  course,
  semesters,
  onSave,
  onClose,
  onDelete,
}: {
  course: Course
  semesters: Semester[]
  onSave: (course: Course) => void
  onClose: () => void
  onDelete?: () => void
}) {
  const [draft, setDraft] = useState(structuredClone(course))
  const [weeks, setWeeks] = useState(
    course.meetings.map((m) => formatWeeks(m.weeks)),
  )
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement | null
    const el = dialog.current
    el?.showModal()
    return () => {
      el?.close()
      returnFocus.current?.focus()
    }
  }, [])
  const semester = semesters.find((s) => s.id === draft.semesterId)!
  function submit(event: React.FormEvent) {
    event.preventDefault()
    try {
      const next = {
        ...draft,
        name: draft.name.trim(),
        meetings: draft.meetings.map((m, i) => ({
          ...m,
          weeks: parseWeeks(weeks[i], semester.totalWeeks),
        })),
        updatedAt: new Date().toISOString(),
      }
      const errors = courseErrors(next, semester)
      if (errors.length) throw new Error(errors.join('；'))
      onSave(next)
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <dialog
      ref={dialog}
      className="sheet"
      onCancel={onClose}
      aria-labelledby="editor-title"
    >
      <form onSubmit={submit}>
        <div className="sheet-heading">
          <div>
            <span className="eyebrow">COURSE DETAILS</span>
            <h2 id="editor-title">{course.name ? '编辑课程' : '添加课程'}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭编辑"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <label>
          课程名称 <span className="required">*</span>
          <input
            autoFocus
            value={draft.name}
            maxLength={80}
            placeholder="例如：数据结构"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            教室
            <input
              value={draft.location ?? ''}
              maxLength={80}
              placeholder="待补充"
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            />
          </label>
          <label>
            教师
            <input
              value={draft.teacher ?? ''}
              maxLength={50}
              placeholder="选填"
              onChange={(e) => setDraft({ ...draft, teacher: e.target.value })}
            />
          </label>
        </div>
        <label>课程颜色</label>
        <div className="color-row">
          {palette.map((color) => (
            <button
              type="button"
              key={color}
              className={`color-swatch ${draft.color === color ? 'selected' : ''}`}
              style={{ background: color }}
              aria-label={`选择颜色 ${color}`}
              aria-pressed={draft.color === color}
              onClick={() => setDraft({ ...draft, color })}
            />
          ))}
        </div>
        <div className="section-heading">
          <h3>上课安排</h3>
          <span>{semester.name}</span>
        </div>
        {draft.meetings.map((meeting, i) => (
          <fieldset key={i} className="meeting-fields">
            <legend>安排 {i + 1}</legend>
            <div className="form-grid thirds">
              <label>
                星期
                <select
                  aria-label={`安排${i + 1}星期`}
                  value={meeting.weekday}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      meetings: draft.meetings.map((m, j) =>
                        j === i
                          ? { ...m, weekday: Number(e.target.value) as Weekday }
                          : m,
                      ),
                    })
                  }
                >
                  {weekdays.map((d, j) => (
                    <option key={d} value={j + 1}>
                      周{d}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                开始节次
                <select
                  aria-label={`安排${i + 1}开始节次`}
                  value={meeting.startSection}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      meetings: draft.meetings.map((m, j) =>
                        j === i
                          ? { ...m, startSection: Number(e.target.value) }
                          : m,
                      ),
                    })
                  }
                >
                  {Array.from({ length: 11 }, (_, j) => (
                    <option key={j} value={j + 1}>
                      {j + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                结束节次
                <select
                  aria-label={`安排${i + 1}结束节次`}
                  value={meeting.endSection}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      meetings: draft.meetings.map((m, j) =>
                        j === i
                          ? { ...m, endSection: Number(e.target.value) }
                          : m,
                      ),
                    })
                  }
                >
                  {Array.from({ length: 11 }, (_, j) => (
                    <option key={j} value={j + 1}>
                      {j + 1}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              周次 <span className="required">*</span>
              <input
                aria-label={`安排${i + 1}周次`}
                value={weeks[i]}
                placeholder="例如 1,3,5-8"
                onChange={(e) =>
                  setWeeks(weeks.map((w, j) => (j === i ? e.target.value : w)))
                }
              />
            </label>
            <div className="field-help">可填写 1,3,5-8；仅在这些周上课。</div>
            {error.includes('周次') && (
              <div className="field-error">{error}</div>
            )}
            {draft.meetings.length > 1 && (
              <button
                type="button"
                className="text-button danger"
                onClick={() => {
                  setDraft({
                    ...draft,
                    meetings: draft.meetings.filter((_, j) => j !== i),
                  })
                  setWeeks(weeks.filter((_, j) => j !== i))
                }}
              >
                删除此安排
              </button>
            )}
          </fieldset>
        ))}
        <button
          type="button"
          className="secondary full"
          onClick={() => {
            setDraft({
              ...draft,
              meetings: [
                ...draft.meetings,
                { weekday: 1, startSection: 1, endSection: 2, weeks: [1] },
              ],
            })
            setWeeks([...weeks, '1'])
          }}
        >
          <Plus size={16} />
          添加上课安排
        </button>
        {error && (
          <div role="alert" className="notice error">
            {error}
          </div>
        )}
        <div className="sheet-footer">
          <button className="primary full" type="submit">
            保存课程
          </button>
          {onDelete && (
            <button
              type="button"
              className="text-button danger"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={16} />
              删除课程
            </button>
          )}
        </div>
      </form>
      {confirmDelete && onDelete && (
        <ConfirmDialog
          title="删除这门课程？"
          description="课程及其全部周次安排会从本机移除。此操作无法撤销。"
          confirmLabel="确认删除"
          onClose={() => setConfirmDelete(false)}
          onConfirm={onDelete}
        />
      )}
    </dialog>
  )
}
