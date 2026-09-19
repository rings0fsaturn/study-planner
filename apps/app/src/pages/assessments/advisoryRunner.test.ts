/**
 * Coding advisory runner tests (#42 D-03): the visible-tests-only contract.
 * Pyodide is mocked at the import boundary - these tests pin the harness
 * semantics (whole-program execution per test, stdin bound as a value,
 * sandbox-normalized comparison), not the wasm runtime.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetAdvisoryLoaderForTests } from './advisoryRunner'
import type { VisibleTestCase } from '../../assessments/types'

const TESTS: VisibleTestCase[] = [
  { name: 'adds small list', stdin: '[1, 2, 3]', expectedOutput: '6\n' },
  { name: 'handles empty list', stdin: '[]', expectedOutput: '0\n' },
]

/**
 * Script a Pyodide double. `printed[i]` is what the harness emits on stdout
 * for the i-th test; `failure` makes every harness run throw. `seen`
 * records the source/stdin bound per test.
 */
function scriptPyodide(script: { printed?: string[]; failure?: string }) {
  const seen: Array<{ source: unknown; stdin: unknown }> = []
  let handlers: { batched(s: string): void } = { batched: () => {} }
  let run = 0
  const bound = new Map<string, unknown>()
  const mock = {
    runPython: vi.fn((code: string): unknown => {
      // Only the execution harness reaches the mock; the runner's other
      // calls are globals.set, which the double records below.
      if (!code.includes('exec(compile(')) return undefined
      seen.push({ source: bound.get('__source__'), stdin: bound.get('__stdin__') })
      if (script.failure) throw new Error(script.failure)
      handlers.batched(script.printed?.[run] ?? '')
      run++
      return undefined
    }),
    setStdout: vi.fn((h: { batched(s: string): void }) => {
      handlers = h
    }),
    globals: {
      set: vi.fn((key: string, value: unknown) => {
        bound.set(key, value)
      }),
    },
  }
  return { mock, seen }
}

beforeEach(() => {
  resetAdvisoryLoaderForTests()
  vi.resetModules()
})

async function loadRunner(mock: unknown) {
  vi.doMock('pyodide', () => ({ loadPyodide: vi.fn(async () => mock) }))
  return (await import('./advisoryRunner')).runAdvisoryTests
}

describe('runAdvisoryTests', () => {
  it('passes when stdout matches the authored expectation', async () => {
    const { mock } = scriptPyodide({ printed: ['6\n'] })
    const run = await loadRunner(mock)

    const results = await run('print(sum([1, 2, 3]))\n', [TESTS[0]])
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ name: 'adds small list', passed: true, actual: '6\n' })
  })

  it('reports a mismatch as not-passed with the actual output', async () => {
    const { mock } = scriptPyodide({ printed: ['5\n'] })
    const run = await loadRunner(mock)

    const results = await run('print(5)\n', [TESTS[0]])
    expect(results[0].passed).toBe(false)
    expect(results[0].actual).toBe('5\n')
  })

  it('normalizes trailing whitespace and CRLF like the sandbox does', async () => {
    const { mock } = scriptPyodide({ printed: ['6', '6\r\n'] })
    const run = await loadRunner(mock)

    // The authored expectation carries a newline the print never emitted;
    // the server compares normalized stdout, so the advisory must agree.
    const results = await run('print(6)\n', [
      { name: 'no trailing newline', stdin: '', expectedOutput: '6\n' },
    ])
    expect(results[0].passed).toBe(true)

    const crlf = await run('print(6)\r\n', [
      { name: 'crlf', stdin: '', expectedOutput: '6\n' },
    ])
    expect(crlf[0].passed).toBe(true)
  })

  it('renders a learner exception as an honest one-line error, never a pass', async () => {
    const { mock } = scriptPyodide({
      failure: 'Traceback (most recent call last):\nZeroDivisionError: division by zero',
    })
    const run = await loadRunner(mock)

    const results = await run('print(1 // 0)\n', [TESTS[0]])
    expect(results[0].passed).toBe(false)
    expect(results[0].error).toBe('ZeroDivisionError: division by zero')
  })

  it('runs every visible test as a fresh whole program with its own stdin', async () => {
    const { mock, seen } = scriptPyodide({ printed: ['6\n', '0\n'] })
    const run = await loadRunner(mock)

    const results = await run('import sys\nprint(sum(eval(sys.stdin.read())))\n', TESTS)
    expect(results).toHaveLength(2)
    expect(results.map((r) => r.name)).toEqual(['adds small list', 'handles empty list'])
    // Each test binds its own stdin to the same learner source.
    expect(seen.map((s) => s.stdin)).toEqual(['[1, 2, 3]', '[]'])
    expect(seen.map((s) => s.source)).toEqual([
      'import sys\nprint(sum(eval(sys.stdin.read())))\n',
      'import sys\nprint(sum(eval(sys.stdin.read())))\n',
    ])
  })
})
