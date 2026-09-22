import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const resourcesRoot = path.join(
  projectRoot,
  'android',
  'app',
  'src',
  'main',
  'res',
)
const sourceIcon = path.join(projectRoot, 'public', 'icon.svg')

const densities = {
  mdpi: { legacy: 48, adaptive: 108 },
  hdpi: { legacy: 72, adaptive: 162 },
  xhdpi: { legacy: 96, adaptive: 216 },
  xxhdpi: { legacy: 144, adaptive: 324 },
  xxxhdpi: { legacy: 192, adaptive: 432 },
}

const foregroundSvg = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <path d="M82 70h348v324l-48 48H82z" fill="#f4f4f0"/>
    <path d="M82 70h348v80H82z" fill="#f1df00"/>
    <path d="M137 40v68M355 40v68" stroke="#f4f4f0" stroke-width="24"/>
    <path d="M137 211h238M137 283h238M137 355h164" stroke="#151817" stroke-width="20"/>
    <path d="M137 191v184M236 191v184M335 191v128" stroke="#747873" stroke-width="8" opacity=".42"/>
    <path d="M335 355h95v39l-48 48h-47z" fill="#151817"/>
    <path d="M361 387h39" stroke="#f1df00" stroke-width="10"/>
  </svg>
`)

for (const [density, sizes] of Object.entries(densities)) {
  const target = path.join(resourcesRoot, `mipmap-${density}`)
  const legacy = await sharp(sourceIcon)
    .resize(sizes.legacy, sizes.legacy)
    .png()
    .toBuffer()

  await sharp(legacy).toFile(path.join(target, 'ic_launcher.png'))
  await sharp(legacy)
    .composite([
      {
        input: Buffer.from(
          `<svg width="${sizes.legacy}" height="${sizes.legacy}"><circle cx="${sizes.legacy / 2}" cy="${sizes.legacy / 2}" r="${sizes.legacy / 2}" fill="white"/></svg>`,
        ),
        blend: 'dest-in',
      },
    ])
    .png()
    .toFile(path.join(target, 'ic_launcher_round.png'))

  await sharp({
    create: {
      width: sizes.adaptive,
      height: sizes.adaptive,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: await sharp(foregroundSvg)
          .resize(
            Math.round(sizes.adaptive * 0.72),
            Math.round(sizes.adaptive * 0.72),
          )
          .png()
          .toBuffer(),
        gravity: 'center',
      },
    ])
    .png()
    .toFile(path.join(target, 'ic_launcher_foreground.png'))
}

for (const directory of await readdir(resourcesRoot, { withFileTypes: true })) {
  if (!directory.isDirectory() || !directory.name.startsWith('drawable'))
    continue

  const splashPath = path.join(resourcesRoot, directory.name, 'splash.png')
  let metadata
  try {
    metadata = await sharp(splashPath).metadata()
  } catch {
    continue
  }

  const width = metadata.width
  const height = metadata.height
  if (!width || !height) continue

  const logoSize = Math.round(Math.min(width, height) * 0.23)
  const wordmarkWidth = Math.round(logoSize * 1.8)
  const wordmarkHeight = Math.round(logoSize * 0.42)
  const logoTop = Math.round(height / 2 - logoSize * 0.72)
  const wordmarkTop = logoTop + logoSize + Math.round(logoSize * 0.15)
  const wordmark = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${wordmarkWidth}" height="${wordmarkHeight}" viewBox="0 0 ${wordmarkWidth} ${wordmarkHeight}">
      <rect x="0" y="0" width="${Math.max(3, Math.round(wordmarkWidth * 0.035))}" height="${wordmarkHeight}" fill="#f1df00"/>
      <text x="${Math.round(wordmarkWidth * 0.1)}" y="${Math.round(wordmarkHeight * 0.54)}" fill="#151817" font-family="Arial, sans-serif" font-size="${Math.round(wordmarkHeight * 0.48)}" font-weight="700" letter-spacing="${Math.max(1, Math.round(wordmarkHeight * 0.06))}">KEJIAN</text>
      <text x="${Math.round(wordmarkWidth * 0.1)}" y="${Math.round(wordmarkHeight * 0.86)}" fill="#747873" font-family="Arial, sans-serif" font-size="${Math.round(wordmarkHeight * 0.17)}" letter-spacing="${Math.max(1, Math.round(wordmarkHeight * 0.07))}">CAMPUS TIME TERMINAL</text>
    </svg>
  `)

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#e7e8e4',
    },
  })
    .composite([
      {
        input: await sharp(sourceIcon)
          .resize(logoSize, logoSize)
          .png()
          .toBuffer(),
        left: Math.round((width - logoSize) / 2),
        top: logoTop,
      },
      {
        input: wordmark,
        left: Math.round((width - wordmarkWidth) / 2),
        top: wordmarkTop,
      },
    ])
    .png()
    .toFile(splashPath)
}

console.log('Android launcher icons and splash screens generated.')
