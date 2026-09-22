import { describe, expect, it } from 'vitest'
import { validateState } from './storage'

describe('本地数据迁移', () => {
  it('将 v1 数据无损迁移为带个人日程的 v2 结构', () => {
    const value = validateState({
      version: 1,
      semesters: [],
      activeSemesterId: '',
      courses: [],
      batches: [],
    })
    expect(value.version).toBe(2)
    expect(value.events).toEqual([])
  })
})
