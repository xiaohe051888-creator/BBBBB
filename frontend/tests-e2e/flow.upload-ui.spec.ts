import { test, expect } from '@playwright/test';

import { adminLoginAndInject, e2eReset } from './helpers';

test('上传数据页：键盘录入→确认上传→跳转首页', async ({ page, baseURL }) => {
  const token = await adminLoginAndInject(baseURL!, page);
  await e2eReset(baseURL!, token, { scope: 'all', keep_balance: true, prediction_mode: 'rule', boot_number: 1 });

  await page.goto('/upload', { waitUntil: 'networkidle' });
  await expect(page.getByText('上传数据')).toBeVisible();

  await page.keyboard.press('1');
  await page.keyboard.press('2');
  await page.keyboard.press('3');

  await page.getByRole('button', { name: '确认上传' }).click();
  await expect(page.locator('.ant-modal-title', { hasText: '确认上传' })).toBeVisible();
  await page.getByText('我已确认将清空本靴数据（不可恢复）').click();

  const uploadRespPromise = page.waitForResponse((r) => r.url().includes('/api/games/upload') && r.request().method() === 'POST');
  await page.getByRole('button', { name: /确认覆盖本靴并上传/ }).click();
  const uploadResp = await uploadRespPromise;
  expect(uploadResp.ok()).toBe(true);

  await expect(page).toHaveURL(/\/dashboard/);
});
