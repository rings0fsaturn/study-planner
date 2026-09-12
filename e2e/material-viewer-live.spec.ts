import { test, expect, type Page } from '@playwright/test';

/**
 * Live pdf.js viewer (issue #62, P5/P6) against the real running stack and the
 * frozen ready corpus material ("ACCA APM Study Text", 572 pages).
 *
 * The viewer loads the private PDF through a short-lived signed URL, so this
 * scenario is also the check that the worker is wired: a missing `workerSrc`
 * paints a blank canvas with only a console warning, which is why every render
 * assertion samples pixels instead of trusting a mounted element.
 *
 * P6 revision (2026-09-12): reading is one vertical scroll of page slots. The
 * assertions that fail on the pre-P6 viewer are the fit/overflow pair (the old
 * measure-once width left a bitmap wider than the frame) and the resize step.
 *
 * Requires E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD, the managed runtime, the
 * detached ingestion worker and the GPU sidecar (rules 10/53/54). The corpus
 * material is the frozen retrieval baseline and is never deleted.
 */
const APP_URL = 'http://localhost:5173';
const EMAIL = process.env.E2E_LIVE_EMAIL ?? '';
const PASSWORD = process.env.E2E_LIVE_PASSWORD ?? '';
const CORPUS_TITLE = 'ACCA APM Study Text';
const CHAPTER_5 = 'Chapter 5 Budgeting and control';
const CHAPTER_5_LABEL = `${CHAPTER_5} (p.156)`;
const DESKTOP = { width: 1280, height: 720 };

type FrameMetrics = {
  slots: number;
  rendered: number;
  scrollWidth: number;
  clientWidth: number;
  clientHeight: number;
  scrollTop: number;
  canvasWidth: number;
  canvasBitmapWidth: number;
  slotWidth: number;
};

async function signIn(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/sign-in`);
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/study\/(home|onboarding)/, { timeout: 15000 });
}

async function openViewer(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/materials`);
  // The app gates on the event-store sync ("Still bringing things over") right
  // after sign-in, and the shared dev account's history makes that routinely
  // longer than a default expect timeout.
  await expect(page.getByRole('heading', { name: 'Material library' })).toBeVisible({
    timeout: 30_000,
  });
  const card = page.locator('.material-card', { hasText: CORPUS_TITLE });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByRole('heading', { name: CORPUS_TITLE })).toBeVisible();
  await page.getByRole('link', { name: 'Open in viewer' }).click();
  await expect(page.getByRole('heading', { name: CORPUS_TITLE })).toBeVisible({
    timeout: 30_000,
  });
}

async function frameMetrics(page: Page): Promise<FrameMetrics | null> {
  return page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>('.pdf-frame');
    if (!frame) return null;
    const canvas = frame.querySelector<HTMLCanvasElement>('.pdf-canvas');
    const slot = canvas?.closest('.pdf-page') as HTMLElement | null;
    return {
      slots: frame.querySelectorAll('.pdf-page').length,
      rendered: frame.querySelectorAll('.pdf-canvas').length,
      scrollWidth: frame.scrollWidth,
      clientWidth: frame.clientWidth,
      clientHeight: frame.clientHeight,
      scrollTop: frame.scrollTop,
      canvasWidth: canvas ? canvas.getBoundingClientRect().width : 0,
      canvasBitmapWidth: canvas?.width ?? 0,
      slotWidth: slot ? slot.getBoundingClientRect().width : 0,
    };
  });
}

