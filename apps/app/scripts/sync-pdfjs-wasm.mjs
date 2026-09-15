/**
 * pdf.js fetches its wasm decoders (jbig2, openjpeg, qcms) from the `wasmUrl`
 * directory at runtime, and the bundler does not emit them. Copy pdfjs-dist's
 * wasm/ into public/ before dev and build so `/study/pdfjs-wasm/<file>` exists.
 * Without it the worker logs "Jbig2Error: JBig2 failed to initialize" and every
 * JBIG2 image (a figure, a scanned page) is skipped, silently.
 */
import { cp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const source = resolve(dirname(require.resolve('pdfjs-dist/package.json')), 'wasm')
const target = resolve(dirname(fileURLToPath(import.meta.url)), '../public/pdfjs-wasm')

await rm(target, { recursive: true, force: true })
await cp(source, target, { recursive: true })
console.log(`pdfjs wasm decoders -> ${target}`)
