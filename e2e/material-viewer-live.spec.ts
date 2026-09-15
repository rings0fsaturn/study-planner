import { test, expect, type Page } from '@playwright/test';

/**
 * Live pdf.js viewer (issue #62, P5/P6/P8) against the real running stack and
 * the frozen ready corpus material ("ACCA APM Study Text", 572 pages).
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
 * P8 revision (2026-09-12): the default fit is the whole page ("Page"), the
 * zoom stepper re-renders the bitmap, a mouse drag pans the frame, and each
 * rendered page carries a pdf.js text layer, so text selects like any browser
 * PDF. The assertions that fail on the P6 viewer are the page-height fit, the
 * `Page`/`Width` toggle, the zoom stepper, the selection round trip and the
 * drag pan.
 *
 * Requires E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD, the managed runtime, the
 * detached ingestion worker and the GPU sidecar (rules 10/53/54). The corpus
 * material is the frozen retrieval baseline and is never deleted.
 * `E2E_APP_URL` points the spec at another port: two worktrees of this repo
 * both want 5173, and the launcher will not take a port a foreign process owns.
 *
 * The scenario ends at the range handoff. It used to go on and generate a
 * question, which duplicated `assessment-generation-live.spec.ts` and made every
 * viewer run depend on the queue, the service's auth config and the sidecar -
 * none of which the viewer owns.
 */
const APP_URL = process.env.E2E_APP_URL ?? 'http://localhost:5173';
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
  canvasHeight: number;
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
      canvasHeight: canvas ? canvas.getBoundingClientRect().height : 0,
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

/**
 * The first text run on a page whose box is actually inside the frame. Slots are
 * positioned by scroll offset, so an arbitrary span's box can sit outside the
 * viewport, and a mouse gesture at that coordinate lands on the app chrome.
 */
async function firstVisibleSpanBox(page: Page, pageNumber: number) {
  const frameBox = await page.locator('.pdf-frame').boundingBox();
  const spans = page
    .locator(`[data-page="${pageNumber}"] .pdf-text-layer span`)
    .filter({ hasText: /\S/ });
  const count = Math.min(await spans.count(), 40);
  for (let index = 0; index < count; index += 1) {
    const box = await spans.nth(index).boundingBox();
    if (!box || !frameBox) continue;
    const inside =
      box.y >= frameBox.y + 4 && box.y + box.height <= frameBox.y + frameBox.height - 4;
    if (inside) return box;
  }
  return null;
}

/**
 * Selects text the way the viewer documents it (P8): hold Shift, which makes
 * the layer selectable, and drag across a run. A plain drag pans instead. The
 * selection must start under the pointer, not at the top of the document - the
 * browser's own Shift gesture extends from its current anchor.
 */
async function shiftDragSelect(page: Page, pageNumber: number): Promise<string> {
  const box = await firstVisibleSpanBox(page, pageNumber);
  if (!box) return '';
  await page.keyboard.down('Shift');
  await page.mouse.move(box.x + 1, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 60, box.y + box.height / 2 + 10, { steps: 12 });
  await page.mouse.up();
  const selected = await page.evaluate(() => window.getSelection()?.toString() ?? '');
  await page.keyboard.up('Shift');
  return selected;
}

/**
 * Drags starting *on a glyph*: a plain drag pans wherever it begins, so this
 * must scroll the page and leave no selection behind.
 */
async function dragOverText(page: Page, dy: number): Promise<{ moved: number; selected: string }> {
  const frame = page.locator('.pdf-frame');
  const box = await firstVisibleSpanBox(page, 1);
  if (!box) return { moved: 0, selected: '' };
  const before = await frame.evaluate((element) => element.scrollTop);
  await page.mouse.move(box.x + 1, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 1, box.y + box.height / 2 + dy, { steps: 12 });
  await page.mouse.up();
  return {
    moved: (await frame.evaluate((element) => element.scrollTop)) - before,
    selected: await page.evaluate(() => window.getSelection()?.toString() ?? ''),
  };
}

/**
 * Drags the page itself up by `dy`, the way the hand tool does, and returns how
 * far the frame scrolled. The start point is inside the page's own left margin:
 * inside the page (the reader grabs the page, not the frame's gutter) but clear
 * of any glyph, because a drag that starts on a glyph selects text instead.
 */