/** Ink in the part of a page's canvas that the frame is currently showing. */
async function visibleDarkPixels(page: Page, pageNumber: number): Promise<number> {
  return page.evaluate((target) => {
    const frame = document.querySelector<HTMLElement>('.pdf-frame');
    const canvas = document.querySelector<HTMLCanvasElement>(
      `.pdf-page[data-page="${target}"] .pdf-canvas`,
    );
    if (!frame || !canvas || canvas.width === 0) return -1;
    const frameRect = frame.getBoundingClientRect();
    const rect = canvas.getBoundingClientRect();
    if (rect.bottom < frameRect.top || rect.top > frameRect.bottom) return -1;
    const context = canvas.getContext('2d');
    if (!context) return -1;
    const scaleY = canvas.height / rect.height;
    const top = Math.max(0, Math.floor((frameRect.top - rect.top) * scaleY));
    const bottom = Math.min(canvas.height, Math.ceil((frameRect.bottom - rect.top) * scaleY));
    if (bottom - top < 1) return -1;
    const { data } = context.getImageData(0, top, canvas.width, bottom - top);
    let dark = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] < 200) dark += 1;
    }
    return dark;
  }, pageNumber);
}

/**
 * Ink anywhere on a page's canvas. The corpus has pages whose visible band is
 * blank (page 2 is a near-empty divider), so a scrolling scenario asserts that
 * the page was rasterised without demanding ink at its top edge.
 */
async function canvasDarkPixels(page: Page, pageNumber: number): Promise<number> {
  return page.evaluate((target) => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      `.pdf-page[data-page="${target}"] .pdf-canvas`,
    );
    if (!canvas || canvas.width === 0) return -1;
    const context = canvas.getContext('2d');
    if (!context) return -1;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let dark = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] < 200) dark += 1;
    }
    return dark;
  }, pageNumber);
}

/**
 * Median height of a text line on the first canvas the frame shows, in CSS px.
 * Measured off the bitmap's dark-pixel row runs, so it reports what the learner
 * can actually read rather than the scale factor we asked for.
 */
async function textLineHeight(page: Page): Promise<number> {
  return page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>('.pdf-frame');
    if (!frame) return 0;
    const frameRect = frame.getBoundingClientRect();
    const canvas = [...frame.querySelectorAll<HTMLCanvasElement>('.pdf-canvas')].find((node) => {
      const rect = node.getBoundingClientRect();
      return rect.bottom >= frameRect.top && rect.top <= frameRect.bottom && node.width > 0;
    });
    if (!canvas) return 0;
    const context = canvas.getContext('2d');
    if (!context) return 0;
    const height = Math.min(canvas.height, 900);
    const { data } = context.getImageData(0, 0, canvas.width, height);
    const runs: number[] = [];
    let run = 0;
    for (let y = 0; y < height; y += 1) {
      let dark = 0;
      for (let x = 0; x < canvas.width; x += 2) {
        if (data[(y * canvas.width + x) * 4] < 160) dark += 1;
      }
      if (dark > canvas.width * 0.005) run += 1;
      else {
        if (run > 0) runs.push(run);
        run = 0;
      }
    }
    if (run > 0) runs.push(run);
    if (runs.length === 0) return 0;
    runs.sort((a, b) => a - b);
    const bitmapPx = runs[Math.floor(runs.length / 2)];
    const cssPx = canvas.getBoundingClientRect().width / canvas.width;
    return Math.round(bitmapPx * cssPx * 10) / 10;
  });
}

/** Scrolls the frame to a page's slot, the way a chapter jump does. */
async function scrollToSlot(page: Page, pageNumber: number): Promise<void> {
  await page.evaluate((target) => {
    const frame = document.querySelector<HTMLElement>('.pdf-frame')!;
    const slot = frame.querySelector<HTMLElement>(`.pdf-page[data-page="${target}"]`)!;
    frame.scrollTop += slot.getBoundingClientRect().top - frame.getBoundingClientRect().top;
  }, pageNumber);
}

async function expectRendered(page: Page, pageNumber: number): Promise<void> {
  await expect(page.locator(`[data-page="${pageNumber}"] .pdf-canvas`)).toBeVisible({
    timeout: 30_000,
  });
  await expect
    .poll(() => visibleDarkPixels(page, pageNumber), { timeout: 60_000 })
    .toBeGreaterThan(0);
}

