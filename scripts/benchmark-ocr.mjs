// Private screenshots are read only from an explicit local path, never committed.
// Start Vite on port 4174, then set TIMETABLE_SCREENSHOT and run this script.
import { chromium } from '@playwright/test'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import sharp from 'sharp'

const filename = process.env.TIMETABLE_SCREENSHOT
if (!filename)
  throw new Error(
    'Set TIMETABLE_SCREENSHOT to the original NUIST reference screenshot.',
  )
const expected = [
  [1, 3, 4, '电子技术基础', '揽江楼C303'],
  [1, 5, 6, '学术英语(1)', '滨江BS211'],
  [1, 7, 8, '面向对象程序设计', '揽江楼N504'],
  [2, 7, 8, '体育(3)', '中苑篮球场'],
  [3, 3, 4, '电子技术基础', '揽江楼C303'],
  [3, 7, 8, '数据结构', '揽江楼C401'],
  [3, 9, 11, '马克思主义基本原理', '揽江楼N205'],
  [4, 3, 4, '大学物理II(2)', '阅江楼222'],
  [5, 1, 2, '大学物理实验II', '藕舫楼208-210'],
  [5, 3, 4, '面向对象程序设计', '揽江楼C403'],
  [5, 5, 6, '数据结构', '揽江楼C401'],
]
const normalize = (text = '') => text.normalize('NFKC').replace(/\s/g, '')
const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const image = await readFile(filename)
await mkdir('test-results', { recursive: true })
const reports = []
try {
  await page.goto('http://127.0.0.1:4174')
  const variants = [
    ['original', image],
    ['resized-75', await sharp(image).resize({ width: 810 }).png().toBuffer()],
    [
      'header-shift-60',
      await sharp(image)
        .extend({ top: 60, bottom: 0, left: 0, right: 0, background: '#fff' })
        .png()
        .toBuffer(),
    ],
  ]
  if (process.env.OCR_COMPARE_BASELINE === '1') {
    const original = execFileSync(
      'git',
      ['show', 'v1.0.1:src/services/recognizer.ts'],
      { encoding: 'utf8' },
    )
      .replaceAll('../domain/', '/src/domain/')
      .replaceAll('./recognizers/nuistLayout', '/test-results/baseline-layout')
      .replace("asset('ocr/lang')", "asset('test-results/ocr-baseline-model')")
    const layout = execFileSync(
      'git',
      ['show', 'v1.0.1:src/services/recognizers/nuistLayout.ts'],
      { encoding: 'utf8' },
    )
    await writeFile('test-results/baseline-recognizer.ts', original)
    await writeFile('test-results/baseline-layout.ts', layout)
    await mkdir('test-results/ocr-baseline-model', { recursive: true })
    await writeFile(
      'test-results/ocr-baseline-model/chi_sim.traineddata',
      gunzipSync(
        await readFile(
          'node_modules/@tesseract.js-data/chi_sim/4.0.0_best_int/chi_sim.traineddata.gz',
        ),
      ),
    )
    variants.unshift(['baseline-v1.0.1', image])
  }
  for (const [variant, buffer] of variants) {
    const started = Date.now()
    const result = await page.evaluate(
      async ({ bytes, baseline }) => {
        const module = await import(
          baseline
            ? '/test-results/baseline-recognizer.ts'
            : '/src/services/recognizer.ts'
        )
        return module.nuistScreenshotRecognizer.recognize({
          image: new File([new Uint8Array(bytes)], 'reference.png', {
            type: 'image/png',
          }),
          semesterId: 'benchmark',
          weekNumber: 3,
        })
      },
      { bytes: [...buffer], baseline: variant.startsWith('baseline') },
    )
    const rows = expected.map(([day, start, end, name, location]) => {
      const actual = result.courses.find((c) =>
        c.meetings.some(
          (m) =>
            m.weekday === day &&
            m.startSection === start &&
            m.endSection === end,
        ),
      )
      return {
        slot: `${day}/${start}-${end}`,
        expected: { name, location },
        actual: actual
          ? { name: actual.name, location: actual.location }
          : null,
        nameCorrect: normalize(actual?.name) === normalize(name),
        locationCorrect: normalize(actual?.location) === normalize(location),
      }
    })
    const report = {
      variant,
      milliseconds: Date.now() - started,
      count: result.courses.length,
      correctNames: rows.filter((r) => r.nameCorrect).length,
      correctLocations: rows.filter((r) => r.locationCorrect).length,
      fullyCorrect: rows.filter((r) => r.nameCorrect && r.locationCorrect)
        .length,
      rows,
      warnings: result.warnings,
    }
    reports.push(report)
    console.log(
      JSON.stringify({
        variant,
        count: report.count,
        correctNames: report.correctNames,
        correctLocations: report.correctLocations,
        fullyCorrect: report.fullyCorrect,
        milliseconds: report.milliseconds,
      }),
    )
    if (
      !variant.startsWith('baseline') &&
      (report.count !== 11 ||
        report.correctNames < 9 ||
        report.correctLocations < 10)
    )
      process.exitCode = 1
  }
  if (errors.length) {
    console.error(errors)
    process.exitCode = 1
  }
  await writeFile(
    'test-results/ocr-accuracy.json',
    JSON.stringify({ reports, errors }, null, 2),
  )
} finally {
  await browser.close()
}