async function panByDrag(page: Page, dy: number): Promise<number> {
  const frame = page.locator('.pdf-frame');
  const frameBox = await frame.boundingBox();
  const pageBox = await page.locator('.pdf-page').first().boundingBox();
  if (!frameBox || !pageBox) return 0;
  const before = await frame.evaluate((element) => element.scrollTop);
  const x = pageBox.x + 8;
  const y = frameBox.y + frameBox.height * 0.6;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + dy, { steps: 12 });
  await page.mouse.up();
  return (await frame.evaluate((element) => element.scrollTop)) - before;
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

  test('opens on a whole page, zooms, selects, pans, jumps and hands a range over', async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const pageErrors: string[] = [];
    // pdf.js reports a missing image decoder as a console warning and paints
    // nothing, so the ink assertions above cannot see it: a page can keep its
    // text and lose every figure. The wasm decoders come from
    // /study/pdfjs-wasm/ (apps/app/scripts/sync-pdfjs-wasm.mjs).
    const decodeWarnings: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'warning' && /Unable to decode image/i.test(message.text())) {
        decodeWarnings.push(message.text());
      }
    });

    await signIn(page);
    await openViewer(page);

    // 1. Pages are painted, one slot each, and only the visible window is drawn.
    await expectRendered(page, 1);
    await expect(page.getByRole('spinbutton', { name: 'Page' })).toHaveValue('1');
    await expect(page.getByText('of 572')).toBeVisible();
    const first = await frameMetrics(page);
    console.log(
      `[viewer] 1280 page fit: canvas ${first?.canvasWidth}x${first?.canvasHeight}px ` +
        `/ bitmap ${first?.canvasBitmapWidth}px in a ${first?.clientWidth}x${first?.clientHeight}px ` +
        `frame, slots ${first?.slots}, rendered ${first?.rendered}`,
    );
    expect(first?.slots).toBe(572);
    // Windowing: only the slots around the viewport are rasterised.
    expect(first?.rendered).toBeLessThan(10);
    // The desktop arm is really at desktop width (a file-level test.use ran it
    // at 375x812 until P6).
    expect(first!.clientWidth).toBeGreaterThan(1000);

    // 2. Page mode: a complete page on screen - all four edges inside the frame.
    expect(first!.canvasWidth).toBeLessThanOrEqual(first!.clientWidth + 1);
    expect(first!.canvasHeight).toBeLessThanOrEqual(first!.clientHeight + 1);
    expect(first!.scrollWidth).toBe(first!.clientWidth);

    // 3. Width mode re-fits to the frame width, and the page overflows its height.
    await page.getByRole('button', { name: 'Width' }).click();
    await expect
      .poll(async () => (await frameMetrics(page))?.canvasWidth ?? 0, { timeout: 30_000 })
      .toBeGreaterThan(first!.clientWidth * 0.9);
    const wide = await frameMetrics(page);
    console.log(
      `[viewer] 1280 width fit: canvas ${wide?.canvasWidth}x${wide?.canvasHeight}px ` +
        `/ bitmap ${wide?.canvasBitmapWidth}px in a ${wide?.clientWidth}px frame`,
    );
    expect(wide!.canvasWidth).toBeLessThanOrEqual(wide!.clientWidth + 1);
    expect(wide!.scrollWidth).toBe(wide!.clientWidth);

    // 4. Back to Page, then the zoom stepper: the bitmap is re-rendered at the
    //    new scale, not CSS-stretched, and the ladder is labelled. `exact` is
    //    required: the accessible name "Page" is also a substring of the
    //    "Set first page" / "Set last page" buttons.
    await page.getByRole('button', { name: 'Page', exact: true }).click();
    await expect
      .poll(async () => (await frameMetrics(page))?.canvasWidth ?? 0, { timeout: 30_000 })
      .toBeLessThan(first!.clientWidth * 0.6);
    const fitBitmap = (await frameMetrics(page))!.canvasBitmapWidth;
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByText('1.25×')).toBeVisible();
    await expect
      .poll(async () => (await frameMetrics(page))?.canvasBitmapWidth ?? 0, { timeout: 30_000 })
      .toBeGreaterThan(fitBitmap * 1.1);
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await expect(page.getByText('1×')).toBeVisible();

    // 5. The text layer is real text: Shift+drag selects it, starting where the
    //    pointer went down (not from the top of the document), and the cursor
    //    becomes a text caret while Shift is held.
    const selected = await shiftDragSelect(page, 1);
    console.log(`[viewer] shift-drag select: "${selected.slice(0, 60).replace(/\s+/g, ' ')}"`);
    expect(selected.trim().length).toBeGreaterThan(3);
    expect(selected).not.toMatch(/read the pages you want/);

    // 6. Scrolling reveals the next slot, and the page readout follows the top.
    await scrollToSlot(page, 2);
    await expect(page.getByRole('spinbutton', { name: 'Page' })).toHaveValue('2');
    await expectRasterised(page, 2);
    const scrolled = await frameMetrics(page);
    expect(scrolled!.scrollTop).toBeGreaterThan(0);

    // 7. A slot that leaves the window and comes back is painted again - the
    //    canvas record is keyed by element, not by page.
    await scrollToSlot(page, 20);
    await expectRasterised(page, 20);
    await scrollToSlot(page, 1);
    await expectRendered(page, 1);

    // 8. A plain drag pans the page wherever it starts, including a drag that
    //    begins on a glyph (which must scroll rather than select).
    const panned = await panByDrag(page, -220);
    const overText = await dragOverText(page, -220);
    console.log(
      `[viewer] drag pan: ${panned}px from the page margin, ${overText.moved}px over text ` +
        `(selection "${overText.selected.replace(/\s+/g, ' ')}")`,
    );
    expect(panned).toBeGreaterThan(100);
    expect(overText.moved).toBeGreaterThan(100);
    expect(overText.selected).toBe('');

    // 9. A chapter jump scrolls to that page's slot (Chapter 5 is pdf 156).
    await page.getByLabel('Jump to chapter').selectOption({ label: CHAPTER_5_LABEL });
    await expect(page.getByRole('spinbutton', { name: 'Page' })).toHaveValue('156');
    await expectRendered(page, 156);

    // 10. A range is selected from the pages actually on screen.
    await page.getByRole('button', { name: 'Set first page' }).click();
    await page.getByRole('spinbutton', { name: 'Page' }).fill('213');
    await expectRendered(page, 213);
    await page.getByRole('button', { name: 'Set last page' }).click();
    await expect(page.getByText('Assess pages 156–213')).toBeVisible();

    // 11. Re-fitting survives a viewport change (the measure-once defect). The
    //     poll also demands a real raster: an idle canvas is 300x150 and would
    //     satisfy a bare "<= 375".
    await page.setViewportSize({ width: 375, height: 812 });
    await expect
      .poll(
        async () => {
          const metrics = await frameMetrics(page);
          return metrics && metrics.canvasBitmapWidth > 100 && metrics.canvasWidth <= 375
            ? 'fit'
            : `${metrics?.canvasWidth}x${metrics?.canvasBitmapWidth}`;
        },
        { timeout: 30_000 },
      )
      .toBe('fit');
    const narrow = await frameMetrics(page);
    console.log(
      `[viewer] 375 refit: canvas ${narrow?.canvasWidth}x${narrow?.canvasHeight}px in a ` +
        `${narrow?.clientWidth}x${narrow?.clientHeight}px frame`,
    );
    expect(narrow!.canvasHeight).toBeLessThanOrEqual(narrow!.clientHeight + 1);
    await page.setViewportSize(DESKTOP);
    await expect
      .poll(async () => (await frameMetrics(page))?.clientWidth ?? 0, { timeout: 30_000 })
      .toBeGreaterThan(1000);
    await expect
      .poll(async () => (await frameMetrics(page))?.canvasWidth ?? 0, { timeout: 30_000 })
      .toBeLessThan(600);

    // 12. The range is handed to the assessment config as a typed range.
    await page.getByRole('button', { name: 'Assess these pages' }).click();
    await page.waitForURL(/\/assessments\/new\?from=156&to=213/, { timeout: 15_000 });
    await expect(page.getByLabel('From page')).toHaveValue('156');
    await expect(page.getByLabel('To page')).toHaveValue('213');
    await expect(page.getByRole('button', { name: CHAPTER_5 })).not.toHaveClass(/selected/);
    await expect(page.getByRole('button', { name: 'Generate question' })).toBeEnabled();

    expect(pageErrors).toEqual([]);
    expect(decodeWarnings).toEqual([]);
  });
});

