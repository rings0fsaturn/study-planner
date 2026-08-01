import { mkdirSync } from 'node:fs'
import { request as httpsRequest, type RequestOptions } from 'node:https'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const APP_URL = 'http://localhost:5173'
const SCREENSHOT_DIR = path.resolve(
  '.work/plans/active/2026-07-19-progress-lab-pace-indicators/screenshots',
)
const SUPABASE_HOST = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL).hostname
  : undefined
const DIRECT_SUPABASE_IP = process.env.E2E_SUPABASE_IP

mkdirSync(SCREENSHOT_DIR, { recursive: true })

declare global {
  interface Window {
    __seed?: () => Promise<void>
    __wipe?: () => Promise<void>
  }
}

async function createTestUser(email: string, password: string): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return

  const endpoint = new URL('/auth/v1/admin/users', supabaseUrl)
  const payload = JSON.stringify({ email, password, email_confirm: true })
  const options: RequestOptions = {
    protocol: endpoint.protocol,
    hostname: DIRECT_SUPABASE_IP ?? endpoint.hostname,
    port: endpoint.port || 443,
    path: `${endpoint.pathname}${endpoint.search}`,
    servername: endpoint.hostname,
    method: 'POST',
    headers: {
      host: endpoint.host,
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload),
    },
  }
  const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const request = httpsRequest(options, (result) => {
      const chunks: Buffer[] = []
      result.on('data', (chunk: Buffer) => chunks.push(chunk))
      result.on('end', () => resolve({
        status: result.statusCode ?? 0,
        body: Buffer.concat(chunks).toString('utf8'),
      }))
    })
    request.on('error', reject)
    request.end(payload)
  })
  if (response.status >= 200 && response.status < 300) return
  if (response.body.includes('already been registered')) return
  throw new Error(`Supabase test-user creation failed with status ${response.status}`)
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${APP_URL}/study/sign-in`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.waitForURL(/\/study\/(home|onboarding)/)
  await page.waitForFunction(() => typeof window.__wipe === 'function')
}

async function seedDemo(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await window.__wipe?.()
    await window.__seed?.()
  })
  await page.goto(`${APP_URL}/study/week`)
  await expect(page.getByRole('button', { name: 'Open Progress Lab' })).toBeVisible()
}

async function openLab(page: Page): Promise<void> {
  const opener = page.getByRole('button', { name: 'Open Progress Lab' })
  await expect(opener).toBeVisible({ timeout: 10_000 })
  await opener.focus()
  await expect(opener).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(() => page.getByText('Open Progress Lab', { exact: true }).evaluate(
    (element) => getComputedStyle(element).opacity,
  )).toBe('1')
  await opener.click()
  await expect(page.getByRole('dialog', { name: 'Study trajectory and pace scenario' })).toBeVisible()
  await expect(opener).toHaveAttribute('aria-expanded', 'true')
}

async function expectNoOverflow(page: Page): Promise<void> {
  const measurements = await page.evaluate(() => {
    const measure = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (!element) throw new Error(`Missing overflow target: ${selector}`)
      return {
        selector,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        children: [...element.children].map((child) => {
          const childElement = child as HTMLElement
          return {
            tag: child.tagName,
            clientHeight: childElement.clientHeight,
            scrollHeight: childElement.scrollHeight,
            offsetHeight: childElement.offsetHeight,
          }
        }),
        x: element.scrollWidth - element.clientWidth,
        y: element.scrollHeight - element.clientHeight,
        overflow: getComputedStyle(element).overflow,
      }
    }
    return [
      measure('.progress-lab-overlay'),
      measure('.progress-lab-shell'),
      measure('.progress-lab-body'),
      measure('.progress-lab-chart-stage'),
      measure('.progress-lab-rail'),
      {
        selector: 'document',
        x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        y: 0,
        overflow: getComputedStyle(document.body).overflow,
      },
    ]
  })

  for (const measurement of measurements) {
    expect(
      measurement.x,
      `${measurement.selector} horizontal overflow: ${JSON.stringify(measurement)}`,
    ).toBeLessThanOrEqual(0)
    expect(
      measurement.y,
      `${measurement.selector} vertical overflow: ${JSON.stringify(measurement)}`,
    ).toBeLessThanOrEqual(0)
  }
  expect(measurements.at(-1)?.overflow).toBe('hidden')
}

async function expectChartLabelsInBounds(page: Page): Promise<void> {
  const clippedLabels = await page.evaluate(() => {
    const chart = document.querySelector<SVGSVGElement>(
      '.progress-lab-chart-stage svg[aria-label="Hours studied versus plan"]',
    )
    if (!chart) throw new Error('Progress chart is missing')
    const chartBounds = chart.getBoundingClientRect()
    return [...chart.querySelectorAll('text')].flatMap((label) => {
      const bounds = label.getBoundingClientRect()
      if (bounds.width === 0 || bounds.height === 0) return []
      const clipped = bounds.left < chartBounds.left - 0.5 || bounds.right > chartBounds.right + 0.5
      return clipped ? [label.textContent ?? ''] : []
    })
  })
  expect(clippedLabels).toEqual([])
}

test.use({
  baseURL: APP_URL,
  ...(SUPABASE_HOST && DIRECT_SUPABASE_IP
    ? {
        launchOptions: {
          args: [`--host-resolver-rules=MAP ${SUPABASE_HOST} ${DIRECT_SUPABASE_IP}`],
        },
      }
    : {}),
})

test.describe('Week Progress Lab', () => {
  test.beforeEach(() => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) test.skip()
  })

  test('current and historical inspection remain viewport-fit', async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    test.skip(testInfo.project.name !== 'app', 'The spec controls all required viewports itself.')

    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))

    const email = `week-progress-lab+${Date.now()}@test.studytracker.app`
    const password = 'TestPassword123!'
    await createTestUser(email, password)
    await signIn(page, email, password)
    await seedDemo(page)

    const viewports = [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'short', width: 1024, height: 600 },
      { name: 'phone', width: 390, height: 844 },
    ] as const

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto(`${APP_URL}/study/week`)
      await openLab(page)
      const lab = page.getByRole('dialog', { name: 'Study trajectory and pace scenario' })

      const chart = lab
        .locator('.progress-lab-chart-stage svg[aria-label="Hours studied versus plan"]')
      const chartText = await chart.textContent()
      expect(chartText).toContain('0m')
      expect(chartText).toMatch(/\d+h/)
      await expectChartLabelsInBounds(page)
      expect(await lab.locator('[data-testid^="checkpoint-"]').count()).toBeGreaterThanOrEqual(3)
      await expect(lab.getByTestId('burn-up-goal-line')).toBeVisible()
      await expect(lab.getByTestId('finish-flag-plan')).toBeVisible()
      await expect(lab.getByTestId('finish-flag-forecast')).toBeVisible()
      await expect(lab.getByTestId('finish-narrative-plan')).toBeVisible()
      await expect(lab.getByTestId('finish-narrative-forecast')).toContainText('current trajectory')
      await expect(lab.getByTestId('finish-narrative-scenario')).toContainText(
        'Choose extra minutes to compare a faster commitment.',
      )
      await expect(lab.getByTestId('capacity-scenario-line')).toHaveCount(0)
      await expect(lab.getByTestId('finish-flag-scenario')).toHaveCount(0)

      await expect(page.getByRole('button', { name: 'Full plan' })).toHaveAttribute('aria-pressed', 'true')
      await page.getByRole('button', { name: '30 days' }).click()
      await expect(page.getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'true')
      await page.getByRole('button', { name: 'This week' }).click()
      await expect(page.getByRole('button', { name: 'This week' })).toHaveAttribute('aria-pressed', 'true')

      const confidence = page.getByRole('button', { name: 'Confidence band' })
      await confidence.click()
      await expect(confidence).toHaveAttribute('aria-pressed', 'false')
      await confidence.click()

      const checkpoints = lab.locator('[data-testid^="checkpoint-"]')
      await checkpoints.nth(Math.min(1, (await checkpoints.count()) - 1)).click()
      await expect(page.getByText('Selected checkpoint')).toBeVisible()
      await expect(page.getByText('Gap')).toBeVisible()
      await lab.getByRole('button', { name: 'Close checkpoint summary' }).click()
      await expect(lab.getByText('Selected checkpoint')).toHaveCount(0)

      const slider = page.getByRole('slider', { name: 'Extra minutes per study day' })
      await expect(slider).toBeEnabled()
      await page.getByRole('button', { name: 'Full plan' }).click()

      const chartBounds = await chart.boundingBox()
      if (!chartBounds) throw new Error('Progress chart has no layout bounds')
      await page.mouse.move(
        chartBounds.x + chartBounds.width * 0.55,
        chartBounds.y + chartBounds.height * 0.45,
      )
      await expect(lab.getByTestId('crosshair-guides')).toBeVisible()
      await expect(lab.getByTestId('crosshair-date-pill')).toBeVisible()
      await expect(lab.getByTestId('crosshair-hours-pill')).toBeVisible()
      await expect(lab.getByTestId('crosshair-readout')).toContainText('Planned')

      await slider.fill('15')
      await expect(lab.getByTestId('capacity-scenario-line')).toBeVisible()
      await expect(lab.getByTestId('finish-flag-scenario')).toContainText('Your pace')
      await expect(lab.getByTestId('finish-narrative-scenario').locator('strong')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Replan with this pace' })).toHaveAttribute(
        'href',
        '/study/replan?paceDeltaMinutes=15',
      )

      await expectChartLabelsInBounds(page)
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `progress-lab-${viewport.width}x${viewport.height}.png`),
      })
      await expectNoOverflow(page)

      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Open Progress Lab' })).toBeFocused()
    }

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${APP_URL}/study/week`)
    await openLab(page)
    await page.getByRole('slider', { name: 'Extra minutes per study day' }).fill('30')
    const scenarioFinish = (await page.getByTestId('finish-narrative-scenario').locator('strong').innerText())
      .replace(/, \d{4}$/, '')
    await page.getByRole('link', { name: 'Replan with this pace' }).click()
    await page.waitForURL(/\/study\/replan\?paceDeltaMinutes=30$/)
    await expect(page.getByTestId('hours-per-day-value')).toContainText('2h')
    await expect(page.getByLabel('Projected finish')).toContainText(scenarioFinish)

    await page.goto(`${APP_URL}/study/week?w=2`)
    await openLab(page)
    const historicalLab = page.getByRole('dialog', { name: 'Study trajectory and pace scenario' })
    await expect(historicalLab.getByText(/Progress Lab · Historical week/)).toBeVisible()
    await expect(historicalLab.getByText(/at week end/)).toBeVisible()
    await expect(historicalLab.getByTestId('burn-up-goal-line')).toBeVisible()
    await expect(historicalLab.getByTestId('finish-flag-plan')).toBeVisible()
    await expect(historicalLab.getByTestId('finish-flag-forecast')).toHaveCount(0)
    await expect(historicalLab.getByTestId('finish-narrative-plan')).toBeVisible()
    await expect(historicalLab.getByTestId('finish-narrative-forecast')).toHaveCount(0)
    await expect(historicalLab.getByRole('slider', { name: 'Extra minutes per study day' })).toHaveCount(0)
    await expect(historicalLab.getByRole('link', { name: 'Replan with this pace' })).toHaveCount(0)
    const historicalChart = historicalLab.locator(
      '.progress-lab-chart-stage svg[aria-label="Hours studied versus plan"]',
    )
    const historicalChartBounds = await historicalChart.boundingBox()
    if (!historicalChartBounds) throw new Error('Historical progress chart has no layout bounds')
    await page.mouse.move(
      historicalChartBounds.x + historicalChartBounds.width * 0.55,
      historicalChartBounds.y + historicalChartBounds.height * 0.45,
    )
    await expect(historicalLab.getByTestId('crosshair-guides')).toBeVisible()
    await expectNoOverflow(page)

    const backdrop = page.getByTestId('progress-lab-backdrop')
    await backdrop.click({ position: { x: 2, y: 2 } })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Open Progress Lab' })).toBeFocused()
    expect(errors).toEqual([])
  })
})
