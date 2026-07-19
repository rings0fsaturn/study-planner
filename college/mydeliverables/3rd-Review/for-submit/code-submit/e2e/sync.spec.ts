import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

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

test.describe('Cross-device sync', () => {
  test.beforeEach(() => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      test.skip();
    }
  });

  test('session logged on device A appears on device B after sync', async ({ browser }) => {
    test.setTimeout(180000);

    const userEmail = generateTestEmail('sync-test');
    const password = 'TestPassword123!';

    await createTestUser(userEmail, password);

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    await pageA.goto(`${APP_URL}/study/sign-in`);
    await pageA.waitForTimeout(2000);
    await pageA.getByLabel('Email').fill(userEmail);
    await pageA.getByLabel('Password').fill(password);
    await pageA.getByRole('button', { name: 'Sign in' }).click();
    await pageA.waitForTimeout(3000);
    await expect(pageA).toHaveURL(/.*home/);

    await pageA.goto(`${APP_URL}/study/log`);
    await pageA.waitForTimeout(1000);
    await pageA.getByLabel('Duration (minutes)').fill('30');
    await pageA.getByLabel('Date').fill('2024-06-15');
    await pageA.getByLabel('What did you study?').fill('Cross-device sync test');
    await pageA.getByRole('button', { name: 'Log session' }).click();
    await pageA.waitForTimeout(2000);
    await expect(pageA).toHaveURL(/.*home/);
    await expect(pageA.locator('.card-title')).toContainText('Cross-device sync test');

    await pageA.waitForTimeout(5000);

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    await pageB.goto(`${APP_URL}/study/sign-in`);
    await pageB.waitForTimeout(2000);
    await pageB.getByLabel('Email').fill(userEmail);
    await pageB.getByLabel('Password').fill(password);
    await pageB.getByRole('button', { name: 'Sign in' }).click();
    await pageB.waitForTimeout(5000);
    await expect(pageB).toHaveURL(/.*home/);

    await expect(pageB.locator('.card-title')).toContainText('Cross-device sync test');
    await expect(pageB.locator('.stat-value')).toContainText('30 min');

    await contextA.close();
    await contextB.close();
  });
});