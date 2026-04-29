import { test, expect } from '@playwright/test';

test.describe('Marketing site', () => {
  test.use({ baseURL: 'http://localhost:4321' });

  test('homepage loads with design tokens', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    const html = await page.content();
    expect(html).toContain('--paper');
    expect(html).toContain('--terracotta');
  });

  test('homepage renders design system components', async ({ page }) => {
    await page.goto('/');

    const btn = page.locator('.btn-accent').first();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Get started');

    const card = page.locator('.card').first();
    await expect(card).toBeVisible();
  });

  test('privacy page loads', async ({ page }) => {
    const response = await page.goto('/privacy');
    expect(response?.status()).toBe(200);

    await expect(page.locator('h1.t-display-2')).toContainText('Privacy Policy');
  });

  test('terms page loads', async ({ page }) => {
    const response = await page.goto('/terms');
    expect(response?.status()).toBe(200);

    await expect(page.locator('h1.t-display-2')).toContainText('Terms of Service');
  });
});

test.describe('React app at /study/', () => {
  test.use({ baseURL: 'http://localhost:5173' });

  test('sign-in page loads with design tokens', async ({ page }) => {
    const response = await page.goto('/study/sign-in');
    expect(response?.status()).toBe(200);

    const html = await page.content();
    expect(html).toContain('--paper');
    expect(html).toContain('--terracotta');
  });

  test('sign-in page renders form fields and submit button', async ({ page }) => {
    await page.goto('/study/sign-in');
    await page.waitForTimeout(500);

    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeVisible();
    await expect(page.locator('.auth-mark-name')).toContainText('Study Tracker');
    await expect(page.locator('.auth-social')).toContainText('Continue with Google');
    await expect(page.getByRole('link', { name: 'Terms' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeVisible();
  });

  test('sign-up page loads and shows confirmation form', async ({ page }) => {
    await page.goto('/study/sign-up');
    await page.waitForTimeout(2000);

    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByLabel('Confirm password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  });

  test('home page redirects unauthenticated to sign-in', async ({ page }) => {
    await page.goto('/study/home');
    await page.waitForTimeout(2000);

    // Should redirect to sign-in
    await expect(page).toHaveURL(/.*sign-in/);
    await expect(page.locator('.auth-mark-name')).toContainText('Study Tracker');
  });

  test('auth-confirmed page loads', async ({ page }) => {
    const response = await page.goto('/study/auth-confirmed');
    expect(response?.status()).toBe(200);
    await page.waitForTimeout(2000);

    await expect(page.getByRole('heading', { name: 'Email confirmed' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  test('reset-password page loads', async ({ page }) => {
    await page.goto('/study/reset-password');
    await page.waitForTimeout(2000);

    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
  });
});