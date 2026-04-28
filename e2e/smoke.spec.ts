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

  test('placeholder page loads with design tokens', async ({ page }) => {
    const response = await page.goto('/study/');
    expect(response?.status()).toBe(200);

    const html = await page.content();
    expect(html).toContain('--paper');
    expect(html).toContain('--moss');
  });

  test('placeholder page renders design system components', async ({ page }) => {
    await page.goto('/study/');

    const btn = page.locator('.btn-accent').first();
    await expect(btn).toBeVisible();

    const card = page.locator('.card').first();
    await expect(card).toBeVisible();

    const tag = page.locator('.tag').first();
    await expect(tag).toBeVisible();
  });
});
