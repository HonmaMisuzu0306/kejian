import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'

const screenshot =
  process.env.TIMETABLE_SCREENSHOT ??
  path.join(process.cwd(), 'tests', '.generated', 'nuist-synthetic.png')
async function setup(page: Page) {
  await page.clock.install({ time: new Date('2026-09-14T07:30:00+08:00') })
  await page.goto('/')
  await page.getByRole('button', { name: '保存设置，开始使用' }).click()
  await page.clock.fastForward(6000)
}
async function tab(page: Page, name: string) {
  await page
    .getByRole('navigation', { name: '手机主导航' })
    .getByRole('button', { name, exact: true })
    .click()
}
async function generate(page: Page, week = 3, image = screenshot) {
  await tab(page, '导入')
  await page.getByTestId('screenshot-input').setInputFiles(image)
  await page.getByRole('spinbutton', { name: '截图1周次' }).fill(String(week))
  await page.getByRole('button', { name: '开始本地识别' }).click()
  await expect(page.getByRole('heading', { name: '识别草稿' })).toBeVisible({
    timeout: 120_000,
  })
}

test('浅色中文课表识别出正确课程名、教室和罗马数字，离线仍可扫描', async ({
  page,
  context,
}) => {
  await setup(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true)
  await context.setOffline(true)
  await generate(
    page,
    3,
    path.join(
      process.cwd(),
      'tests',
      '.generated',
      'nuist-synthetic-no-grid.png',
    ),
  )
  await expect(page.locator('.draft-card')).toHaveCount(3)
  for (const [name, location] of [
    ['线性代数', '揽江楼C303'],
    ['计算机网络', '揽江楼C401'],
    ['大学物理II', '阅江楼222'],
  ]) {
    const card = page.locator('.draft-card').filter({ hasText: name })
    await expect(card).toHaveCount(1)
    await expect(card).toContainText(location)
  }
  await page.getByText('查看原图与识别提示').click()
  await expect(page.getByText(/网格线较浅/)).toBeVisible()
})