/** The page is rasterised, whatever its top edge happens to look like. */
async function expectRasterised(page: Page, pageNumber: number): Promise<void> {
  await expect(page.locator(`[data-page="${pageNumber}"] .pdf-canvas`)).toBeVisible({
    timeout: 30_000,
  });
  await expect
    .poll(() => canvasDarkPixels(page, pageNumber), { timeout: 60_000 })
    .toBeGreaterThan(0);
}

test.describe('material viewer (live)', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

  test('scrolls the document, fits the window, jumps to a chapter and hands a range over', async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signIn(page);
    await openViewer(page);

    // 1. Pages are painted, one slot each, and only the visible window is drawn.
    await expectRendered(page, 1);
    await expect(page.getByRole('spinbutton', { name: 'Page' })).toHaveValue('1');
    await expect(page.getByText('of 572')).toBeVisible();
    const first = await frameMetrics(page);
    console.log(
      `[viewer] 1280 fit: canvas ${first?.canvasWidth}px / bitmap ${first?.canvasBitmapWidth}px ` +
        `in a ${first?.clientWidth}px frame, slots ${first?.slots}, rendered ${first?.rendered}`,
    );
    expect(first?.slots).toBe(572);
    // Windowing: only the slots around the viewport are rasterised, and at this
    // width page 2 is more than one frame-height below the fold.
    expect(first?.rendered).toBeLessThan(10);
    expect(await page.locator('[data-page="2"] .pdf-canvas').count()).toBe(0);

    // 2. Fit: the page never exceeds the frame, so there is nothing to scroll
    //    sideways (this is the mobile crop's regression test).
    expect(first?.canvasWidth).toBeLessThanOrEqual((first?.clientWidth ?? 0) + 1);
    expect(first?.scrollWidth).toBe(first?.clientWidth);

    // 3. Scrolling reveals the next slot, and the page readout follows the top.
    await scrollToSlot(page, 2);
    await expect(page.getByRole('spinbutton', { name: 'Page' })).toHaveValue('2');
    await expectRasterised(page, 2);
    const scrolled = await frameMetrics(page);
    expect(scrolled!.scrollTop).toBeGreaterThan(0);

    // 4. A chapter jump scrolls to that page's slot (Chapter 5 is pdf 156).
    await page.getByLabel('Jump to chapter').selectOption({ label: CHAPTER_5_LABEL });
    await expect(page.getByRole('spinbutton', { name: 'Page' })).toHaveValue('156');
    await expectRendered(page, 156);
    const jumped = await frameMetrics(page);
    expect(jumped!.rendered).toBeLessThan(100);

    // 5. A range is selected from the pages actually on screen.
    await page.getByRole('button', { name: 'Set first page' }).click();
    await page.getByRole('spinbutton', { name: 'Page' }).fill('213');
    await expectRendered(page, 213);
    await page.getByRole('button', { name: 'Set last page' }).click();
    await expect(page.getByText('Assess pages 156–213')).toBeVisible();

    // 6. Re-fitting survives a viewport change (the measure-once defect).
    await page.setViewportSize({ width: 375, height: 812 });
    await expect
      .poll(async () => (await frameMetrics(page))?.canvasWidth ?? Number.POSITIVE_INFINITY, {
        timeout: 30_000,
      })
      .toBeLessThanOrEqual(375);
    const narrow = await frameMetrics(page);
    console.log(
      `[viewer] 375 refit: canvas ${narrow?.canvasWidth}px in a ${narrow?.clientWidth}px frame`,
    );
    await page.setViewportSize(DESKTOP);
    await expect
      .poll(async () => (await frameMetrics(page))?.canvasWidth ?? 0, { timeout: 30_000 })
      .toBeGreaterThan(500);

    // 7. The range is handed to the assessment config as a typed range.
    await page.getByRole('button', { name: 'Assess these pages' }).click();
    await page.waitForURL(/\/assessments\/new\?from=156&to=213/, { timeout: 15_000 });
    await expect(page.getByLabel('From page')).toHaveValue('156');
    await expect(page.getByLabel('To page')).toHaveValue('213');
    await expect(page.getByRole('button', { name: CHAPTER_5 })).not.toHaveClass(/selected/);

    // 8. The handoff produces a grounded question with citations.
    await page.getByRole('button', { name: 'Generate question' }).click();
    await page.waitForURL(/\/study\/assessments\/[^/]+$/, { timeout: 15_000 });
    const failed = page.getByRole('button', { name: 'Retry generation' });
    await expect(page.getByRole('heading', { name: 'Citations' }).or(failed)).toBeVisible({
      timeout: 120_000,
    });
    if (await failed.isVisible()) {
      await failed.click();
      await expect(page.getByRole('heading', { name: 'Citations' })).toBeVisible({
        timeout: 120_000,
      });
    }
    await expect(page.getByText(/chunk [0-9a-f]+/).first()).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});

