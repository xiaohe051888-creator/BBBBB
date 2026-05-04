import { test, expect } from '@playwright/test';

test('未登录：关键操作提示且不闪屏', async ({ page }) => {
  await page.goto('/dashboard/logs', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('admin_token'));
  await page.reload({ waitUntil: 'networkidle' });

  await page.getByRole('button', { name: '刷新' }).click();
  await expect(page).toHaveURL(/\/dashboard\/logs/);

  await page.goto('/admin', { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: '管理员登录' })).toBeVisible();
});