test('390px 截图导入、增删改、保存、刷新、重复导入及撤销完整流程', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await setup(page)
  await expect(page.getByText('今天没有课程或个人日程')).toBeVisible()
  await generate(page)
  await expect(page.getByText('实验性本地 OCR', { exact: false })).toBeVisible()
  await page.screenshot({ path: 'test-results/mobile-drafts.png' })
  const recognizedCount = await page.locator('.draft-card').count()
  expect(recognizedCount).toBeGreaterThan(0)
  await page.locator('.draft-card .draft-main').first().click()
  await page.screenshot({ path: 'test-results/mobile-editor.png' })
  await page.getByLabel('课程名称').fill('电子技术基础（已校对）')
  await page.getByLabel('教师', { exact: true }).fill('测试教师')
  await page.getByRole('button', { name: '保存课程', exact: true }).click()
  await page.locator('.draft-card .icon-button.danger').nth(1).click()
  await page.getByRole('button', { name: '添加', exact: true }).click()
  await page.getByLabel('课程名称').fill('自习')
  await page.getByLabel('安排1星期').selectOption('6')
  await page.getByLabel('安排1周次').fill('3,5-6')
  await page.getByRole('button', { name: '保存课程', exact: true }).click()
  await page.getByRole('button', { name: /确认导入/ }).click()
  await expect(page.getByText('新安排，已就位。')).toBeVisible()
  await page.getByRole('button', { name: '查看导入周课表' }).click()
  await expect(
    page.getByRole('button', {
      name: '电子技术基础（已校对） 周一 第3到4节',
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '自习 周六 第1到2节', exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'test-results/mobile-week.png',
    fullPage: true,
  })
  await page.reload()
  await tab(page, '课表')
  await expect(
    page.getByRole('button', {
      name: '电子技术基础（已校对） 周一 第3到4节',
      exact: true,
    }),
  ).toBeVisible()
  await tab(page, '今日')
  await expect(
    page
      .getByRole('heading', { name: '电子技术基础（已校对）', exact: true })
      .first(),
  ).toBeVisible()
  await page.screenshot({
    path: 'test-results/mobile-home.png',
    fullPage: true,
  })
  await tab(page, '导入')
  await page.getByRole('button', { name: '撤销导入', exact: true }).click()
  await tab(page, '课表')
  await expect(page.locator('.grid-course')).toHaveCount(0)
  await generate(page)
  await page.getByRole('button', { name: /确认导入/ }).click()
  await page.getByRole('button', { name: '继续导入其他周' }).click()
  await page.getByTestId('screenshot-input').setInputFiles(screenshot)
  await page.getByRole('button', { name: '开始本地识别' }).click()
  await expect(page.getByRole('heading', { name: '识别草稿' })).toBeVisible({
    timeout: 120_000,
  })
  await page.getByRole('button', { name: /确认导入/ }).click()
  await expect(
    page.getByText(/新增 0 门 · 更新 0 门 · 跳过 \d+ 门重复课程/),
  ).toBeVisible()
  await tab(page, '设置')
  await expect(
    page.getByText(/保存了 \d+ 门课程、0 条个人日程和 2 条导入记录/),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('多周合并、冲突提醒、周次校验、保留导入后的编辑', async ({ page }) => {
  await setup(page)
  await tab(page, '导入')
  await page
    .getByTestId('screenshot-input')
    .setInputFiles([screenshot, screenshot])
  await page.getByRole('spinbutton', { name: '截图2周次' }).fill('5')
  await page.getByRole('button', { name: '开始本地识别' }).click()
  await expect(page.getByRole('heading', { name: '识别草稿' })).toBeVisible({
    timeout: 120_000,
  })
  await expect(page.locator('.draft-card').first()).toContainText('第3,5周')
  await page.getByRole('button', { name: '添加', exact: true }).click()
  await page.getByLabel('课程名称').fill('重叠测试')
  await page.getByLabel('安排1开始节次').selectOption('3')
  await page.getByLabel('安排1结束节次').selectOption('4')
  await page.getByLabel('安排1周次').fill('21')
  await page.getByRole('button', { name: '保存课程', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('周次应在')
  await page.getByLabel('安排1周次').fill('3')
  await page.getByRole('button', { name: '保存课程', exact: true }).click()
  await expect(page.getByRole('button', { name: /确认导入/ })).toBeDisabled()
  await page
    .getByRole('checkbox', { name: '我已核对，保留这些重叠安排' })
    .check()
  await page.getByRole('button', { name: /确认导入/ }).click()
  await page.getByRole('button', { name: '查看导入周课表' }).click()
  await page
    .getByRole('button', { name: '重叠测试 周一 第3到4节', exact: true })
    .click()
  await page.getByLabel('课程名称').fill('修改后保留')
  await page.getByRole('button', { name: '保存课程', exact: true }).click()
  await tab(page, '导入')
  await page.getByRole('button', { name: '撤销导入', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('已被编辑')
})

test('PWA 正式构建可离线刷新，桌面布局与备份正常', async ({
  page,
  context,
}) => {
  await setup(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: '今日调度' })).toBeVisible()
  await tab(page, '设置')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出档案（JSON）' }).click()
  expect((await download).suggestedFilename()).toContain('课间备份')
  await context.setOffline(false)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page
    .getByRole('navigation', { name: '桌面主导航' })
    .getByRole('button', { name: '今日', exact: true })
    .click()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: path.join('test-results', 'desktop-home.png'),
    fullPage: true,
  })
})

test('HTTP 兼容模式与两周短学期可完成导入', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'randomUUID', {
      value: undefined,
      configurable: true,
    })
  })
  await page.goto('/')
  await page.getByLabel('学期总周数').fill('2')
  await page.getByRole('button', { name: '保存设置，开始使用' }).click()
  await tab(page, '导入')
  await page.getByTestId('screenshot-input').setInputFiles(screenshot)
  await expect(page.getByRole('spinbutton', { name: '截图1周次' })).toHaveValue(
    '2',
  )
  await page.screenshot({ path: 'test-results/mobile-upload.png' })
  await page.getByRole('button', { name: '开始本地识别' }).click()
  await expect(page.getByRole('heading', { name: '识别草稿' })).toBeVisible({
    timeout: 120_000,
  })
  await page.getByRole('button', { name: /确认导入/ }).click()
  await expect(page.getByText('新安排，已就位。')).toBeVisible()
})

