import { colorFor, newCourse } from '../domain/courses'
import type { TimetableImageRecognizer, Weekday } from '../domain/types'

// This adapter is deliberately deterministic. It does NOT read image pixels.
// Replace this object with a real implementation; keep the draft-confirmation flow.
export const demoRecognizer: TimetableImageRecognizer = {
  async recognize({ semesterId, weekNumber }) {
    await new Promise((resolve) => setTimeout(resolve, 350))
    const rows: [string, string, Weekday, number, number][] = [
      ['电子技术基础', '揽江楼C303', 1, 3, 4],
      ['电子技术基础', '揽江楼C303', 3, 3, 4],
      ['学术英语（1）', '滨江BS211', 1, 5, 6],
      ['面向对象程序设计', '揽江楼N504', 1, 7, 8],
      ['体育（3）· 篮球', '中苑篮球场', 2, 7, 8],
      ['数据结构', '揽江楼C401', 3, 7, 8],
      ['数据结构', '揽江楼C401', 5, 5, 6],
      ['马克思主义基本原理', '揽江楼N205', 3, 9, 11],
      ['大学物理Ⅱ（2）', '阅江楼222', 4, 3, 4],
      ['大学物理实验Ⅱ', '藕舫楼208-210', 5, 1, 2],
      ['面向对象程序设计', '揽江楼C403', 5, 3, 4],
    ]
    return {
      mode: 'demo',
      warnings: [
        '当前为演示识别：任意图片均返回参考课表数据，未读取图片内容。',
        '截图中周一 5–6 节还出现“日语（一）”，可能有重叠课程，请对照原图手工确认。',
        '教师、教室文字和连续节次均需核对；未提供截图的其他周不会自动补全。',
      ],
      courses: rows.map(
        ([name, location, weekday, startSection, endSection]) => ({
          ...newCourse(semesterId, weekNumber),
          name,
          location,
          color: colorFor(name),
          meetings: [
            { weekday, startSection, endSection, weeks: [weekNumber] },
          ],
        }),
      ),
    }
  },
}
