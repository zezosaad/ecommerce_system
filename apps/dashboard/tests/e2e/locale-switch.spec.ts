import { test, expect } from '@playwright/test';

test.describe('Locale Switch - Dashboard', () => {
  test('switches from English to Arabic and applies RTL', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('h1')).toContainText('VendorHub Dashboard');

    const arButton = page.locator('button[aria-label="التبديل إلى العربية"]');
    await arButton.click();

    await expect(page).toHaveURL(/\/ar/);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(html).toHaveAttribute('lang', 'ar');
  });

  test('switches from Arabic to English and applies LTR', async ({ page }) => {
    await page.goto('/ar');
    const enButton = page.locator('button[aria-label="Switch to English"]');
    await enButton.click();

    await expect(page).toHaveURL(/\/en/);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'ltr');
    await expect(html).toHaveAttribute('lang', 'en');
  });
});
