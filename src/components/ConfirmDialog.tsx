import { useEffect, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}) {
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
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog"
      onCancel={onClose}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-description"
    >
      <div className="confirm-mark">
        <AlertTriangle size={22} aria-hidden="true" />
      </div>
      <button
        className="icon-button confirm-close"
        type="button"
        aria-label="关闭确认框"
        onClick={onClose}
      >
        <X size={18} />
      </button>
      <span className="eyebrow">DANGER / CONFIRM ACTION</span>
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-description">{description}</p>
      <div className="confirm-actions">
        <button type="button" className="secondary" onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className="primary danger-action"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
