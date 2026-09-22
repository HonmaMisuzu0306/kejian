import { useEffect, useRef, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { eventErrors, eventPalette } from '../domain/events'
import type { ScheduleEvent } from '../domain/types'
import { ConfirmDialog } from './ConfirmDialog'

export function EventEditor({
  event,
  onSave,
  onClose,
  onDelete,
}: {
  event: ScheduleEvent
  onSave: (event: ScheduleEvent) => void
  onClose: () => void
  onDelete?: () => void
}) {
  const [draft, setDraft] = useState(structuredClone(event))
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    return () => {
      dialog.current?.close()
      returnFocus.current?.focus()
    }
  }, [])

  function submit(submitEvent: React.FormEvent) {
    submitEvent.preventDefault()
    const next = {
      ...draft,
      title: draft.title.trim(),
      location: draft.location?.trim(),
      notes: draft.notes?.trim(),
      updatedAt: new Date().toISOString(),
    }
    const errors = eventErrors(next)
    if (errors.length) {
      setError(errors.join('；'))
      return
    }
    onSave(next)
  }

  return (
    <dialog
      ref={dialog}
      className="sheet event-sheet"
      onCancel={onClose}
      aria-labelledby="event-editor-title"
    >
      <form onSubmit={submit}>
        <div className="sheet-heading">
          <div>
            <span className="eyebrow">PERSONAL EVENT / TIME BLOCK</span>
            <h2 id="event-editor-title">
              {event.title ? '编辑日程' : '创建日程'}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭日程编辑"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <label>
          日程标题 <span className="required">*</span>
          <input
            autoFocus
            value={draft.title}
            maxLength={80}
            placeholder="例如：完成实验报告"
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
        <label>
          日期 <span className="required">*</span>
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            开始时间 <span className="required">*</span>
            <input
              type="time"
              min="06:00"
              max="23:30"
              step="900"
              value={draft.startTime}
              onChange={(e) =>
                setDraft({ ...draft, startTime: e.target.value })
              }
            />
          </label>
          <label>
            结束时间 <span className="required">*</span>
            <input
              type="time"
              min="06:15"
              max="23:59"
              step="900"
              value={draft.endTime}
              onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
            />
          </label>
        </div>
        <label>
          地点
          <input
            value={draft.location ?? ''}
            maxLength={80}
            placeholder="选填"
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
          />
        </label>
        <label>
          备注
          <textarea
            value={draft.notes ?? ''}
            maxLength={500}
            rows={4}
            placeholder="记录准备事项或补充信息"
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </label>
        <label>日程颜色</label>
        <div className="color-row">
          {eventPalette.map((color) => (
            <button
              type="button"
              key={color}
              className={`color-swatch ${draft.color === color ? 'selected' : ''}`}
              style={{ background: color }}
              aria-label={`选择日程颜色 ${color}`}
              aria-pressed={draft.color === color}
              onClick={() => setDraft({ ...draft, color })}
            />
          ))}
        </div>
        {error && (
          <div role="alert" className="notice error">
            {error}
          </div>
        )}
        <div className="sheet-footer">
          <button className="primary full" type="submit">
            保存日程
          </button>
          {onDelete && (
            <button
              type="button"
              className="text-button danger"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={16} />
              删除日程
            </button>
          )}
        </div>
      </form>
      {confirmDelete && onDelete && (
        <ConfirmDialog
          title="删除这条日程？"
          description="这条个人日程会从本机移除。课程和其他日程不会受到影响。"
          confirmLabel="确认删除"
          onClose={() => setConfirmDelete(false)}
          onConfirm={onDelete}
        />
      )}
    </dialog>
  )
}
