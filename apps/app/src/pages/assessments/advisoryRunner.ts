/**
 * Coding advisory runner (#42 D-03): executes the learner's source against
 * the question's **visible** tests in the browser via a lazily-imported
 * Pyodide. Advisory only - the grade arrives from the server poll, never
 * from here. Hidden tests are never in the client payload, so the advisory
 * run is hidden-test-free by construction.
 *
 * The execution model mirrors the sandbox exactly (`piston_client`): the
 * learner's source is a whole program, the test's stdin is piped in, stdout
 * is compared against the authored expectation with CRLF and trailing
 * whitespace normalized on both sides. A `solve(...)`-style harness would
 * disagree with the server on the same submission, which is worse than no
 * advisory at all.
 */

import type { VisibleTestCase } from '../../assessments/types'

/** One advisory verdict: the test name the author gave, and whether it passed. */
export interface AdvisoryResult {
  name: string
  passed: boolean
  actual: string
  error?: string
}

export type AdvisoryPhase = 'idle' | 'loading' | 'running' | 'done'

interface PyodideLoader {
  loadPyodide(options: { indexURL: string }): Promise<PyodideInstance>
}

interface PyodideInstance {
  runPython(code: string): unknown
  setStdout(handlers: { batched(s: string): void }): void
  globals: { set(key: string, value: unknown): void }
}

let cached: Promise<PyodideInstance> | null = null

/** Load the runtime once per page lifetime; the wasm stays cached by the browser. */
function loadPyodideOnce(): Promise<PyodideInstance> {
  if (!cached) {
    cached = import('pyodide').then(async (module: unknown) => {
      const { loadPyodide } = module as PyodideLoader
      return loadPyodide({ indexURL: `${import.meta.env.BASE_URL}pyodide/` })
    })
  }
  return cached
}

/**
 * Reset the memoized loader (tests only) so a failed import can be retried
 * with a fresh mock.
 */
export function resetAdvisoryLoaderForTests(): void {
  cached = null
}

const MAX_OUTPUT_CHARS = 20000

/**
 * Mirror of the sandbox's stdout normalization
 * (`piston_client._normalize_output`): CRLF folded to LF and trailing
 * whitespace stripped on both sides, so the advisory verdict agrees with the
 * server on the same submission.
 */
function normalizeOutput(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\s+$/, '')
}

const HARNESS = [
  'import sys, io',
  'sys.stdin = io.StringIO(__stdin__)',
  'exec(compile(__source__, "<learner>", "exec"), {"__name__": "__main__"})',
].join('\n')

/**
 * Run one learner source against every visible test, each as a fresh
 * whole-program execution (the sandbox model) so a crashed earlier test
 * cannot poison the later ones.
 */
export async function runAdvisoryTests(
  source: string,
  tests: VisibleTestCase[],
): Promise<AdvisoryResult[]> {
  const pyodide = await loadPyodideOnce()
  return tests.map((test) => runOneTest(pyodide, source, test))
}

function runOneTest(
  pyodide: PyodideInstance,
  source: string,
  test: VisibleTestCase,
): AdvisoryResult {
  let captured = ''
  pyodide.setStdout({
    batched(s: string) {
      captured += s
    },
  })
  pyodide.globals.set('__source__', source)
  pyodide.globals.set('__stdin__', test.stdin)
  try {
    pyodide.runPython(HARNESS)
  } catch (err) {
    return { name: test.name, passed: false, actual: '', error: advisoryMessage(err) }
  }
  const actual = captured.slice(0, MAX_OUTPUT_CHARS)
  return {
    name: test.name,
    passed: normalizeOutput(actual) === normalizeOutput(test.expectedOutput),
    actual,
  }
}

/** Honest one-line rendering of a Pyodide failure (never the test content). */
function advisoryMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const lines = message.split('\n').filter(Boolean)
  const firstLine = lines.length > 0 ? lines[lines.length - 1] : message
  return firstLine.slice(0, 300)
}
