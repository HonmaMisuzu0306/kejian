import { useMemo, useState } from 'react'
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
} from 'lucide-react'
import {
  coursesOnDate,
  localISO,
  sections,
  shiftDate,
  weekdayOf,
  weekdays,
  weekForDate,
} from '../domain/calendar'
import {
  AGENDA_END_MINUTE,
  AGENDA_START_MINUTE,
  assignTimeLanes,
  detectScheduleConflicts,
  eventsOnDate,
  minutesFromTime,
  newScheduleEvent,
  timeFromMinutes,
} from '../domain/events'
import type { Course, ScheduleEvent, Semester } from '../domain/types'
import { StatusBadge } from '../components/DesignSystem'

type AgendaBlock = {
  id: string
  kind: 'course' | 'event'
  title: string
  subtitle: string
  start: number
  end: number
  color: string
  course?: Course
  event?: ScheduleEvent
}

const PIXELS_PER_MINUTE = 1

export function Agenda({
  semester,
  courses,
  events,
  initialDate,
  onAdd,
  onEditEvent,
  onEditCourse,
}: {
  semester: Semester
  courses: Course[]
  events: ScheduleEvent[]
  initialDate: string
  onAdd: (event: ScheduleEvent) => void
  onEditEvent: (event: ScheduleEvent) => void
  onEditCourse: (course: Course) => void
}) {
  const [date, setDate] = useState(initialDate)
  const dayEvents = eventsOnDate(events, date)
  const dayCourses = coursesOnDate(courses, semester, date)
  const conflicts = detectScheduleConflicts(events, courses, semester, date)
  const eventConflictIds = new Set(conflicts.flatMap((item) => item.eventIds))
  const courseConflictIds = new Set(
    conflicts.flatMap((item) => (item.courseId ? [item.courseId] : [])),
  )
  const blocks = useMemo<AgendaBlock[]>(
    () => [
      ...dayCourses.map(({ course, meeting }, index) => ({
        id: `course:${course.id}:${index}`,
        kind: 'course' as const,
        title: course.name,
        subtitle: course.location || '教室待补充',
        start: minutesFromTime(sections[meeting.startSection - 1][0]),
        end: minutesFromTime(sections[meeting.endSection - 1][1]),
        color: course.color,
        course,
      })),
      ...dayEvents.map((event) => ({
        id: `event:${event.id}`,
        kind: 'event' as const,
        title: event.title,
        subtitle: event.location || '个人日程',
        start: minutesFromTime(event.startTime),
        end: minutesFromTime(event.endTime),
        color: event.color,
        event,
      })),
    ],
    [dayCourses, dayEvents],
  )
  const lanes = assignTimeLanes(
    blocks.map((block) => ({
      id: block.id,
      startMinute: block.start,
      endMinute: block.end,
    })),
  )
  const totalHeight =
    (AGENDA_END_MINUTE - AGENDA_START_MINUTE) * PIXELS_PER_MINUTE
  const week = weekForDate(semester.startDate, date)
  const isToday = date === localISO()
  const now = new Date()
  const nowMinute = now.getHours() * 60 + now.getMinutes()
  const defaultStart = () => {
    if (!isToday) return '09:00'
    const rounded = Math.ceil(nowMinute / 30) * 30
    return timeFromMinutes(
      Math.max(AGENDA_START_MINUTE, Math.min(23 * 60 + 30, rounded)),
    )
  }
  return (
    <>
      <div className="page-heading agenda-heading">
        <div>
          <span className="eyebrow">
            03 / DAY AGENDA · PERSONAL TIME BLOCKS
          </span>
          <h1>日程时间轴</h1>
          <p>课程与个人安排，在同一天协调运行。</p>
        </div>
        <button
          className="icon-button bordered"
          aria-label="新建日程"
          onClick={() => onAdd(newScheduleEvent(date, defaultStart()))}
        >
          <Plus size={22} />
        </button>
      </div>
      <div className="agenda-date-switch">
        <button
          className="icon-button"
          aria-label="前一天"
          onClick={() => setDate(shiftDate(date, -1))}
        >
          <ChevronLeft />
        </button>
        <div>
          <span className="terminal-label">
            {week >= 1 && week <= semester.totalWeeks
              ? `WEEK_${String(week).padStart(2, '0')}`
              : 'OUT_OF_TERM'}
          </span>
          <strong>
            {date.slice(5).replace('-', '.')} · 周
            {weekdays[weekdayOf(date) - 1]}
          </strong>
        </div>
        <button
          className="icon-button"
          aria-label="后一天"
          onClick={() => setDate(shiftDate(date, 1))}
        >
          <ChevronRight />
        </button>
      </div>
      <div className="agenda-tools">
        <button className="secondary" onClick={() => setDate(localISO())}>
          回到今天
        </button>
        <label>
          <span className="visually-hidden">选择日程日期</span>
          <input
            aria-label="选择日程日期"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
      </div>
      <div className="agenda-stats">
        <div>
          <strong>{String(dayCourses.length).padStart(2, '0')}</strong>
          <span>课程</span>
        </div>
        <div>
          <strong>{String(dayEvents.length).padStart(2, '0')}</strong>
          <span>个人日程</span>
        </div>
        <div className={conflicts.length ? 'has-conflict' : ''}>
          <strong>{String(conflicts.length).padStart(2, '0')}</strong>
          <span>冲突</span>
        </div>
      </div>
      {conflicts.length > 0 && (
        <div className="notice error" role="status">
          <strong>发现 {conflicts.length} 处日程冲突</strong>
          {conflicts.map((conflict) => (
            <p key={conflict.key}>{conflict.message}</p>
          ))}
        </div>
      )}
      <div className="agenda-legend">
        <StatusBadge tone="neutral">课程</StatusBadge>
        <StatusBadge tone="active">个人日程</StatusBadge>
        <span>点击空闲时间段创建 · 点击安排编辑</span>
      </div>
      <div
        className="agenda-board"
        style={{ height: totalHeight }}
        aria-label={`${date}日程时间轴`}
      >
        <div className="agenda-axis" aria-hidden="true">
          {Array.from({ length: 19 }, (_, index) => {
            const minute = AGENDA_START_MINUTE + index * 60
            return (
              <span key={minute} style={{ top: minute - AGENDA_START_MINUTE }}>
                {minute === AGENDA_END_MINUTE
                  ? '24:00'
                  : timeFromMinutes(minute)}
              </span>
            )
          })}
        </div>
        <div className="agenda-canvas">
          {Array.from({ length: 36 }, (_, index) => {
            const minute = AGENDA_START_MINUTE + index * 30
            const time = timeFromMinutes(minute)
            return (
              <button
                key={minute}
                className="agenda-slot"
                style={{ top: minute - AGENDA_START_MINUTE }}
                aria-label={`在 ${time} 创建日程`}
                onClick={() => onAdd(newScheduleEvent(date, time))}
              />
            )
          })}
          {isToday &&
            nowMinute >= AGENDA_START_MINUTE &&
            nowMinute < AGENDA_END_MINUTE && (
              <div
                className="agenda-now-line"
                style={{ top: nowMinute - AGENDA_START_MINUTE }}
              >
                <span>{timeFromMinutes(nowMinute)}</span>
              </div>
            )}
          {blocks.map((block) => {
            const lane = lanes.get(block.id) ?? { lane: 0, count: 1 }
            const conflict = block.event
              ? eventConflictIds.has(block.event.id)
              : courseConflictIds.has(block.course!.id)
            return (
              <button
                key={block.id}
                className={`agenda-block ${block.kind} ${conflict ? 'conflict' : ''}`}
                style={{
                  top: block.start - AGENDA_START_MINUTE + 2,
                  height: Math.max(28, block.end - block.start - 4),
                  left: `calc(${(lane.lane * 100) / lane.count}% + 3px)`,
                  width: `calc(${100 / lane.count}% - 6px)`,
                  borderLeftColor: block.color,
                  background: `${block.color}1c`,
                  color: block.color,
                }}
                aria-label={`${block.kind === 'course' ? '课程' : '日程'} ${block.title} ${timeFromMinutes(block.start)}到${timeFromMinutes(block.end)}`}
                onClick={() =>
                  block.event
                    ? onEditEvent(block.event)
                    : onEditCourse(block.course!)
                }
              >
                <span className="agenda-block-kind">
                  {block.kind === 'course' ? 'COURSE / 课程' : 'EVENT / 日程'}
                </span>
                <strong>{block.title}</strong>
                <span className="agenda-block-time">
                  {timeFromMinutes(block.start)}–{timeFromMinutes(block.end)}
                </span>
                <small>
                  <MapPin size={11} /> {block.subtitle}
                </small>
              </button>
            )
          })}
        </div>
      </div>
      {!blocks.length && (
        <div className="agenda-empty-tip">
          <CalendarClock size={18} />
          今天还没有安排。点击任意半小时时段创建日程。
        </div>
      )}
    </>
  )
}
