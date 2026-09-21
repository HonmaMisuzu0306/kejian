import { expect, it, vi } from 'vitest'
import { assignLanes } from './layout'
import { createId } from './id'
import type { Weekday } from './types'

const entry = (
  key: string,
  start: number,
  end: number,
  weekday: Weekday = 1,
) => ({
  key,
  meeting: { weekday, startSection: start, endSection: end, weeks: [1] },
})
it('链式重叠共用列宽，前后不重叠的课程复用列', () => {
  const lanes = assignLanes([
    entry('a', 1, 2),
    entry('b', 2, 3),
    entry('c', 3, 4),
  ])
  expect(lanes.get('a')).toEqual({ lane: 0, count: 2 })
  expect(lanes.get('b')).toEqual({ lane: 1, count: 2 })
  expect(lanes.get('c')).toEqual({ lane: 0, count: 2 })
})
it('三重重叠与不同星期、独立时段正确分组', () => {
  const lanes = assignLanes([
    entry('a', 1, 4),
    entry('b', 2, 3),
    entry('c', 3, 5),
    entry('d', 7, 8),
    entry('e', 1, 2, 2),
  ])
  expect(lanes.get('c')).toEqual({ lane: 2, count: 3 })
  expect(lanes.get('d')).toEqual({ lane: 0, count: 1 })
  expect(lanes.get('e')).toEqual({ lane: 0, count: 1 })
})
it('无 randomUUID 的 HTTP 环境仍生成有效独立 UUID', () => {
  const secureCrypto = globalThis.crypto
  vi.stubGlobal('crypto', {
    getRandomValues: secureCrypto.getRandomValues.bind(secureCrypto),
  })
  try {
    const ids = Array.from({ length: 100 }, createId)
    expect(new Set(ids).size).toBe(100)
    expect(
      ids.every((id) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          id,
        ),
      ),
    ).toBe(true)
  } finally {
    vi.unstubAllGlobals()
  }
})
