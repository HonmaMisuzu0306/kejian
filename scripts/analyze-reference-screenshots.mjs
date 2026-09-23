// Local-only batch analysis. The source images and generated report are ignored by Git.
import { chromium } from '@playwright/test'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const sourceDirectory = path.join(process.cwd(), '参考课表截图')
const names = (await readdir(sourceDirectory))
  .filter((name) => /\.(?:jpe?g|png|webp)$/i.test(name))
  .sort()
if (!names.length) throw new Error('参考课表截图文件夹中没有图片。')
await mkdir('test-results', { recursive: true })

const thumbWidth = 216
const thumbHeight = 480
const columns = 6
const rows = Math.ceil(names.length / columns)
const contactSheet = sharp({
  create: {
    width: thumbWidth * columns,
    height: thumbHeight * rows,
    channels: 3,
    background: '#ffffff',
  },
})
const thumbnails = await Promise.all(
  names.map(async (name, index) => ({
    input: await sharp(path.join(sourceDirectory, name))
      .resize({ width: thumbWidth, height: thumbHeight, fit: 'contain' })
      .jpeg({ quality: 82 })
      .toBuffer(),
    left: (index % columns) * thumbWidth,
    top: Math.floor(index / columns) * thumbHeight,
  })),
)
await contactSheet
  .composite(thumbnails)
  .jpeg({ quality: 88 })
  .toFile('test-results/reference-contact-sheet.jpg')

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage()
const reports = []
try {
  await page.goto('http://127.0.0.1:4174')
  for (let index = 0; index < names.length; index++) {
    const name = names[index]
    const bytes = await readFile(path.join(sourceDirectory, name))
    const started = Date.now()
    try {
      const result = await page.evaluate(
        async ({ bytes, name, weekNumber }) => {
          const { nuistScreenshotRecognizer } =
            await import('/src/services/recognizer.ts')
          return nuistScreenshotRecognizer.recognize({
            image: new File([new Uint8Array(bytes)], name, {
              type: 'image/jpeg',
            }),
            semesterId: 'reference-analysis',
            weekNumber,
          })
        },
        { bytes: [...bytes], name, weekNumber: index + 1 },
      )
      reports.push({
        index: index + 1,
        name,
        milliseconds: Date.now() - started,
        courseCount: result.courses.length,
        courses: result.courses.map((course) => ({
          name: course.name,
          location: course.location,
          meeting: course.meetings[0],
        })),
        warnings: result.warnings,
      })
      console.log(
        `${index + 1}/${names.length} ${name}: ${result.courses.length} 门`,
      )
    } catch (error) {
      reports.push({
        index: index + 1,
        name,
        milliseconds: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      })
      console.error(`${index + 1}/${names.length} ${name}: 失败`)
    }
  }
} finally {
  await browser.close()
}
await writeFile(
  'test-results/reference-ocr-report.json',
  JSON.stringify(reports, null, 2),
)
if (reports.some((report) => report.error)) process.exitCode = 1
