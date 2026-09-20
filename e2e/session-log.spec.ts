import { test, expect, type Page } from '@playwright/test';
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

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${APP_URL}/study/sign-in`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  // A brand-new account has no roadmap, so the onboarding gate takes it. Either
  // landing is a successful sign-in; the caller decides what to do next.
  await page.waitForURL(/\/study\/(home|onboarding)/, { timeout: 20000 });
}

/**
 * A fresh test account is gated into onboarding, so seed a roadmap through the
 * dev seeder (available whenever the app runs in DEV) before asserting on the
 * app shell. The seeder wipes and rewrites this account's own event log only.
 */
async function seedRoadmap(page: Page): Promise<void> {
  await page.waitForFunction(
    () => typeof (window as unknown as { __seed?: unknown }).__seed === 'function',
    undefined,
    { timeout: 15000 },
  );
  await page.evaluate(() => (window as unknown as { __seed: () => Promise<void> }).__seed());
  await page.goto(`${APP_URL}/study/home`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20000 });
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
    test.setTimeout(180000);
    const context = await browser.newContext();
    const page = await context.newPage();

    await createTestUser(userAEmail, password);
    await createTestUser(userBEmail, password);

    // User A: sign in, seed a roadmap, log a session, see it, and sign out.
    await signIn(page, userAEmail, password);
    await seedRoadmap(page);

    await page.goto(`${APP_URL}/study/log`);
    await page.getByLabel('Duration (minutes)').fill('45');
    await page.getByLabel('Date').fill('2024-01-15');
    await page.getByLabel('What did you study?').fill('Chapter 3: Integration');
    await page.getByRole('button', { name: 'Log session' }).click();
    await expect(page).toHaveURL(/.*home/, { timeout: 15000 });
    await expect(page.getByText('Chapter 3: Integration')).toBeVisible({ timeout: 15000 });

    await page.reload();
    await expect(page.getByText('Chapter 3: Integration')).toBeVisible({ timeout: 15000 });

    // Sign out lives on Settings with a confirm step: the row opens it, the
    // confirm commits. Both share the name "Sign out" and only one is mounted
    // at a time. This block used to look for the button on Home and silently
    // skip, leaving the account-switch wipe untested.
    await page.goto(`${APP_URL}/study/settings`);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL(/\/study\/sign-in/, { timeout: 15000 });

    // User B: a separate account must not inherit user A's session.
    await signIn(page, userBEmail, password);
    await seedRoadmap(page);
    await expect(page.getByText('Chapter 3: Integration')).toHaveCount(0);

    await context.close();
  });
});
