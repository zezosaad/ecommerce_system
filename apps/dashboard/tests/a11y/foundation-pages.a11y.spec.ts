import { test, expect } from '@playwright/test';

const pages = ['/en', '/ar', '/en/finance/sample', '/en/(auth)/login'];

for (const path of pages) {
  test(`dashboard page accessible baseline: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('body')).toBeVisible();
  });
}
