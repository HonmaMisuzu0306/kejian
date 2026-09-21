import type { CourseMeeting } from './types'

type Entry = { key: string; meeting: CourseMeeting }
/** Connected overlapping intervals share a lane count; non-overlapping entries reuse lanes. */
export function assignLanes(entries: Entry[]) {
  const result = new Map<string, { lane: number; count: number }>()
  for (let day = 1; day <= 7; day++) {
    const sorted = entries
      .filter((e) => e.meeting.weekday === day)
      .sort(
        (a, b) =>
          a.meeting.startSection - b.meeting.startSection ||
          a.meeting.endSection - b.meeting.endSection ||
          a.key.localeCompare(b.key),
      )
    let group: Entry[] = []
    let end = 0
    function flush() {
      const laneEnds: number[] = []
      for (const entry of group) {
        let lane = laneEnds.findIndex(
          (value) => value < entry.meeting.startSection,
        )
        if (lane < 0) lane = laneEnds.length
        laneEnds[lane] = entry.meeting.endSection
        result.set(entry.key, { lane, count: 0 })
      }
      for (const entry of group) result.get(entry.key)!.count = laneEnds.length
      group = []
    }
    for (const entry of sorted) {
      if (entry.meeting.startSection > end) flush()
      group.push(entry)
      end = Math.max(end, entry.meeting.endSection)
    }
    flush()
  }
  return result
}
