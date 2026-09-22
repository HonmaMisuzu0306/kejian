import type { Weekday } from '../../domain/types'

export const NUIST_MOBILE_LAYOUT = {
  minAspectRatio: 0.38,
  maxAspectRatio: 0.58,
  gridLeft: 0.107,
  gridTop: 0.266,
  columnWidth: 0.1276,
  rowHeight: 0.0631,
  weekdays: 7,
  sections: 11,
} as const

export type CellColor = { r: number; g: number; b: number }
export type CourseBlock = {
  weekday: Weekday
  startSection: number
  endSection: number
  color: CellColor
}

const distance = (a: CellColor, b: CellColor) =>
  Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b)

const median = (values: number[]) => {
  const ordered = [...values].sort((a, b) => a - b)
  return ordered[Math.floor(ordered.length / 2)] ?? 255
}

export function detectCourseBlocks(cells: CellColor[][]): CourseBlock[] {
  const all = cells.flat()
  const empty = {
    r: median(all.map((cell) => cell.r)),
    g: median(all.map((cell) => cell.g)),
    b: median(all.map((cell) => cell.b)),
  }
  const blocks: CourseBlock[] = []
  for (let day = 0; day < NUIST_MOBILE_LAYOUT.weekdays; day++) {
    let section = 0
    while (section < NUIST_MOBILE_LAYOUT.sections) {
      const current = cells[section]?.[day]
      if (!current || distance(current, empty) < 6) {
        section++
        continue
      }
      let end = section
      while (
        end + 1 < NUIST_MOBILE_LAYOUT.sections &&
        distance(cells[end + 1][day], empty) >= 6 &&
        distance(cells[end + 1][day], current) < 1.9
      )
        end++
      blocks.push({
        weekday: (day + 1) as Weekday,
        startSection: section + 1,
        endSection: end + 1,
        color: current,
      })
      section = end + 1
    }
  }
  return blocks
}

const locationCorrections: [RegExp, string][] = [
  [/[扩扫抗拟撇擅拓撕执摔][江浇]楼/gu, '揽江楼'],
  [/[糖车][护盘舫]楼/gu, '藕舫楼'],
  [/[演滨]江BS/gu, '滨江BS'],
  [/中苑篮球[声生]/gu, '中苑篮球场'],
  [/蓝球场/gu, '篮球场'],
]

function clean(text: string) {
  return text
    .replace(/[|丨]/gu, '')
    .replace(/[“”'`]/gu, '')
    .replace(/\s+/gu, '')
    .replace(/[，。；;]+$/gu, '')
}

export function parseRecognizedCourse(rawText: string): {
  name: string
  location?: string
} {
  let compact = clean(rawText)
  for (const [pattern, replacement] of locationCorrections)
    compact = compact.replace(pattern, replacement)

  const knownLocation = compact.match(
    /(揽江楼|阅江楼|藕舫楼|滨江BS|中苑篮球场)[A-Z]?\d{0,3}(?:-\d{1,3})?/u,
  )
  if (knownLocation?.index !== undefined) {
    return {
      name: compact.slice(0, knownLocation.index),
      location: knownLocation[0],
    }
  }

  const genericMarker = compact.search(/[楼馆室场]/u)
  if (genericMarker >= 0) {
    const locationStart = Math.max(0, genericMarker - 2)
    return {
      name: compact.slice(0, locationStart),
      location: compact.slice(locationStart),
    }
  }
  return { name: compact }
}

export function isSupportedNuistScreenshot(width: number, height: number) {
  const ratio = width / height
  return (
    width >= 720 &&
    height >= 1400 &&
    ratio >= NUIST_MOBILE_LAYOUT.minAspectRatio &&
    ratio <= NUIST_MOBILE_LAYOUT.maxAspectRatio
  )
}
