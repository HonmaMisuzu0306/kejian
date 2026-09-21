import type { ComponentType, ReactNode } from 'react'
import { CalendarDays, Home, Settings2, Upload } from 'lucide-react'
import { BrandSymbol } from './BrandSymbol'
import { StatusBadge } from './DesignSystem'
import type { Semester } from '../domain/types'

export type PageId = 'home' | 'week' | 'import' | 'settings'
const tabs: {
  id: PageId
  label: string
  code: string
  Icon: ComponentType<{ size?: number }>
}[] = [
  { id: 'home', label: '今日', code: '01', Icon: Home },
  { id: 'week', label: '课表', code: '02', Icon: CalendarDays },
  { id: 'import', label: '导入', code: '03', Icon: Upload },
  { id: 'settings', label: '设置', code: '04', Icon: Settings2 },
]

export function AppShell({
  page,
  semester,
  week,
  onNavigate,
  children,
}: {
  page: PageId
  semester?: Semester
  week: number
  onNavigate: (page: PageId) => void
  children: ReactNode
}) {
  const navigate = (event: React.MouseEvent, target: PageId) => {
    event.preventDefault()
    onNavigate(target)
  }
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <a href="#" className="brand" onClick={(e) => navigate(e, 'home')}>
          <BrandSymbol className="brand-symbol" />
          <div>
            <strong>课间</strong>
            <small>KEJIAN / CAMPUS TIME</small>
          </div>
        </a>
        <div className="system-line">
          <span>LOCAL TERMINAL</span>
          <b>SYS.01</b>
        </div>
        <nav className="desktop-nav" aria-label="桌面主导航">
          {tabs.map(({ id, label, code, Icon }) => (
            <button
              disabled={!semester}
              key={id}
              className={page === id ? 'active' : ''}
              onClick={() => onNavigate(id)}
              aria-label={label}
            >
              <span className="nav-code">{code}</span>
              <Icon size={19} />
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="terminal-label">ACADEMIC CYCLE</span>
          <strong>
            {semester ? `WEEK_${String(week).padStart(2, '0')}` : 'NO_DATA'}
          </strong>
          <p>{semester?.name ?? '等待初始化学期数据'}</p>
          <div className="meter" aria-hidden="true">
            <i
              style={{
                width: semester
                  ? `${Math.min(100, (week / semester.totalWeeks) * 100)}%`
                  : '0%',
              }}
            />
          </div>
          <small>LOCAL FIRST · DEVICE STORAGE</small>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <a
            href="#"
            className="mobile-brand"
            onClick={(e) => navigate(e, 'home')}
          >
            <BrandSymbol />
            课间<span>KEJIAN</span>
          </a>
          <span className="desktop-breadcrumb">
            KEJIAN / {tabs.find((tab) => tab.id === page)?.label.toUpperCase()}
          </span>
          <StatusBadge tone="success">本地保存</StatusBadge>
        </header>
        <main>{children}</main>
        <footer className="desktop-footer">
          <span>KEJIAN CAMPUS TIME SYSTEM</span>
          <span>PHASE 02 / VISUAL SYSTEM</span>
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="手机主导航">
        {tabs.map(({ id, label, code, Icon }) => (
          <button
            disabled={!semester}
            key={id}
            className={page === id ? 'active' : ''}
            onClick={() => onNavigate(id)}
            aria-label={label}
            aria-current={page === id ? 'page' : undefined}
          >
            <span className="mobile-nav-code">{code}</span>
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
