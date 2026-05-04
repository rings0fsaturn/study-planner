import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const APP_URL = 'http://localhost:5173';

async function createTestUser(email: string, password: string): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set - skipping test');
    return;
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error && !error.message.includes('already been registered')) {
    console.warn('User creation error:', error.message);
  }
}

function generateTestEmail(prefix: string): string {
  const timestamp = Date.now();
  return `${prefix}+${timestamp}@test.studytracker.app`;
}

test.describe('Progress + Home integration', () => {
  test.beforeEach(() => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      test.skip();
    }
  });

  test('log sessions → see streak and projection update on Home', async ({ page }) => {
    const email = generateTestEmail('progress');
    const password = 'TestPassword123!';
    await createTestUser(email, password);

    // Sign in
    await page.goto(`${APP_URL}/study/sign-in`);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Wait for redirect to onboarding or home
    await page.waitForURL(/\/study\/(onboarding|home)/);

    // Complete onboarding if needed
    if (page.url().includes('onboarding')) {
      // Step 1 — Deadline
      const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      await page.getByLabel('When is your deadline?').fill(futureDate);
      await page.getByRole('button', { name: 'Next' }).click();

      // Step 2 — Hours
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'Next' }).click();

      // Step 3 — Materials
      await page.waitForTimeout(500);
      await page.getByPlaceholder(/title/i).fill('Test Material');
      await page.getByRole('button', { name: /add/i }).click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: 'Next' }).click();

      // Preview
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /confirm|next/i }).click();

      // Step 4 — Confirm
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /finish|start|confirm/i }).click();

      await page.waitForURL(/\/study\/home/);
    }

    // Navigate to /log
    await page.goto(`${APP_URL}/study/log`);
    await page.waitForSelector('text=Log a past session');

    // Log a session for today
    await page.getByLabel('Duration (minutes)').fill('45');
    await page.getByRole('button', { name: 'Log session' }).click();

    // Should navigate back to home
    await page.waitForURL(/\/study\/home/);

    // Verify streak card is present
    const streakCard = page.getByText(/streak/i);
    await expect(streakCard).toBeVisible();

    // Verify recent activity shows the session
    await expect(page.getByText('45 min').first()).toBeVisible();

    // Log another session to build streak
    await page.goto(`${APP_URL}/study/log`);
    await page.waitForSelector('text=Log a past session');

    // Change date to yesterday
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    await page.getByLabel('Date').fill(yesterday);
    await page.getByLabel('Duration (minutes)').fill('60');
    await page.getByRole('button', { name: 'Log session' }).click();

    // Should navigate back to home
    await page.waitForURL(/\/study\/home/);

    // Verify streak shows 2 days
    await expect(page.getByText('2-day streak')).toBeVisible();

    // Verify both sessions appear in recent activity
    const recentSessions = page.locator('.card-title');
    await expect(recentSessions).toHaveCount(2);
  });

  test('unusual flag toggle on Home recent activity', async ({ page }) => {
    const email = generateTestEmail('progress-flag');
    const password = 'TestPassword123!';
    await createTestUser(email, password);

    // Sign in
    await page.goto(`${APP_URL}/study/sign-in`);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/study\/(onboarding|home)/);

    // Skip to home (need onboarding complete for flag feature)
    if (page.url().includes('onboarding')) {
      test.skip();
      return;
    }

    // Log a session with "This was unusual" checked
    await page.goto(`${APP_URL}/study/log`);
    await page.getByLabel('Duration (minutes)').fill('30');
    await page.getByText('This was unusual').click();
    await page.getByRole('button', { name: 'Log session' }).click();
    await page.waitForURL(/\/study\/home/);

    // Verify "Unusual" tag appears
    await expect(page.getByText('Unusual').first()).toBeVisible();
  });
});
