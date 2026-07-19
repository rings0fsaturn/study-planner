import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const APP_URL = 'http://localhost:5173'
const MS_PER_DAY = 24 * 60 * 60 * 1000

async function createTestUser(email: string, password: string): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set - skipping test')
    return
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error && !error.message.includes('already been registered')) {
    console.warn('User creation error:', error.message)
  }
}

function generateTestEmail(prefix: string): string {
  return `${prefix}+${Date.now()}@test.studytracker.app`
}

function futureDateInputValue(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * MS_PER_DAY).toISOString().split('T')[0]
}

test.describe('Home calibration service path', () => {
  test.beforeEach(() => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      test.skip()
    }
  })

  test('Home posts calibration context to the Intelligence Service', async ({ page }) => {
    const calibrationRequests: unknown[] = []
    await page.route('**/v1/calibration', async (route) => {
      calibrationRequests.push(route.request().postDataJSON())
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          globalMultiplier: 1.04,
          globalPosterior: {
            mean: 1.04,
            variance: 0.01,
            sessionCount: 1,
          },
          roleMultipliers: {},
          trend: {
            phases: [],
            currentPhase: null,
            projectionSlope: 0,
            projectionUncertainty: 1,
          },
          promptNeeded: false,
          insightsByContext: [],
          nextSessionForecast: 1.08,
        }),
      })
    })

    const email = generateTestEmail('calibration')
    const password = 'TestPassword123!'
    await createTestUser(email, password)

    await page.goto(`${APP_URL}/study/sign-in`)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/study\/(onboarding|home)/)

    if (page.url().includes('onboarding')) {
      await page.locator('#target-date').fill(futureDateInputValue(60))
      await page.locator('.onboarding-continue-btn').click()
      await expect(page).toHaveURL(/.*onboarding\/2/)

      await page.getByRole('button', { name: '4h', exact: true }).click()
      await page
        .locator('.field-group')
        .filter({ hasText: 'Study days' })
        .getByRole('button', { name: 'Mon', exact: true })
        .click()
      await page.locator('.onboarding-continue-btn').click()
      await expect(page).toHaveURL(/.*onboarding\/3/)

      await page.locator('.onboarding-add-manually-btn').click()
      const material = page.locator('.material-row').last()
      await material.locator('input[type="text"][placeholder="Material title"]').fill('Calibration Material')
      await material.locator('input[type="number"]').fill('120')
      await page.locator('.onboarding-form-build-btn').click()
      await page.locator('.schedule-card').waitFor({ state: 'visible' })

      const commitButton = page.locator('.onboarding-preview-actions .onboarding-continue-btn')
      await expect(commitButton).toBeEnabled()
      await commitButton.click()
      await expect(page).toHaveURL(/.*onboarding\/4/)

      await page.locator('.onboarding-continue-btn').filter({ hasText: 'Go to home' }).click()
      await page.waitForURL(/\/study\/home/)
    }

    await expect(page.getByText(/Good/)).toBeVisible()
    await expect
      .poll(() => calibrationRequests.length)
      .toBeGreaterThan(0)

    const request = calibrationRequests[calibrationRequests.length - 1] as {
      nextContext?: {
        planned_horizon?: {
          deadline?: string
          planned_total_sessions?: number
        }
      }
    }
    expect(request.nextContext?.planned_horizon?.deadline).toBeTruthy()
    expect(request.nextContext?.planned_horizon?.planned_total_sessions).toBeGreaterThan(0)
  })
})
