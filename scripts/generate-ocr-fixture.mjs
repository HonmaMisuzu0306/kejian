import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const width = 1080
const height = 2400
const gridLeft = Math.round(width * 0.107)
const gridTop = Math.round(height * 0.266)
const columnWidth = Math.round(width * 0.1276)
const rowHeight = Math.round(height * 0.0631)
const blocks = [
  {
    day: 1,
    start: 3,
    end: 4,
    fill: '#f0f3fc',
    ink: '#a3a1e7',
    lines: ['线性代数', '揽江楼C', '303'],
  },
  {
    day: 3,
    start: 7,
    end: 8,
    fill: '#f9f3e7',
    ink: '#e7bd6c',
    lines: ['计算机', '网络', '揽江楼', 'C401'],
  },
  {
    day: 5,
    start: 1,
    end: 2,
    fill: '#edf6fa',
    ink: '#6ebbd9',
    lines: ['大学物', '理Ⅱ', '阅江楼', '222'],
  },
]

const lines = []
for (let row = 0; row <= 11; row++) {
  const y = gridTop + row * rowHeight
  lines.push(`<path d="M${gridLeft} ${y}H1080"/>`)
}
for (let column = 0; column <= 7; column++) {
  const x = gridLeft + column * columnWidth
  lines.push(`<path d="M${x} ${gridTop}V${gridTop + rowHeight * 11}"/>`)
}
const courses = blocks.map((block) => {
  const x = gridLeft + (block.day - 1) * columnWidth + 2
  const y = gridTop + (block.start - 1) * rowHeight + 2
  const blockHeight = (block.end - block.start + 1) * rowHeight - 4
  return `<g><rect x="${x}" y="${y}" width="${columnWidth - 4}" height="${blockHeight}" fill="${block.fill}"/><text font-family="Microsoft YaHei" font-size="27" fill="${block.ink}">${block.lines.map((line, index) => `<tspan x="${x + 10}" y="${y + 36 + index * 38}">${line}</tspan>`).join('')}</text></g>`
})

const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f9fafc"/><rect x="0" y="0" width="100%" height="${gridTop}" fill="#ffffff"/>${courses.join('')}<g fill="none" stroke="#dde2e7" stroke-width="2">${lines.join('')}</g></svg>`
const outputDirectory = join(process.cwd(), 'tests', '.generated')
await mkdir(outputDirectory, { recursive: true })
await sharp(Buffer.from(svg))
  .png()
  .toFile(join(outputDirectory, 'nuist-synthetic.png'))

const noGridSvg = svg.replace(
  /<g fill="none" stroke="#dde2e7" stroke-width="2">.*?<\/g>/,
  '',
)
await sharp(Buffer.from(noGridSvg))
  .png()
  .toFile(join(outputDirectory, 'nuist-synthetic-no-grid.png'))
