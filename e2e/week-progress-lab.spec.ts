import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const APP_URL = 'http://localhost:5173'
const SCREENSHOT_DIR = path.resolve(
  '.work/plans/active/2026-07-18-week-progress-lab/screenshots',
)

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

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error && !error.message.includes('already been registered')) throw error
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
    expect(measurement.x, `${measurement.selector} horizontal overflow`).toBeLessThanOrEqual(0)
    expect(measurement.y, `${measurement.selector} vertical overflow`).toBeLessThanOrEqual(0)
  }
  expect(measurements.at(-1)?.overflow).toBe('hidden')
}

test.describe('Week Progress Lab', () => {
  test.use({ baseURL: APP_URL })

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

      const chartText = await page
        .locator('.progress-lab-chart-stage svg[aria-label="Hours studied versus plan"]')
        .textContent()
      expect(chartText).toContain('0m')
      expect(chartText).toMatch(/\d+h/)
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
      expect(await page.locator('[data-testid^="checkpoint-"]').count()).toBeGreaterThanOrEqual(3)

      await expect(page.getByRole('button', { name: 'Full plan' })).toHaveAttribute('aria-pressed', 'true')
      await page.getByRole('button', { name: '30 days' }).click()
      await expect(page.getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'true')
      await page.getByRole('button', { name: 'This week' }).click()
      await expect(page.getByRole('button', { name: 'This week' })).toHaveAttribute('aria-pressed', 'true')

      const confidence = page.getByRole('button', { name: 'Confidence band' })
      await confidence.click()
      await expect(confidence).toHaveAttribute('aria-pressed', 'false')
      await confidence.click()

      const checkpoints = page.locator('[data-testid^="checkpoint-"]')
      await checkpoints.nth(Math.min(1, (await checkpoints.count()) - 1)).click()
      await expect(page.getByText('Selected checkpoint')).toBeVisible()
      await expect(page.getByText('Gap')).toBeVisible()

      const slider = page.getByRole('slider', { name: 'Extra minutes per study day' })
      await expect(slider).toBeEnabled()
      await expect(page.getByText('Scenario finish')).toBeVisible()
      await page.getByRole('button', { name: 'Full plan' }).click()
      await slider.fill('15')
      await expect(page.getByTestId('capacity-scenario-line')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Replan with this pace' })).toHaveAttribute(
        'href',
        '/study/replan?paceDeltaMinutes=15',
      )

      await expectNoOverflow(page)
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `final-${viewport.name}.png`),
      })

      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Open Progress Lab' })).toBeFocused()
    }

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${APP_URL}/study/week`)
    await openLab(page)
    await page.getByRole('slider', { name: 'Extra minutes per study day' }).fill('30')
    const scenarioFinish = (await page.locator('.progress-lab-scenario-result strong').innerText())
      .replace(/, \d{4}$/, '')
    await page.getByRole('link', { name: 'Replan with this pace' }).click()
    await page.waitForURL(/\/study\/replan\?paceDeltaMinutes=30$/)
    await expect(page.getByTestId('hours-per-day-value')).toContainText('2h')
    await expect(page.getByLabel('Projected finish')).toContainText(scenarioFinish)

    await page.goto(`${APP_URL}/study/week?w=2`)
    await openLab(page)
    await expect(page.getByText(/Progress Lab · Historical week/)).toBeVisible()
    await expect(page.getByText(/at week end/)).toBeVisible()
    await expect(page.getByRole('slider', { name: 'Extra minutes per study day' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Replan with this pace' })).toHaveCount(0)
    await expectNoOverflow(page)

    const backdrop = page.getByTestId('progress-lab-backdrop')
    await backdrop.click({ position: { x: 2, y: 2 } })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Open Progress Lab' })).toBeFocused()
    expect(errors).toEqual([])
  })
})
