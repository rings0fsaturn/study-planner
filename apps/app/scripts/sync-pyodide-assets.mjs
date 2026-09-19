/**
 * Pyodide loads its runtime (wasm, stdlib, lockfile, loader) from `indexURL`
 * at runtime, and the bundler does not emit them. Copy the needed files from
 * the installed `pyodide` package into public/ before dev and build so
 * `/study/pyodide/<file>` exists - the same pattern as sync-pdfjs-wasm.mjs.
 */
import { copyFile, mkdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const source = dirname(require.resolve('pyodide/package.json'))
const target = resolve(dirname(fileURLToPath(import.meta.url)), '../public/pyodide')

const FILES = [
  'pyodide.asm.js',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
  'pyodide.mjs',
]

await rm(target, { recursive: true, force: true })
await mkdir(target, { recursive: true })
for (const file of FILES) {
  await copyFile(resolve(source, file), resolve(target, file))
}
console.log(`pyodide runtime -> ${target}`)
