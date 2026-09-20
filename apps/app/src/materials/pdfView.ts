/**
 * Geometry for the vertically scrolling PDF viewer (issue #62, P6; P8 added the
 * fit modes and the zoom stepper).
 *
 * Pure functions on purpose: the viewer itself is lazily imported, so pdf.js
 * never enters the jsdom test graph, and these are the layout rules that would
 * otherwise only be checkable in a browser.
 */

/** How the page is fitted to the frame: all four edges, or the width only. */
export type ZoomMode = 'page' | 'width'

/** 1x (the fitted default) plus the steps the zoom stepper walks. */
export const ZOOM_LEVELS = [1, 1.25, 1.5, 2, 3]

/**
 * ponytail: bitmap pixels per base-viewport unit are capped, so a 3x zoom on a
 * wide desktop scales up an already-2.5x raster instead of allocating a ~90 MB
 * canvas per page. Raise it (or drop the cap for the visible page only) when a
 * HiDPI desktop proves the soft text matters.
 */
export const MAX_RASTER_SCALE = 2.5

export type SlotRect = { page: number; top: number; bottom: number }

/** The scale at which a page exactly fills the frame width. */
export function fitScale(containerWidth: number, baseWidth: number): number {
  if (!(containerWidth > 0) || !(baseWidth > 0)) return 1
  return containerWidth / baseWidth
}

/** The scale at which a whole page is inside the frame, both axes. */
export function fitPageScale(
  frameWidth: number,
  frameHeight: number,
  baseWidth: number,
  baseHeight: number,
): number {
  if (!(frameWidth > 0) || !(frameHeight > 0) || !(baseWidth > 0) || !(baseHeight > 0)) return 1
  return Math.min(frameWidth / baseWidth, frameHeight / baseHeight)
}

/** The page's display scale: the active fit mode, times the zoom step. */
export function displayScale(
  mode: ZoomMode,
  frameWidth: number,
  frameHeight: number,
  baseWidth: number,
  baseHeight: number,
  zoom: number,
): number {
  const fit =
    mode === 'page'
      ? fitPageScale(frameWidth, frameHeight, baseWidth, baseHeight)
      : fitScale(frameWidth, baseWidth)
  return fit * zoom
}

/** One step along ZOOM_LEVELS, clamped at both ends, as an index. */
export function stepZoom(index: number, direction: number): number {
  return Math.min(Math.max(0, index + Math.sign(direction)), ZOOM_LEVELS.length - 1)
}

/** Bitmap scale: one bitmap pixel per CSS pixel, times the device ratio, capped. */
export function rasterScale(scale: number, devicePixelRatio: number): number {
  const deviceScale = scale * (devicePixelRatio > 0 ? devicePixelRatio : 1)
  return Math.min(deviceScale, MAX_RASTER_SCALE)
}

export function clampPage(value: number, numPages: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(Math.max(1, Math.trunc(value)), Math.max(1, numPages))
}

/**
 * The slots worth rendering: everything on screen plus one frame-height of
 * margin either way, so ink exists before a page scrolls into view.
 */
export function pagesInWindow(rects: SlotRect[], frameTop: number, frameHeight: number): number[] {
  const top = frameTop - frameHeight
  const bottom = frameTop + frameHeight * 2
  return rects
    .filter((rect) => rect.bottom > top && rect.top < bottom)
    .map((rect) => rect.page)
    .sort((a, b) => a - b)
}

/** The page the learner is reading is the one at the top edge of the frame. */
export function pageAtTop(rects: SlotRect[], frameTop: number, numPages: number): number {
  let current = 1
  // A 2px tolerance: a chapter/page jump sets the target slot's top to the
  // frame's top, but fractional scroll and device-pixel rounding can leave it
  // just below. With the tolerance at 1px a jump to page 156 reported 155.
  for (const rect of rects) {
    if (rect.top <= frameTop + 2) current = rect.page
  }
  return clampPage(current, numPages)
}
