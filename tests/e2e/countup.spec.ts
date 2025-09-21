import { test, expect } from '@playwright/test';

test.describe('CountUp mode', () => {
  test('should rank players by taps', async ({ page }) => {
    test.skip(true, 'TODO: Implement multi-client simulation via Playwright fixtures.');

    await page.goto('/join/demo');
    await expect(page).toHaveTitle(/wedding_tool/);
  });
});
