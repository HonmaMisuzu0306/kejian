import { ArrowRight, Clock3, MapPin, ScanLine } from 'lucide-react'
import {
  coursesOnDate,
  localDateTime,
  localISO,
  meetingTime,
  nextClass,
  sections,
  weekForDate,
  weekdays,
} from '../domain/calendar'
import type { Course, Semester } from '../domain/types'
import {
  ActionButton,
  EmptyState,
  SectionHeader,
  StatusBadge,
} from '../components/DesignSystem'

export function Home({
  semester,
  courses,
  now,
  onImport,
  onWeek,
  onEdit,
}: {
  semester: Semester
  courses: Course[]
  now: Date
  onImport: () => void
  onWeek: () => void
  onEdit: (c: Course) => void
}) {
  const today = localISO(now)
  const week = weekForDate(semester.startDate, today)
  const list = coursesOnDate(courses, semester, today)
  const next = nextClass(courses, semester, now)
  const minutes = next
    ? Math.ceil((next.start.getTime() - now.getTime()) / 60000)
    : 0
  const countdown =
    minutes < 60
      ? `${minutes} 分钟后`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟后`
        : `${Math.floor(minutes / 1440)} 天后`
  const inTerm = week >= 1 && week <= semester.totalWeeks
  const current = list.find(({ meeting }) => {
    const start = localDateTime(today, sections[meeting.startSection - 1][0])
    const end = localDateTime(today, sections[meeting.endSection - 1][1])
    return start <= now && end >= now
  })
  return (
    <>
      <div className="page-heading command-heading">
        <div className="heading-copy">
          <span className="eyebrow">KEJIAN / CAMPUS TIME SYSTEM</span>
          <h1>今日调度</h1>
          <p>{semester.name}</p>
        </div>
        <div
          className="date-module"
          aria-label={`${now.getMonth() + 1}月${now.getDate()}日，星期${weekdays[(now.getDay() + 6) % 7]}`}
        >
          <span>{String(now.getMonth() + 1).padStart(2, '0')}</span>
          <strong>{String(now.getDate()).padStart(2, '0')}</strong>
          <small>周{weekdays[(now.getDay() + 6) % 7]}</small>
        </div>
      </div>
      <div className="status-rail">
        <StatusBadge tone={current ? 'active' : 'success'}>
          {current ? '课程进行中' : '系统待命'}
        </StatusBadge>
        <span>
          {inTerm ? `WEEK_${String(week).padStart(2, '0')}` : 'OUT_OF_TERM'}
        </span>
        <span>LOCAL / {String(list.length).padStart(2, '0')} EVENTS</span>
      </div>
      <section className="next-card">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-serial" aria-hidden="true">
          NXT
          <br />
          SESSION
        </div>
        <div className="hero-label">
          <span className="pulse-dot" />
          {next ? 'NEXT SESSION / 下一节课程' : 'SYSTEM IDLE / 暂无后续课程'}
        </div>
        <div className="hero-time">
          {next ? meetingTime(next.meeting) : '--:--'}
        </div>
        <h2>{next ? next.course.name : '时间留白'}</h2>
        <p>
          {next ? (
            <>
              <MapPin size={15} />
              {next.course.location || '教室待补充'}
              <span>·</span>第 {next.meeting.startSection}–
              {next.meeting.endSection} 节
            </>
          ) : (
            '当前时间段未配置课程任务。'
          )}
        </p>
        <div className="hero-bottom">
          <span className="hero-pill">
            <Clock3 size={13} /> {next ? `T-${countdown}` : 'READY FOR IMPORT'}
          </span>
          <button
            onClick={next ? () => onEdit(next.course) : onImport}
            className="hero-action"
          >
            {next ? '打开课程档案' : '接入课表数据'}
            <ArrowRight size={18} />
          </button>
        </div>
      </section>
      <div className="stats-row">
        <div>
          <span className="stat-value">
            {String(list.length).padStart(2, '0')}
          </span>
          <span>今日课程</span>
        </div>
        <div>
          <span className="stat-value">
            {String(
              list.reduce(
                (n, x) => n + x.meeting.endSection - x.meeting.startSection + 1,
                0,
              ),
            ).padStart(2, '0')}
          </span>
          <span>今日节数</span>
        </div>
        <div>
          <span className="stat-value">
            {inTerm
              ? String(Math.max(0, semester.totalWeeks - week + 1)).padStart(
                  2,
                  '0',
                )
              : '—'}
          </span>
          <span>剩余教学周</span>
        </div>
      </div>
      <SectionHeader
        index="01"
        title="今日任务序列"
        subtitle={`TODAY / ${String(list.length).padStart(2, '0')} EVENTS`}
        action={
          <button className="text-button" onClick={onWeek}>
            打开周计划
            <ArrowRight size={16} />
          </button>
        }
      />
      {list.length ? (
        <div className="timeline">
          {list.map(({ course, meeting }, i) => {
            const ended =
              localDateTime(today, sections[meeting.endSection - 1][1]) < now
            const ongoing =
              !ended &&
              localDateTime(today, sections[meeting.startSection - 1][0]) <= now
            return (
              <button
                key={`${course.id}-${i}`}
                className={`today-course ${ended ? 'ended' : ''}`}
                onClick={() => onEdit(course)}
              >
                <div className="timeline-time">
                  <strong>{sections[meeting.startSection - 1][0]}</strong>
                  <span>{sections[meeting.endSection - 1][1]}</span>
                </div>
                <div
                  className="today-course-body"
                  style={{ borderLeftColor: course.color }}
                >
                  <div className="course-title-row">
                    <h3>{course.name}</h3>
                    {ongoing && (
                      <span className="tiny-tag">ACTIVE / 进行中</span>
                    )}
                    {ended && <span className="muted">CLOSED / 已结束</span>}
                  </div>
                  <p>
                    <MapPin size={14} />
                    {course.location || '教室待补充'}
                  </p>
                  <small>
                    第 {meeting.startSection}–{meeting.endSection} 节
                    {course.teacher ? ` · ${course.teacher}` : ''}
                  </small>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <EmptyState
          title="今天没有课程安排"
          description={
            <>
              已导入的课程会自动出现在这里。
              <br />
              有空的时候，也记得好好休息。
            </>
          }
          action={
            <ActionButton variant="secondary" onClick={onWeek}>
              查看周课表
            </ActionButton>
          }
        />
      )}
      <button className="import-banner" onClick={onImport}>
        <div className="banner-icon">
          <ScanLine size={23} />
        </div>
        <div>
          <span className="terminal-label">IMPORT TERMINAL / 03</span>
          <strong>接入新的课表数据</strong>
          <span>上传样本 · 校对草稿 · 写入本地</span>
        </div>
        <ArrowRight size={20} />
      </button>
      <p className="quiet-note">{semester.name} · 数据仅保存在当前浏览器</p>
    </>
  )
}
