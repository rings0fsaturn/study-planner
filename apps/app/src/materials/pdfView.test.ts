import { describe, expect, it } from 'vitest'
import {
  MAX_RASTER_SCALE,
  ZOOM_LEVELS,
  clampPage,
  displayScale,
  fitScale,
  pageAtTop,
  pagesInWindow,
  rasterScale,
  stepZoom,
} from './pdfView'

describe('fitScale', () => {
  it('fits a page to the container width', () => {
    expect(fitScale(375, 595)).toBeCloseTo(375 / 595)
  })

  it('falls back to natural size before the container has been measured', () => {
    expect(fitScale(0, 595)).toBe(1)
    expect(fitScale(375, 0)).toBe(1)
  })
})

describe('displayScale', () => {
  it('fits the whole page inside the frame in page mode', () => {
    expect(displayScale('page', 1280, 480, 595, 842, 1)).toBeCloseTo(480 / 842)
  })

  it('fits the width in width mode, ignoring the frame height', () => {
    expect(displayScale('width', 1280, 480, 595, 842, 1)).toBeCloseTo(1280 / 595)
  })

  it('multiplies the fit scale by the zoom level', () => {
    expect(displayScale('page', 1280, 480, 595, 842, 1.5)).toBeCloseTo((480 / 842) * 1.5)
    expect(displayScale('width', 1280, 480, 595, 842, 3)).toBeCloseTo((1280 / 595) * 3)
  })

  it('falls back to natural size before the frame has been measured', () => {
    expect(displayScale('page', 0, 0, 595, 842, 1)).toBe(1)
    expect(displayScale('width', 0, 480, 595, 842, 1)).toBe(1)
  })

  it('offers 1x plus 1.25/1.5/2/3, with 1x first and default', () => {
    expect(ZOOM_LEVELS).toEqual([1, 1.25, 1.5, 2, 3])
  })
})

describe('stepZoom', () => {
  it('walks the ladder one level at a time', () => {
    expect(ZOOM_LEVELS[stepZoom(0, 1)]).toBe(1.25)
    expect(ZOOM_LEVELS[stepZoom(2, -1)]).toBe(1.25)
  })

  it('clamps at both ends of the ladder', () => {
    expect(stepZoom(0, -1)).toBe(0)
    expect(stepZoom(ZOOM_LEVELS.length - 1, 1)).toBe(ZOOM_LEVELS.length - 1)
  })

  it('ignores a zero direction', () => {
    expect(stepZoom(2, 0)).toBe(2)
  })
})

describe('rasterScale', () => {
  it('renders one bitmap pixel per CSS pixel at devicePixelRatio 1', () => {
    expect(rasterScale(0.63, 1)).toBeCloseTo(0.63)
  })

  it('doubles the bitmap on a retina screen so zoomed text stays sharp', () => {
    expect(rasterScale(0.63, 2)).toBeCloseTo(1.26)
  })

  it('caps the bitmap on a wide desktop zoomed to 3x', () => {
    expect(rasterScale(6.45, 1)).toBe(MAX_RASTER_SCALE)
  })

  it('treats a missing devicePixelRatio as 1', () => {
    expect(rasterScale(0.63, 0)).toBeCloseTo(0.63)
  })
})

describe('clampPage', () => {
  it('keeps a page inside the document', () => {
    expect(clampPage(0, 572)).toBe(1)
    expect(clampPage(999, 572)).toBe(572)
  })

  it('truncates and survives a non-number', () => {
    expect(clampPage(12.7, 572)).toBe(12)
    expect(clampPage(Number.NaN, 572)).toBe(1)
  })
})

describe('pagesInWindow', () => {
  const rects = [
    { page: 1, top: 0, bottom: 100 },
    { page: 2, top: 100, bottom: 200 },
    { page: 3, top: 200, bottom: 300 },
    { page: 4, top: 900, bottom: 1000 },
  ]

  it('keeps the pages on screen plus one frame-height of margin', () => {
    expect(pagesInWindow(rects, 0, 100)).toEqual([1, 2])
  })

  it('windows a long document instead of rendering every slot', () => {
    expect(pagesInWindow(rects, 0, 100)).not.toContain(4)
  })

  it('picks up a page once it scrolls inside the margin', () => {
    expect(pagesInWindow(rects, 750, 100)).toEqual([4])
  })
})

describe('pageAtTop', () => {
  // Page 1 has just scrolled out of the frame: page 2's first row is the top edge.
  const rects = [
    { page: 1, top: -500, bottom: 0 },
    { page: 2, top: 0, bottom: 300 },
    { page: 3, top: 300, bottom: 700 },
  ]

  it('reads the page at the top edge of the frame', () => {
    expect(pageAtTop(rects, 0, 572)).toBe(2)
  })

  it('reads page 1 before the document has scrolled', () => {
    expect(pageAtTop([{ page: 1, top: 0, bottom: 400 }], 0, 572)).toBe(1)
  })

  it('tolerates a jump that lands a fraction below the frame top', () => {
    const jumped = [
      { page: 155, top: -490, bottom: -1.5 },
      { page: 156, top: 1.5, bottom: 490 },
    ]
    expect(pageAtTop(jumped, 0, 572)).toBe(156)
  })

  it('falls back to page 1 when no slot sits above the frame top', () => {
    expect(pageAtTop([{ page: 7, top: 500, bottom: 900 }], 0, 572)).toBe(1)
  })

  it('never reports past the end of the document', () => {
    expect(pageAtTop([{ page: 900, top: 0, bottom: 10 }], 0, 572)).toBe(572)
  })
})