test.describe('material viewer (live, mobile)', () => {
  // Scoped to this describe: a file-level test.use() leaks the phone viewport
  // into the desktop scenario above (it did until 2026-09-12).
  test.use({ viewport: { width: 375, height: 812 } });

  test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

  test('mobile: fits a whole page, zooms without overflowing, selects text and hands the range over', async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signIn(page);
    await openViewer(page);

    // 1. Page mode on a phone: the whole page is inside the frame.
    await expectRendered(page, 1);
    await expect(page.getByText('of 572')).toBeVisible();
    const fit = await frameMetrics(page);
    expect(fit?.rendered).toBeLessThan(10);
    expect(fit?.scrollWidth).toBe(fit?.clientWidth);
    expect(fit?.canvasWidth).toBeLessThanOrEqual((fit?.clientWidth ?? 0) + 1);
    expect(fit?.canvasHeight).toBeLessThanOrEqual((fit?.clientHeight ?? 0) + 1);
    const fitLine = await textLineHeight(page);

    // 2. Zoom re-rasterises the bitmap (not a CSS stretch) and may overflow,
    //    which the frame then scrolls sideways.
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByText('1.5×')).toBeVisible();
    await expect
      .poll(async () => (await frameMetrics(page))?.canvasBitmapWidth ?? 0, { timeout: 30_000 })
      .toBeGreaterThan((fit?.canvasBitmapWidth ?? 0) * 1.3);
    const zoomed = await frameMetrics(page);
    const zoomedLine = await textLineHeight(page);
    console.log(
      `[viewer] mobile page fit: canvas ${fit?.canvasWidth}x${fit?.canvasHeight}px / bitmap ` +
        `${fit?.canvasBitmapWidth}px, line ${fitLine}px | 1.5x: canvas ${zoomed?.canvasWidth}x` +
        `${zoomed?.canvasHeight}px / bitmap ${zoomed?.canvasBitmapWidth}px, line ${zoomedLine}px`,
    );

    // 3. Back to the fitted page, then the text still selects on a phone.
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await expect(page.getByText('1×')).toBeVisible();
    await expect
      .poll(async () => (await frameMetrics(page))?.scrollWidth ?? 0, { timeout: 30_000 })
      .toBe(fit?.clientWidth);
    const selected = await shiftDragSelect(page, 1);
    expect(selected.trim().length).toBeGreaterThan(3);

    // 4. The chapter jump and the range handoff at 375.
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