test('导入其他学期后打开正确的学期和周次', async ({ page }) => {
  await setup(page)
  const originalSemester = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('kejian.app.v1')!)
        .activeSemesterId as string,
  )
  await tab(page, '设置')
  await page.getByRole('button', { name: '新建学期', exact: true }).click()
  await page.getByLabel('学期名称').fill('第二学期测试')
  await page.getByRole('button', { name: '保存学期设置' }).click()
  await tab(page, '导入')
  await page.getByTestId('screenshot-input').setInputFiles(screenshot)
  await page.getByLabel('截图1学期').selectOption(originalSemester)
  await page.getByRole('spinbutton', { name: '截图1周次' }).fill('5')
  await page.getByRole('button', { name: '开始本地识别' }).click()
  await expect(page.getByRole('heading', { name: '识别草稿' })).toBeVisible({
    timeout: 120_000,
  })
  await page.getByRole('button', { name: /确认导入/ }).click()
  await page.getByRole('button', { name: '查看导入周课表' }).click()
  await expect(page.locator('.week-switch')).toContainText('WEEK_05')
  await expect(page.locator('.grid-course').first()).toBeVisible()
})

test('工业视觉在关键宽度、长课程名、编辑器和减少动效模式下保持可用', async ({
  page,
}) => {
  await setup(page)
  await generate(page)
  await page.locator('.draft-card .draft-main').first().click()
  await page
    .getByLabel('课程名称')
    .fill('电子技术基础与智能系统综合实践课程超长名称校对样本')
  await page.getByRole('button', { name: '保存课程', exact: true }).click()
  const importFooter = page.locator('.import-footer')
  await importFooter.scrollIntoViewIfNeeded()
  const footerBox = await importFooter.boundingBox()
  const navBox = await page
    .getByRole('navigation', { name: '手机主导航' })
    .boundingBox()
  expect(footerBox).not.toBeNull()
  expect(navBox).not.toBeNull()
  expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(navBox!.y + 1)
  await page.getByRole('button', { name: /确认导入/ }).click()
  await page.getByRole('button', { name: '查看导入周课表' }).click()

  for (const width of [360, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 641 ? 844 : 960 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `${width}px 不应出现页面级横向滚动`,
    ).toBe(true)
    await expect(page.locator('.timetable')).toBeVisible()
  }

  await page.screenshot({
    path: 'test-results/desktop-week.png',
    fullPage: true,
  })
  await page
    .getByRole('button', {
      name: '电子技术基础与智能系统综合实践课程超长名称校对样本 周一 第3到4节',
      exact: true,
    })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: '关闭编辑' }).click()

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page
    .getByRole('navigation', { name: '桌面主导航' })
    .getByRole('button', { name: '今日', exact: true })
    .click()
  const animationDuration = await page
    .locator('.page-heading')
    .evaluate((element) => getComputedStyle(element).animationDuration)
  expect(parseFloat(animationDuration)).toBeLessThan(1)
})

test('个人日程可创建、编辑、刷新保留并删除', async ({ page }) => {
  await setup(page)
  await tab(page, '日程')
  await expect(page.getByRole('heading', { name: '日程时间轴' })).toBeVisible()
  await page.getByRole('button', { name: '在 09:30 创建日程' }).click()
  await page.getByLabel('日程标题').fill('图书馆自习')
  await page.getByLabel('结束时间').fill('10:45')
  await page.getByLabel('地点', { exact: true }).fill('图书馆三楼')
  await page.getByLabel('备注').fill('复习数据结构')
  await page.getByRole('button', { name: '保存日程', exact: true }).click()
  await expect(
    page.getByRole('button', {
      name: '日程 图书馆自习 09:30到10:45',
      exact: true,
    }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'test-results/mobile-agenda.png',
    fullPage: true,
  })

  await page.reload()
  await tab(page, '日程')
  await page
    .getByRole('button', {
      name: '日程 图书馆自习 09:30到10:45',
      exact: true,
    })
    .click()
  await page.getByLabel('日程标题').fill('图书馆自习（已调整）')
  await page.getByRole('button', { name: '保存日程', exact: true }).click()
  await tab(page, '今日')
  await expect(
    page
      .getByRole('button', { name: '09:30 10:45' })
      .getByRole('heading', { name: '图书馆自习（已调整）' }),
  ).toBeVisible()
  await tab(page, '日程')

  await page.setViewportSize({ width: 1440, height: 960 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'test-results/desktop-agenda.png',
    fullPage: true,
  })
  await page
    .getByRole('button', {
      name: '日程 图书馆自习（已调整） 09:30到10:45',
      exact: true,
    })
    .click()
  await page.getByRole('button', { name: '删除日程', exact: true }).click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await expect(
    page.getByRole('button', {
      name: '日程 图书馆自习（已调整） 09:30到10:45',
      exact: true,
    }),
  ).toHaveCount(0)
})
