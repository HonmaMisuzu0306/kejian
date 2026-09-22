import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'

const screenshot = process.env.TIMETABLE_SCREENSHOT
if (!screenshot || !existsSync(screenshot))
  throw new Error('Set TIMETABLE_SCREENSHOT to a readable timetable image.')

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('pageerror', (error) => errors.push(error.message))

try {
  await page.goto('http://127.0.0.1:4173')
  const firstRun = page.getByRole('button', { name: '保存设置，开始使用' })
  if (await firstRun.isVisible()) await firstRun.click()
  await page.getByRole('button', { name: /导入/ }).last().click()
  await page.getByTestId('screenshot-input').setInputFiles(screenshot)
  await page.getByRole('button', { name: '开始本地识别' }).click()
  await page
    .getByRole('heading', { name: '识别草稿' })
    .waitFor({ timeout: 120_000 })
  const drafts = await page.locator('.draft-card').allTextContents()
  if (!drafts.length) throw new Error('OCR completed without course drafts.')
  await page.screenshot({
    path: 'test-results/mobile-local-ocr-drafts.png',
    fullPage: true,
  })
  console.log(
    JSON.stringify({ draftCount: drafts.length, drafts, errors }, null, 2),
  )
  if (errors.length) process.exitCode = 1
} finally {
  await browser.close()
}
