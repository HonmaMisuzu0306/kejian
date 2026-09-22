export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type CourseMeeting = {
  weekday: Weekday
  startSection: number
  endSection: number
  weeks: number[]
}
export type ImportSource = {
  kind: 'screenshot-demo' | 'screenshot-local-ocr'
  batchId: string
  imageNames: string[]
}
export type Course = {
  id: string
  semesterId: string
  name: string
  teacher?: string
  location?: string
  color: string
  meetings: CourseMeeting[]
  source?: ImportSource
  createdAt: string
  updatedAt: string
}
export type Semester = {
  id: string
  name: string
  startDate: string
  totalWeeks: number
}
export type ImportBatch = {
  id: string
  createdAt: string
  imageNames: string[]
  importedCourseIds: string[]
  changes: { before: Course | null; after: Course }[]
  undoneAt?: string
}
export type ScheduleEvent = {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  location?: string
  notes?: string
  color: string
  createdAt: string
  updatedAt: string
}
export type AppState = {
  version: 2
  semesters: Semester[]
  activeSemesterId: string
  courses: Course[]
  batches: ImportBatch[]
  events: ScheduleEvent[]
}
export type RecognitionResult = {
  courses: Course[]
  warnings: string[]
  mode: 'demo' | 'local-ocr'
}
export interface TimetableImageRecognizer {
  recognize(input: {
    image: File
    semesterId: string
    weekNumber: number
    onProgress?: (progress: number, label: string) => void
  }): Promise<RecognitionResult>
}
