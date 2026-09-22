import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { gunzip } from 'node:zlib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const output = join(root, 'public', 'ocr')
await mkdir(join(output, 'core'), { recursive: true })
await mkdir(join(output, 'lang'), { recursive: true })
await rm(join(output, 'lang', 'chi_sim.traineddata.gz'), { force: true })

await copyFile(
  join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'),
  join(output, 'worker.min.js'),
)
for (const name of [
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js',
])
  await copyFile(
    join(root, 'node_modules', 'tesseract.js-core', name),
    join(output, 'core', name),
  )
const languageArchive = await readFile(
  join(
    root,
    'node_modules',
    '@tesseract.js-data',
    'chi_sim',
    '4.0.0_best_int',
    'chi_sim.traineddata.gz',
  ),
)
await writeFile(
  join(output, 'lang', 'chi_sim.traineddata'),
  await promisify(gunzip)(languageArchive),
)

console.log('OCR assets ready in public/ocr')
