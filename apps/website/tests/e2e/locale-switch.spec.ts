import { test, expect } from '@playwright/test';

test.describe('Locale Switch - Website', () => {
  test('switches from English to Arabic and applies RTL', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('h1')).toContainText('VendorHub');

    const arButton = page.locator('button[aria-label="التبديل إلى العربية"]');
    await arButton.click();

    await expect(page).toHaveURL(/\/ar/);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(html).toHaveAttribute('lang', 'ar');
  });

  test('store slug route renders placeholder', async ({ page }) => {
    await page.goto('/en/stores/test-store');
    await expect(
      page.getByRole('heading', { name: 'Store Not Found' }),
    ).toBeVisible();
    await expect(page.getByText('test-store')).toBeVisible();
  });
});
