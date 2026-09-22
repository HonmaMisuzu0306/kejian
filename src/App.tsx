import { useEffect, useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { Home } from './pages/Home'
import { Week } from './pages/Week'
import { ImportPage } from './pages/Import'
import { Settings } from './pages/Settings'
import { Agenda } from './pages/Agenda'
import { CourseEditor } from './components/CourseEditor'
import { EventEditor } from './components/EventEditor'
import {
  detectConflicts,
  importCourses,
  newCourse,
  undoLatestImport,
} from './domain/courses'
import { localISO, weekForDate } from './domain/calendar'
import { loadState, saveState } from './services/storage'
import type { AppState, Course, ScheduleEvent, Semester } from './domain/types'
import { AppShell, type PageId } from './components/AppShell'

type Page = PageId

function currentWeek(semester?: Semester) {
  return semester
    ? Math.min(
        semester.totalWeeks,
        Math.max(1, weekForDate(semester.startDate, localISO())),
      )
    : 1
}

export default function App() {
  const [state, setState] = useState(loadState)
  const [page, setPage] = useState<Page>('home')
  const [now, setNow] = useState(new Date())
  const [week, setWeek] = useState(() =>
    currentWeek(state.semesters.find((s) => s.id === state.activeSemesterId)),
  )
  const [editing, setEditing] = useState<Course | null>(null)
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const semester = state.semesters.find((s) => s.id === state.activeSemesterId)
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 5500)
    return () => clearTimeout(timer)
  }, [message])
  function persist(next: AppState) {
    try {
      saveState(next)
      setState(next)
      setError('')
    } catch {
      throw new Error(
        '无法保存到本地：浏览器存储可能已满或被禁用。请导出备份并检查浏览器设置。',
      )
    }
  }
  function navigate(next: Page) {
    setPage(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  function saveSemester(next: Semester) {
    persist({
      ...state,
      semesters: state.semesters.some((s) => s.id === next.id)
        ? state.semesters.map((s) => (s.id === next.id ? next : s))
        : [...state.semesters, next],
      activeSemesterId: next.id,
    })
    setWeek(currentWeek(next))
    setMessage('学期设置已保存')
    if (!semester) navigate('home')
  }
  function saveCourse(course: Course) {
    const next = {
      ...state,
      courses: state.courses.some((c) => c.id === course.id)
        ? state.courses.map((c) => (c.id === course.id ? course : c))
        : [...state.courses, course],
    }
    persist(next)
    setEditing(null)
    setMessage('课程已保存')
  }
  function saveEvent(event: ScheduleEvent) {
    const next = {
      ...state,
      events: state.events.some((item) => item.id === event.id)
        ? state.events.map((item) => (item.id === event.id ? event : item))
        : [...state.events, event],
    }
    persist(next)
    setEditingEvent(null)
    setMessage('个人日程已保存')
  }
  function handleImport(courses: Course[], names: string[]) {
    const result = importCourses(state, courses, names)
    const imported = courses[0]
    persist({
      ...result.state,
      activeSemesterId: imported?.semesterId ?? state.activeSemesterId,
    })
    if (imported) setWeek(imported.meetings[0].weeks[0])
    return `新增 ${result.added} 门 · 更新 ${result.updated} 门 · 跳过 ${result.skipped} 门重复课程`
  }
  function handleUndo() {
    try {
      persist(undoLatestImport(state))
      setMessage('最近一次导入已撤销，原有课程已恢复')
    } catch (err) {
      setError((err as Error).message)
    }
  }
  function handleActive(id: string) {
    try {
      persist({ ...state, activeSemesterId: id })
      setWeek(currentWeek(state.semesters.find((s) => s.id === id)))
    } catch (err) {
      setError((err as Error).message)
    }
  }
  const conflicts = semester
    ? detectConflicts(state.courses.filter((c) => c.semesterId === semester.id))
    : []
  return (
    <AppShell page={page} semester={semester} week={week} onNavigate={navigate}>
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button
            className="icon-button"
            aria-label="关闭错误"
            onClick={() => setError('')}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {!semester ? (
        <Settings
          state={state}
          initial
          onSave={saveSemester}
          onActive={() => {}}
        />
      ) : (
        <>
          {page === 'home' && (
            <Home
              semester={semester}
              courses={state.courses}
              events={state.events}
              now={now}
              onImport={() => navigate('import')}
              onAgenda={() => navigate('agenda')}
              onEdit={setEditing}
              onEditEvent={setEditingEvent}
            />
          )}
          {page === 'agenda' && (
            <Agenda
              semester={semester}
              courses={state.courses}
              events={state.events}
              initialDate={localISO(now)}
              onAdd={(event) => setEditingEvent(event)}
              onEditEvent={setEditingEvent}
              onEditCourse={setEditing}
            />
          )}
          {page === 'week' && (
            <>
              <Week
                semester={semester}
                courses={state.courses}
                week={week}
                onWeek={setWeek}
                onEdit={setEditing}
                onAdd={() => setEditing(newCourse(semester.id, week))}
              />
              {conflicts.length > 0 && (
                <div className="notice warning">
                  <strong>存在时间重叠，请核对</strong>
                  {conflicts.map((c, i) => (
                    <p key={i}>{c.message}</p>
                  ))}
                </div>
              )}
            </>
          )}
          {page === 'import' && (
            <ImportPage
              state={state}
              onImport={handleImport}
              onUndo={handleUndo}
              onView={() => navigate('week')}
            />
          )}
          {page === 'settings' && (
            <Settings
              key={state.activeSemesterId}
              state={state}
              onSave={saveSemester}
              onActive={handleActive}
            />
          )}
        </>
      )}
      {message && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {message}
        </div>
      )}
      {editing && (
        <CourseEditor
          key={editing.id}
          course={editing}
          semesters={state.semesters}
          onClose={() => setEditing(null)}
          onSave={saveCourse}
          onDelete={
            state.courses.some((c) => c.id === editing.id)
              ? () => {
                  try {
                    persist({
                      ...state,
                      courses: state.courses.filter((c) => c.id !== editing.id),
                    })
                    setEditing(null)
                    setMessage('课程已删除')
                  } catch (err) {
                    setError((err as Error).message)
                  }
                }
              : undefined
          }
        />
      )}
      {editingEvent && (
        <EventEditor
          key={editingEvent.id}
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={saveEvent}
          onDelete={
            state.events.some((event) => event.id === editingEvent.id)
              ? () => {
                  try {
                    persist({
                      ...state,
                      events: state.events.filter(
                        (event) => event.id !== editingEvent.id,
                      ),
                    })
                    setEditingEvent(null)
                    setMessage('个人日程已删除')
                  } catch (err) {
                    setError((err as Error).message)
                  }
                }
              : undefined
          }
        />
      )}
    </AppShell>
  )
}
