import { useState } from 'react'
import { createId } from '../domain/id'
import { CalendarDays, Check, Download, HardDrive, Plus } from 'lucide-react'
import { isMonday, localISO, weekForDate } from '../domain/calendar'
import type { AppState, Semester } from '../domain/types'

export function Settings({
  state,
  onSave,
  onActive,
  initial = false,
}: {
  state: AppState
  onSave: (s: Semester) => void
  onActive: (id: string) => void
  initial?: boolean
}) {
  const active = state.semesters.find((s) => s.id === state.activeSemesterId)
  const [draft, setDraft] = useState<Semester>(
    active ?? {
      id: createId(),
      name: '2026–2027 学年 · 第一学期',
      startDate: '2026-08-31',
      totalWeeks: 20,
    },
  )
  const [error, setError] = useState('')
  function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      if (!draft.name.trim()) throw new Error('请填写学期名称')
      if (!isMonday(draft.startDate))
        throw new Error('第一周起始日期必须是周一')
      if (
        !Number.isInteger(draft.totalWeeks) ||
        draft.totalWeeks < 1 ||
        draft.totalWeeks > 52
      )
        throw new Error('学期总周数应为 1–52')
      if (
        state.courses.some(
          (c) =>
            c.semesterId === draft.id &&
            c.meetings.some((m) => m.weeks.some((w) => w > draft.totalWeeks)),
        )
      )
        throw new Error('已有课程超出新的总周数，请先调整课程周次')
      onSave({ ...draft, name: draft.name.trim() })
    } catch (err) {
      setError((err as Error).message)
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = `课间备份-${localISO()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {initial
              ? '00 / TERMINAL SETUP · NEW SEMESTER'
              : '05 / DEVICE CONFIG · LOCAL DATA'}
          </span>
          <h1>{initial ? '初始化学期档案' : '终端配置'}</h1>
          <p>
            {initial
              ? '设置第一周，之后的日期交给课间。'
              : '管理学期与本地数据。'}
          </p>
        </div>
      </div>
      {initial && (
        <div className="welcome-visual">
          <CalendarDays size={44} />
          <div>
            <strong>课间</strong>
            <span>课业有安排，生活有留白。</span>
          </div>
        </div>
      )}
      {!initial && (
        <section className="settings-card">
          <h2>当前学期</h2>
          <label>
            选择正在使用的学期
            <select
              value={state.activeSemesterId}
              onChange={(e) => {
                onActive(e.target.value)
                setDraft(state.semesters.find((s) => s.id === e.target.value)!)
                setError('')
              }}
            >
              {state.semesters.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="text-button"
            onClick={() => {
              setDraft({
                id: createId(),
                name: '',
                startDate: '2026-08-31',
                totalWeeks: 20,
              })
              setError('')
            }}
          >
            <Plus size={17} />
            新建学期
          </button>
        </section>
      )}
      <form className="settings-card" onSubmit={save}>
        <div className="section-heading">
          <h2>
            {initial
              ? '学期设置'
              : state.semesters.some((s) => s.id === draft.id)
                ? '编辑学期'
                : '新建学期'}
          </h2>
          <CalendarDays size={20} />
        </div>
        <label>
          学期名称
          <input
            value={draft.name}
            maxLength={70}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="例如：2026–2027 第一学期"
          />
        </label>
        <label>
          第一周周一的日期
          <input
            type="date"
            value={draft.startDate}
            onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
          />
        </label>
        <div className="field-help">
          参考截图的第 3 周从 9 月 14 日开始，因此默认第一周为 8 月 31
          日。请按校历确认。
        </div>
        <label>
          学期总周数
          <input
            type="number"
            min={1}
            max={52}
            value={Number.isNaN(draft.totalWeeks) ? '' : draft.totalWeeks}
            onChange={(e) =>
              setDraft({ ...draft, totalWeeks: e.target.valueAsNumber })
            }
          />
        </label>
        {isMonday(draft.startDate) && (
          <div className="notice subtle">
            按此日期计算，今天对应第 {weekForDate(draft.startDate, localISO())}{' '}
            周。
          </div>
        )}
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <button className="primary full" type="submit">
          <Check size={18} />
          {initial ? '保存设置，开始使用' : '保存学期设置'}
        </button>
      </form>
      {!initial && (
        <>
          <section className="settings-card">
            <div className="section-heading">
              <h2>
                <HardDrive size={19} />
                本地数据
              </h2>
              <span className="tiny-tag">仅此设备</span>
            </div>
            <p className="muted">
              保存了 {state.courses.length} 门课程、{state.events.length}{' '}
              条个人日程和 {state.batches.length}{' '}
              条导入记录。图片仅用于当前预览，不持久保存。
            </p>
            <p className="muted">
              清除浏览器数据或更换访问地址后，这些记录可能无法访问。建议保留备份。第一阶段提供备份导出，恢复入口将在后续加入。
            </p>
            <button className="secondary full" onClick={download}>
              <Download size={17} />
              导出档案（JSON）
            </button>
          </section>
          <section className="settings-card">
            <h2>添加到手机桌面</h2>
            <p className="muted">
              在支持的浏览器中，通过“安装应用”或“添加到主屏幕”保存课间。离线使用需先在线打开一次正式构建版本。
            </p>
            <p className="muted">
              手机局域网 HTTP 地址适合预览页面；PWA 安装与离线缓存通常需要
              HTTPS。
            </p>
          </section>
          <p className="quiet-note">课间 v1.0.1 · 课表扫描实验版</p>
        </>
      )}
    </>
  )
}
