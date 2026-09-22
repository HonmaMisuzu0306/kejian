import { useEffect, useRef, useState } from 'react'
import { createId } from '../domain/id'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  FileImage,
  ImagePlus,
  LoaderCircle,
  Plus,
  ScanLine,
  Trash2,
  Undo2,
  UploadCloud,
  X,
} from 'lucide-react'
import { CourseEditor } from '../components/CourseEditor'
import {
  courseErrors,
  detectConflicts,
  mergeCourses,
  newCourse,
} from '../domain/courses'
import { formatWeeks, weekdays } from '../domain/calendar'
import { nuistScreenshotRecognizer } from '../services/recognizer'
import type { AppState, Course } from '../domain/types'

type SelectedImage = {
  id: string
  file: File
  url: string
  semesterId: string
  week: number
}
export function ImportPage({
  state,
  onImport,
  onUndo,
  onView,
}: {
  state: AppState
  onImport: (drafts: Course[], names: string[]) => string
  onUndo: () => void
  onView: () => void
}) {
  const [images, setImages] = useState<SelectedImage[]>([])
  const imagesRef = useRef<SelectedImage[]>([])
  const [drafts, setDrafts] = useState<Course[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [busy, setBusy] = useState(false)
  const [recognitionProgress, setRecognitionProgress] = useState({
    value: 0,
    label: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState<Course | null>(null)
  const [conflictAck, setConflictAck] = useState(false)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const alive = useRef(true)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [step])
  useEffect(() => {
    imagesRef.current = images
  }, [images])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      imagesRef.current.forEach((i) => URL.revokeObjectURL(i.url))
    }
  }, [])
  function choose(files: FileList | null) {
    if (!files) return
    setError('')
    const selected = [...files]
    if (images.length + selected.length > 12) {
      setError('每次最多选择 12 张截图，请分批导入。')
      return
    }
    if (
      selected.some(
        (f) =>
          !['image/png', 'image/jpeg', 'image/webp'].includes(f.type) ||
          f.size > 15 * 1024 * 1024,
      )
    ) {
      setError('请选择 PNG、JPG 或 WebP 图片，每张不超过 15 MB。')
      return
    }
    setImages((prev) => [
      ...prev,
      ...selected.map((file) => ({
        id: createId(),
        file,
        url: URL.createObjectURL(file),
        semesterId: state.activeSemesterId,
        week: Math.min(
          3,
          state.semesters.find((s) => s.id === state.activeSemesterId)!
            .totalWeeks,
        ),
      })),
    ])
  }
  function remove(id: string) {
    setImages((prev) => {
      const found = prev.find((i) => i.id === id)
      if (found) URL.revokeObjectURL(found.url)
      return prev.filter((i) => i.id !== id)
    })
  }
  async function recognize() {
    setBusy(true)
    setError('')
    setRecognitionProgress({ value: 0, label: '准备本地识别' })
    try {
      for (const image of images) {
        const semester = state.semesters.find((s) => s.id === image.semesterId)
        if (
          !semester ||
          !Number.isInteger(image.week) ||
          image.week < 1 ||
          image.week > semester.totalWeeks
        )
          throw new Error('请为每张截图填写有效周次。')
      }
      const results = []
      for (let index = 0; index < images.length; index++) {
        const image = images[index]
        results.push(
          await nuistScreenshotRecognizer.recognize({
            image: image.file,
            semesterId: image.semesterId,
            weekNumber: image.week,
            onProgress(value, label) {
              setRecognitionProgress({
                value: (index + value) / images.length,
                label: `图片 ${index + 1}/${images.length} · ${label}`,
              })
            },
          }),
        )
      }
      if (!alive.current) return
      setDrafts(
        mergeCourses(
          [],
          results.flatMap((r) => r.courses),
        ),
      )
      setWarnings([...new Set(results.flatMap((r) => r.warnings))])
      setStep(2)
    } catch (err) {
      if (alive.current) setError((err as Error).message)
    } finally {
      if (alive.current) {
        setBusy(false)
        setRecognitionProgress({ value: 0, label: '' })
      }
    }
  }
  const errors = drafts.flatMap((c) =>
    courseErrors(
      c,
      state.semesters.find((s) => s.id === c.semesterId)!,
    ).map((e) => `${c.name || '未命名课程'}：${e}`),
  )
  const incomingIds = new Set(drafts.map((d) => d.id))
  // Merge before conflict detection so repeat imports do not appear as conflicts with themselves.
  const merged = mergeCourses(state.courses, drafts)
  const relevantIds = new Set(
    merged
      .filter(
        (c) =>
          incomingIds.has(c.id) ||
          drafts.some(
            (d) =>
              d.semesterId === c.semesterId &&
              d.name.trim() === c.name &&
              (d.location ?? '').trim() === (c.location ?? '') &&
              (d.teacher ?? '').trim() === (c.teacher ?? ''),
          ),
      )
      .map((c) => c.id),
  )
  const conflicts = detectConflicts(merged).filter(
    (c) => relevantIds.has(c.a) || relevantIds.has(c.b),
  )
  function commit() {
    try {
      setSuccess(
        onImport(
          drafts,
          images.map((i) => i.file.name),
        ),
      )
      setStep(3)
      setError('')
    } catch (err) {
      setError((err as Error).message)
    }
  }
  function saveDraft(c: Course) {
    setDrafts((prev) =>
      prev.some((d) => d.id === c.id)
        ? prev.map((d) => (d.id === c.id ? c : d))
        : [...prev, c],
    )
    setEditing(null)
    setConflictAck(false)
  }
  const lastBatch = state.batches.findLast((b) => !b.undoneAt)
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">04 / IMPORT TERMINAL · SOURCE INTAKE</span>
          <h1>课表数据接入</h1>
          <p>上传样本、校对草稿，再写入本地终端。</p>
        </div>
      </div>
      <div className="steps" aria-label={`导入进度，第${step}步`}>
        {['上传截图', '校对草稿', '完成导入'].map((label, i) => (
          <div
            key={label}
            className={
              step === i + 1 ? 'active' : step > i + 1 ? 'complete' : ''
            }
          >
            <span>{step > i + 1 ? <Check size={15} /> : i + 1}</span>
            <strong>{label}</strong>
          </div>
        ))}
      </div>
      {step === 1 && (
        <>
          <div className="notice demo-notice">
            <ScanLine size={21} />
            <div>
              <strong>V1.0.1 · 实验性本地识别</strong>
              <p>
                当前适配南信大移动教务系统的竖屏周课表。图片只在本机处理，中文小字仍可能识别错误，请逐项校对。
              </p>
            </div>
          </div>
          <input
            ref={input}
            data-testid="screenshot-input"
            className="visually-hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(e) => {
              choose(e.target.files)
              e.target.value = ''
            }}
          />
          <button
            className={`upload-area ${dragging ? 'dragging' : ''}`}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              choose(e.dataTransfer.files)
            }}
          >
            <span className="upload-icon">
              <UploadCloud size={29} />
            </span>
            <strong>选择课表截图</strong>
            <span>从相册选择，或将图片拖到这里</span>
            <small>JPG / PNG / WebP · 每张最多 15 MB</small>
          </button>
          {images.length > 0 && (
            <>
              <div className="section-heading">
                <h3>已选择 {images.length} 张</h3>
                <button
                  className="text-button"
                  onClick={() => input.current?.click()}
                >
                  <Plus size={16} />
                  继续添加
                </button>
              </div>
              <div className="image-list">
                {images.map((image, i) => {
                  const semester = state.semesters.find(
                    (s) => s.id === image.semesterId,
                  )!
                  return (
                    <div className="image-row" key={image.id}>
                      <a
                        href={image.url}
                        target="_blank"
                        rel="noreferrer"
                        title="查看原图"
                      >
                        <img src={image.url} alt={`课表截图${i + 1}`} />
                      </a>
                      <div className="image-meta">
                        <strong title={image.file.name}>
                          {image.file.name}
                        </strong>
                        <div className="form-grid">
                          <label>
                            学期
                            <select
                              aria-label={`截图${i + 1}学期`}
                              value={image.semesterId}
                              onChange={(e) =>
                                setImages(
                                  images.map((x) =>
                                    x.id === image.id
                                      ? { ...x, semesterId: e.target.value }
                                      : x,
                                  ),
                                )
                              }
                            >
                              {state.semesters.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            截图周次
                            <input
                              aria-label={`截图${i + 1}周次`}
                              type="number"
                              min={1}
                              max={semester.totalWeeks}
                              value={Number.isNaN(image.week) ? '' : image.week}
                              onChange={(e) =>
                                setImages(
                                  images.map((x) =>
                                    x.id === image.id
                                      ? { ...x, week: e.target.valueAsNumber }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </label>
                        </div>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`移除截图${i + 1}`}
                        onClick={() => remove(image.id)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  )
                })}
              </div>
              <button
                className="primary full"
                disabled={busy}
                onClick={recognize}
              >
                {busy ? (
                  <>
                    <LoaderCircle size={18} className="spin" />
                    {recognitionProgress.label || '正在识别截图…'}
                  </>
                ) : (
                  <>
                    开始本地识别
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
              {busy && (
                <div
                  className="recognition-progress"
                  role="progressbar"
                  aria-label={recognitionProgress.label}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(recognitionProgress.value * 100)}
                >
                  <span
                    style={{
                      width: `${Math.round(recognitionProgress.value * 100)}%`,
                    }}
                  />
                </div>
              )}
            </>
          )}
          <div className="tips-card">
            <h3>
              <ImagePlus size={18} />
              让课表更完整的小提示
            </h3>
            <p>
              保留顶部周次、星期和左侧节次；截图尽量清晰完整。不同周的截图可一起导入，相同课程会自动合并。
            </p>
            <p>
              请使用完整竖屏周视图，不要裁掉星期栏和左侧节次。一张截图只代表一周，其他周需要补充截图或手动设置。
            </p>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <div className="section-heading">
            <div>
              <h2>
                识别草稿 <span className="count-badge">{drafts.length}</span>
              </h2>
              <p className="muted">请对照原图，确认每一项课程信息。</p>
            </div>
            <button
              className="secondary"
              onClick={() =>
                setEditing(
                  newCourse(
                    images[0]?.semesterId ?? state.activeSemesterId,
                    images[0]?.week ?? 1,
                  ),
                )
              }
            >
              <Plus size={17} />
              添加
            </button>
          </div>
          <details className="reference-panel">
            <summary>
              <FileImage size={17} />
              查看原图与识别提示
              <ChevronDown size={16} />
            </summary>
            <div className="reference-images">
              {images.map((i) => (
                <a key={i.id} href={i.url} target="_blank" rel="noreferrer">
                  <img src={i.url} alt={`第${i.week}周原始截图`} />
                  <span>第 {i.week} 周</span>
                </a>
              ))}
            </div>
            {warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </details>
          <div className="notice warning">
            实验性本地 OCR ·
            星期和节次来自课表网格，课程名、教室及重叠课程必须人工确认。
          </div>
          <div className="draft-list">
            {drafts.map((c) => (
              <div
                className="draft-card"
                key={c.id}
                style={{ borderLeftColor: c.color }}
              >
                <button className="draft-main" onClick={() => setEditing(c)}>
                  <strong>{c.name || '未命名课程'}</strong>
                  <span>
                    {c.location || '教室待补充'} · {c.teacher || '教师待补充'}
                  </span>
                  {c.meetings.map((m, i) => (
                    <small key={i}>
                      周{weekdays[m.weekday - 1]} · {m.startSection}–
                      {m.endSection}节 · 第{formatWeeks(m.weeks)}周
                    </small>
                  ))}
                  <small className="muted">
                    {state.semesters.find((s) => s.id === c.semesterId)?.name}
                  </small>
                </button>
                <div className="draft-actions">
                  <button
                    className="text-button"
                    aria-label={`编辑${c.name}`}
                    onClick={() => setEditing(c)}
                  >
                    编辑
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={`删除草稿${c.name}`}
                    onClick={() => {
                      setDrafts(drafts.filter((d) => d.id !== c.id))
                      setConflictAck(false)
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!drafts.length && (
            <div className="empty-state">
              <p>还没有课程草稿，点击“添加”补充课程。</p>
            </div>
          )}
          {errors.length > 0 && (
            <div className="notice error" role="alert">
              {errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}
          {conflicts.length > 0 && (
            <div className="notice warning">
              <strong>发现 {conflicts.length} 处时间重叠</strong>
              {conflicts.map((c, i) => (
                <p key={i}>{c.message}</p>
              ))}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={conflictAck}
                  onChange={(e) => setConflictAck(e.target.checked)}
                />
                我已核对，保留这些重叠安排
              </label>
            </div>
          )}
          <div className="import-footer">
            <button className="secondary" onClick={() => setStep(1)}>
              返回上传
            </button>
            <button
              className="primary"
              disabled={
                !drafts.length ||
                errors.length > 0 ||
                (conflicts.length > 0 && !conflictAck)
              }
              onClick={commit}
            >
              确认导入 {drafts.length} 门<Check size={18} />
            </button>
          </div>
        </>
      )}
      {step === 3 && (
        <div className="success-card">
          <div className="success-icon">
            <CheckCircle2 size={44} />
          </div>
          <span className="eyebrow">ALL SET</span>
          <h2>新安排，已就位。</h2>
          <p>{success}</p>
          <p>
            已经保存在当前浏览器中。
            <br />
            随时可以点击课程修改细节。
          </p>
          <button className="primary full" onClick={onView}>
            查看导入周课表
            <ArrowRight size={17} />
          </button>
          <button
            className="secondary full"
            onClick={() => {
              setStep(1)
              setDrafts([])
              images.forEach((i) => URL.revokeObjectURL(i.url))
              setImages([])
            }}
          >
            继续导入其他周
          </button>
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {lastBatch && (
        <div className="undo-card">
          <div>
            <strong>最近一次导入</strong>
            <span>
              {new Date(lastBatch.createdAt).toLocaleString('zh-CN')} ·{' '}
              {lastBatch.imageNames.length} 张图片
            </span>
          </div>
          <button
            className="text-button"
            onClick={() => {
              onUndo()
              if (step === 3) setStep(1)
            }}
          >
            <Undo2 size={16} />
            撤销导入
          </button>
        </div>
      )}
      {editing && (
        <CourseEditor
          key={editing.id}
          course={editing}
          semesters={state.semesters}
          onSave={saveDraft}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
