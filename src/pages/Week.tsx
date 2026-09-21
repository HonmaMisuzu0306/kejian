import { useRef } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { dateForWeek, localISO, sections, weekdays } from '../domain/calendar'
import type { Course, Semester } from '../domain/types'
import { assignLanes } from '../domain/layout'

export function Week({
  semester,
  courses,
  week,
  onWeek,
  onEdit,
  onAdd,
}: {
  semester: Semester
  courses: Course[]
  week: number
  onWeek: (w: number) => void
  onEdit: (c: Course) => void
  onAdd: () => void
}) {
  const startX = useRef(0)
  const visible = courses
    .filter((c) => c.semesterId === semester.id)
    .flatMap((course) =>
      course.meetings
        .filter((m) => m.weeks.includes(week))
        .map((meeting, i) => ({ course, meeting, key: `${course.id}-${i}` })),
    )
  const lanes = assignLanes(visible)
  const monday = dateForWeek(semester.startDate, week)
  const sunday = dateForWeek(semester.startDate, week, 7)
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">02 / WEEK GRID · ACADEMIC PLAN</span>
          <h1>周计划矩阵</h1>
          <p>{semester.name}</p>
        </div>
        <button
          className="icon-button bordered"
          aria-label="添加课程"
          onClick={onAdd}
        >
          <Plus size={22} />
        </button>
      </div>
      <div className="week-switch">
        <button
          className="icon-button"
          aria-label="上一周"
          disabled={week <= 1}
          onClick={() => onWeek(week - 1)}
        >
          <ChevronLeft />
        </button>
        <div>
          <strong>WEEK_{String(week).padStart(2, '0')}</strong>
          <span>
            {monday.slice(5).replace('-', '.')} —{' '}
            {sunday.slice(5).replace('-', '.')}
          </span>
        </div>
        <button
          className="icon-button"
          aria-label="下一周"
          disabled={week >= semester.totalWeeks}
          onClick={() => onWeek(week + 1)}
        >
          <ChevronRight />
        </button>
      </div>
      <div className="week-help">
        <span>
          <i className="legend-dot" />
          LOAD / {String(visible.length).padStart(2, '0')} 次课程安排
        </span>
        <span>SWIPE TO SHIFT · 点击课程编辑</span>
      </div>
      <div
        className="timetable"
        onTouchStart={(e) => {
          startX.current = e.changedTouches[0].clientX
        }}
        onTouchEnd={(e) => {
          const delta = e.changedTouches[0].clientX - startX.current
          if (Math.abs(delta) > 70)
            onWeek(
              Math.min(
                semester.totalWeeks,
                Math.max(1, week + (delta < 0 ? 1 : -1)),
              ),
            )
        }}
      >
        <div className="grid-corner">{Number(monday.slice(5, 7))}月</div>
        {weekdays.map((day, i) => {
          const date = dateForWeek(semester.startDate, week, i + 1)
          return (
            <div
              key={day}
              className={`day-heading ${date === localISO() ? 'is-today' : ''}`}
              style={{ gridColumn: i + 2 }}
            >
              <span>{day}</span>
              <strong>{Number(date.slice(8))}</strong>
            </div>
          )
        })}
        {sections.map(([start], i) => (
          <div key={start} className="section-label" style={{ gridRow: i + 2 }}>
            <strong>{i + 1}</strong>
            <span>{start}</span>
          </div>
        ))}
        {Array.from({ length: 77 }, (_, i) => (
          <div
            aria-hidden="true"
            key={i}
            className={`grid-cell ${i % 7 >= 5 ? 'weekend' : ''}`}
            style={{ gridColumn: (i % 7) + 2, gridRow: Math.floor(i / 7) + 2 }}
          />
        ))}
        {visible.map(({ course, meeting, key }) => {
          const { lane, count } = lanes.get(key)!
          return (
            <button
              key={key}
              className={`grid-course ${count > 1 ? 'overlap' : ''}`}
              aria-label={`${course.name} 周${weekdays[meeting.weekday - 1]} 第${meeting.startSection}到${meeting.endSection}节`}
              style={{
                gridColumn: meeting.weekday + 1,
                gridRow: `${meeting.startSection + 1} / span ${meeting.endSection - meeting.startSection + 1}`,
                background: `${course.color}18`,
                borderLeftColor: course.color,
                color: course.color,
                ...(count > 1
                  ? {
                      width: `calc(${100 / count}% - 2px)`,
                      marginLeft: `calc(${(lane * 100) / count}% + 1px)`,
                    }
                  : {}),
              }}
              onClick={() => onEdit(course)}
            >
              <strong>{course.name}</strong>
              <span>{course.location || '待补教室'}</span>
              <small>
                {meeting.startSection}–{meeting.endSection}节
              </small>
            </button>
          )
        })}
      </div>
      {!visible.length && (
        <div className="notice">
          本周还没有课程。可以添加课程，或导入这一周的课表截图。
        </div>
      )}
      <p className="quiet-note">
        只展示已确认周次的课程，不自动补全未导入的周。
      </p>
    </>
  )
}
