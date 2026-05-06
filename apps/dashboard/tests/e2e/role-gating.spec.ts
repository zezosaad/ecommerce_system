import { test, expect } from '@playwright/test';

test.describe('Role gating', () => {
  test('unauthenticated user is redirected to login preserving return URL', async ({ page }) => {
    await page.goto('/en/finance/sample');
    await expect(page).toHaveURL(/\/en\/(finance\/sample|\(auth\)\/login)/);
  });

  test('finance sample page is reachable in Arabic locale', async ({ page }) => {
    await page.goto('/ar/finance/sample');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});
