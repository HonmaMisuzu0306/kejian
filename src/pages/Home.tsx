import { ArrowRight, Clock3, MapPin, ScanLine } from 'lucide-react'
import {
  coursesOnDate,
  localDateTime,
  localISO,
  nextClass,
  sections,
  weekForDate,
  weekdays,
} from '../domain/calendar'
import {
  eventsOnDate,
  minutesFromTime,
  nextScheduleEvent,
} from '../domain/events'
import type { Course, ScheduleEvent, Semester } from '../domain/types'
import {
  ActionButton,
  EmptyState,
  SectionHeader,
  StatusBadge,
} from '../components/DesignSystem'

type TodayItem =
  | {
      kind: 'course'
      key: string
      title: string
      location: string
      startTime: string
      endTime: string
      color: string
      course: Course
      sectionText: string
      teacher?: string
    }
  | {
      kind: 'event'
      key: string
      title: string
      location: string
      startTime: string
      endTime: string
      color: string
      event: ScheduleEvent
      notes?: string
    }

export function Home({
  semester,
  courses,
  events,
  now,
  onImport,
  onAgenda,
  onEdit,
  onEditEvent,
}: {
  semester: Semester
  courses: Course[]
  events: ScheduleEvent[]
  now: Date
  onImport: () => void
  onAgenda: () => void
  onEdit: (course: Course) => void
  onEditEvent: (event: ScheduleEvent) => void
}) {
  const today = localISO(now)
  const week = weekForDate(semester.startDate, today)
  const courseList = coursesOnDate(courses, semester, today)
  const eventList = eventsOnDate(events, today)
  const items: TodayItem[] = [
    ...courseList.map(({ course, meeting }, index) => ({
      kind: 'course' as const,
      key: `course:${course.id}:${index}`,
      title: course.name,
      location: course.location || '教室待补充',
      startTime: sections[meeting.startSection - 1][0],
      endTime: sections[meeting.endSection - 1][1],
      color: course.color,
      course,
      sectionText: `第 ${meeting.startSection}–${meeting.endSection} 节`,
      teacher: course.teacher,
    })),
    ...eventList.map((event) => ({
      kind: 'event' as const,
      key: `event:${event.id}`,
      title: event.title,
      location: event.location || '个人日程',
      startTime: event.startTime,
      endTime: event.endTime,
      color: event.color,
      event,
      notes: event.notes,
    })),
  ].sort(
    (a, b) =>
      minutesFromTime(a.startTime) - minutesFromTime(b.startTime) ||
      a.kind.localeCompare(b.kind),
  )

  const nextCourse = nextClass(courses, semester, now)
  const nextEvent = nextScheduleEvent(events, now)
  const nextIsEvent =
    nextEvent &&
    (!nextCourse || nextEvent.start.getTime() < nextCourse.start.getTime())
  const next = nextIsEvent
    ? {
        kind: 'event' as const,
        title: nextEvent.event.title,
        location: nextEvent.event.location || '个人日程',
        startTime: nextEvent.event.startTime,
        endTime: nextEvent.event.endTime,
        start: nextEvent.start,
        edit: () => onEditEvent(nextEvent.event),
        meta: 'PERSONAL EVENT / 个人日程',
      }
    : nextCourse
      ? {
          kind: 'course' as const,
          title: nextCourse.course.name,
          location: nextCourse.course.location || '教室待补充',
          startTime: sections[nextCourse.meeting.startSection - 1][0],
          endTime: sections[nextCourse.meeting.endSection - 1][1],
          start: nextCourse.start,
          edit: () => onEdit(nextCourse.course),
          meta: `COURSE / 第 ${nextCourse.meeting.startSection}–${nextCourse.meeting.endSection} 节`,
        }
      : null
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
  const current = items.find(
    (item) =>
      localDateTime(today, item.startTime) <= now &&
      localDateTime(today, item.endTime) >= now,
  )

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
          {current ? '安排进行中' : '系统待命'}
        </StatusBadge>
        <span>
          {inTerm ? `WEEK_${String(week).padStart(2, '0')}` : 'OUT_OF_TERM'}
        </span>
        <span>LOCAL / {String(items.length).padStart(2, '0')} ITEMS</span>
      </div>
      <section className="next-card">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-serial" aria-hidden="true">
          NXT
          <br />
          ITEM
        </div>
        <div className="hero-label">
          <span className="pulse-dot" />
          {next ? `NEXT ITEM / ${next.meta}` : 'SYSTEM IDLE / 暂无后续安排'}
        </div>
        <div className="hero-time">
          {next ? `${next.startTime}–${next.endTime}` : '--:--'}
        </div>
        <h2>{next ? next.title : '时间留白'}</h2>
        <p>
          {next ? (
            <>
              <MapPin size={15} />
              {next.location}
              <span>·</span>
              {next.kind === 'course' ? '课程' : '个人日程'}
            </>
          ) : (
            '当前时间段未配置课程或个人日程。'
          )}
        </p>
        <div className="hero-bottom">
          <span className="hero-pill">
            <Clock3 size={13} /> {next ? `T-${countdown}` : 'READY FOR PLAN'}
          </span>
          <button onClick={next ? next.edit : onAgenda} className="hero-action">
            {next ? '打开安排档案' : '创建个人日程'}
            <ArrowRight size={18} />
          </button>
        </div>
      </section>
      <div className="stats-row">
        <div>
          <span className="stat-value">
            {String(items.length).padStart(2, '0')}
          </span>
          <span>今日安排</span>
        </div>
        <div>
          <span className="stat-value">
            {String(courseList.length).padStart(2, '0')}
          </span>
          <span>课程</span>
        </div>
        <div>
          <span className="stat-value">
            {String(eventList.length).padStart(2, '0')}
          </span>
          <span>个人日程</span>
        </div>
      </div>
      <SectionHeader
        index="01"
        title="今日任务序列"
        subtitle={`TODAY / ${String(items.length).padStart(2, '0')} ITEMS`}
        action={
          <button className="text-button" onClick={onAgenda}>
            打开日程轴
            <ArrowRight size={16} />
          </button>
        }
      />
      {items.length ? (
        <div className="timeline">
          {items.map((item) => {
            const ended = localDateTime(today, item.endTime) < now
            const ongoing =
              !ended && localDateTime(today, item.startTime) <= now
            return (
              <button
                key={item.key}
                className={`today-course ${ended ? 'ended' : ''}`}
                onClick={() =>
                  item.kind === 'course'
                    ? onEdit(item.course)
                    : onEditEvent(item.event)
                }
              >
                <div className="timeline-time">
                  <strong>{item.startTime}</strong>
                  <span>{item.endTime}</span>
                </div>
                <div
                  className="today-course-body"
                  style={{ borderLeftColor: item.color }}
                >
                  <div className="course-title-row">
                    <h3>{item.title}</h3>
                    <span className="source-tag">
                      {item.kind === 'course' ? '课程' : '日程'}
                    </span>
                    {ongoing && (
                      <span className="tiny-tag">ACTIVE / 进行中</span>
                    )}
                  </div>
                  <p>
                    <MapPin size={14} />
                    {item.location}
                  </p>
                  <small>
                    {item.kind === 'course'
                      ? `${item.sectionText}${item.teacher ? ` · ${item.teacher}` : ''}`
                      : item.notes || '个人时间块'}
                  </small>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <EmptyState
          title="今天没有课程或个人日程"
          description={
            <>
              在日程时间轴点击任意空闲时段，即可创建安排。
              <br />
              有空的时候，也记得好好休息。
            </>
          }
          action={
            <ActionButton variant="secondary" onClick={onAgenda}>
              创建个人日程
            </ActionButton>
          }
        />
      )}
      <button className="import-banner" onClick={onImport}>
        <div className="banner-icon">
          <ScanLine size={23} />
        </div>
        <div>
          <span className="terminal-label">IMPORT TERMINAL / 04</span>
          <strong>接入新的课表数据</strong>
          <span>上传样本 · 校对草稿 · 写入本地</span>
        </div>
        <ArrowRight size={20} />
      </button>
      <p className="quiet-note">{semester.name} · 数据仅保存在当前浏览器</p>
    </>
  )
}
