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
  { day: 1, start: 3, end: 4, fill: '#f0f3fc', name: 'MATH 101' },
  { day: 3, start: 7, end: 8, fill: '#f9f3e7', name: 'DATA 201' },
  { day: 5, start: 1, end: 2, fill: '#edf6fa', name: 'PHYSICS' },
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
  return `<g><rect x="${x}" y="${y}" width="${columnWidth - 4}" height="${blockHeight}" fill="${block.fill}"/><text x="${x + 12}" y="${y + 56}" font-family="Arial" font-size="27" fill="#30485c">${block.name}<tspan x="${x + 12}" dy="38">ROOM 201</tspan></text></g>`
})

const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f9fafc"/><rect x="0" y="0" width="100%" height="${gridTop}" fill="#ffffff"/>${courses.join('')}<g fill="none" stroke="#dde2e7" stroke-width="2">${lines.join('')}</g></svg>`
const outputDirectory = join(process.cwd(), 'tests', '.generated')
await mkdir(outputDirectory, { recursive: true })
await sharp(Buffer.from(svg))
  .png()
  .toFile(join(outputDirectory, 'nuist-synthetic.png'))
