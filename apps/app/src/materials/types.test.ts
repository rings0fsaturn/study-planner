import { describe, expect, it } from 'vitest'
import { toMaterialKind } from './types'

describe('toMaterialKind', () => {
  it('maps every library source kind onto a session material kind', () => {
    expect(toMaterialKind('url')).toBe('article')
    expect(toMaterialKind('youtube')).toBe('youtube')
    expect(toMaterialKind('file')).toBe('file')
    expect(toMaterialKind('manual')).toBe('manual')
  })
})
