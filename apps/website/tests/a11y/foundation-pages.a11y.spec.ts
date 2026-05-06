import { test, expect } from '@playwright/test';

const pages = ['/en', '/ar', '/en/stores/example-slug'];

for (const path of pages) {
  test(`website page accessible baseline: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('body')).toBeVisible();
  });
}
