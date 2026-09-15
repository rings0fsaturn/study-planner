import { describe, expect, it, vi } from 'vitest'
import { logger } from './logger'

describe('logger', () => {
  it('delegates warn/error to console', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.warn('[test] warn', { a: 1 })
    logger.error('[test] error')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })
})
