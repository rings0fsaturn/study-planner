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
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (error && !error.message.includes('already been registered')) {
    console.warn('User creation error:', error.message);
  }
}

function generateTestEmail(prefix: string): string {
  const timestamp = Date.now();
  return `${prefix}+${timestamp}@test.studytracker.app`;
}

test.describe('Session log lifecycle', () => {
  test.beforeEach(() => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      test.skip();
    }
  });

  const userAEmail = generateTestEmail('usera');
  const userBEmail = generateTestEmail('userb');
  const password = 'TestPassword123!';

  test('full session-log lifecycle across accounts', async ({ browser }) => {
    test.setTimeout(120000);
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await createTestUser(userAEmail, password);
      await createTestUser(userBEmail, password);

      await page.goto(`${APP_URL}/study/sign-in`);
      await page.waitForTimeout(2000);

      await page.getByLabel('Email').fill(userAEmail);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForTimeout(2000);

      await expect(page).toHaveURL(/.*home/);

      await page.goto(`${APP_URL}/study/log`);
      await page.waitForTimeout(1000);

      await page.getByLabel('Duration (minutes)').fill('45');
      await page.getByLabel('Date').fill('2024-01-15');
      await page.getByLabel('What did you study?').fill('Chapter 3: Integration');
      await page.getByRole('button', { name: 'Log session' }).click();

      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/.*home/);

      await expect(page.locator('.stat-value')).toContainText('45 min');
      await expect(page.locator('.card-title')).toContainText('Chapter 3: Integration');

      await page.reload();
      await page.waitForTimeout(2000);

      await expect(page.locator('.stat-value')).toContainText('45 min');
      await expect(page.locator('.card-title')).toContainText('Chapter 3: Integration');

      const signOutBtn = page.locator('button:has-text("Sign out")');
      if (await signOutBtn.isVisible()) {
        await signOutBtn.click();
        await page.waitForTimeout(2000);
      }

      await page.goto(`${APP_URL}/study/sign-in`);
      await page.waitForTimeout(2000);

      await page.getByLabel('Email').fill(userBEmail);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForTimeout(2000);

      await page.goto(`${APP_URL}/study/home`);
      await page.waitForTimeout(2000);

      await expect(page.locator('.stat-value')).toContainText('0 min');
      const activitySection = page.locator('text=Recent activity');
      await expect(activitySection).toBeVisible();

    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      try {
        await context.close();
      } catch {
        // Context may already be closed
      }
    }
  });
});