test.describe('material viewer (live, mobile)', () => {
  // Scoped to this describe: a file-level test.use() leaks the phone viewport
  // into the desktop scenario above (it did until 2026-09-12).
  test.use({ viewport: { width: 375, height: 812 } });

  test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

  test('mobile: fits at 375, zooms without overflowing, and hands the range over', async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signIn(page);
    await openViewer(page);

    // 1. Fit on a phone: the whole page width is inside the frame.
    await expectRendered(page, 1);
    await expect(page.getByText('of 572')).toBeVisible();
    const fit = await frameMetrics(page);
    expect(fit?.rendered).toBeLessThan(10);
    expect(fit?.scrollWidth).toBe(fit?.clientWidth);
    expect(fit?.canvasWidth).toBeLessThanOrEqual((fit?.clientWidth ?? 0) + 1);
    const fitLine = await textLineHeight(page);

    // 2. Zoom re-rasterises the bitmap (not a CSS stretch) and may overflow,
    //    which the frame then scrolls sideways.
    await page.getByRole('button', { name: '1.5×' }).click();
    await expect
      .poll(async () => (await frameMetrics(page))?.canvasBitmapWidth ?? 0, { timeout: 30_000 })
      .toBeGreaterThan(fit?.canvasBitmapWidth ?? 0);
    const zoomed = await frameMetrics(page);
    const zoomedLine = await textLineHeight(page);
    console.log(
      `[viewer] fit: canvas ${fit?.canvasWidth}px / bitmap ${fit?.canvasBitmapWidth}px, ` +
        `line ${fitLine}px | 1.5x: canvas ${zoomed?.canvasWidth}px / bitmap ` +
        `${zoomed?.canvasBitmapWidth}px, line ${zoomedLine}px`,
    );
    expect(zoomed!.canvasBitmapWidth).toBeGreaterThan((fit?.canvasBitmapWidth ?? 0) * 1.3);
    expect(await page.getByRole('button', { name: '1.5×' }).getAttribute('aria-pressed')).toBe(
      'true',
    );

    // 3. Back to Fit, then the chapter jump and handoff at 375.
    await page.getByRole('button', { name: 'Fit' }).click();
    await expect.poll(async () => (await frameMetrics(page))?.scrollWidth ?? 0).toBe(fit?.clientWidth);
    await page.getByLabel('Jump to chapter').selectOption({ label: CHAPTER_5_LABEL });
    await expect(page.getByRole('spinbutton', { name: 'Page' })).toHaveValue('156');
    await expectRendered(page, 156);
    await page.getByRole('button', { name: 'Set first page' }).click();
    await page.getByRole('button', { name: 'Set last page' }).click();
    await expect(page.getByText('Assess pages 156–156')).toBeVisible();

    await page.getByRole('button', { name: 'Assess these pages' }).click();
    await page.waitForURL(/\/assessments\/new\?from=156&to=156/, { timeout: 15_000 });
    await expect(page.getByLabel('From page')).toHaveValue('156');
    await expect(page.getByLabel('To page')).toHaveValue('156');
    await expect(page.getByRole('button', { name: 'Generate question' })).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
