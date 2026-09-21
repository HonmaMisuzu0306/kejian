import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { ArrowRight, CalendarDays } from 'lucide-react'

export function IndustrialPanel({
  children,
  className = '',
  label,
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode; label?: string }) {
  return (
    <section className={`industrial-panel ${className}`} {...props}>
      {label && <span className="panel-label">{label}</span>}
      {children}
    </section>
  )
}

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'active' | 'success' | 'warning' | 'danger'
}) {
  return (
    <span className={`status-badge status-${tone}`}>
      <i aria-hidden="true" />
      {children}
    </span>
  )
}

export function SectionHeader({
  index,
  title,
  subtitle,
  action,
}: {
  index: string
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="module-heading">
      <div className="module-index" aria-hidden="true">
        {index}
      </div>
      <div className="module-copy">
        <span>{subtitle}</span>
        <h2>{title}</h2>
      </div>
      {action && <div className="module-action">{action}</div>}
    </div>
  )
}

export function ActionButton({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
}) {
  return (
    <button
      className={`action-button action-${variant} ${className}`}
      {...props}
    >
      {children}
      {variant === 'primary' && <ArrowRight size={17} aria-hidden="true" />}
    </button>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-index">00</div>
      <div className="empty-icon">
        <CalendarDays size={26} aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}
