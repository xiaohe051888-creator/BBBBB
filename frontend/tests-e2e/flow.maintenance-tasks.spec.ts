import { test, expect } from '@playwright/test';

import { adminLogin, injectAdminToken } from './helpers';

test('维护与清理面板可加载', async ({ page, baseURL }) => {
  const token = await adminLogin(baseURL!);
  await injectAdminToken(page, token);

  await page.goto('/admin', { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: /数据库存储/ }).click();
  await expect(page.getByText('维护与清理')).toBeVisible();
  await expect(page.getByRole('button', { name: '刷新统计' })).toBeVisible();
  await expect(page.getByRole('button', { name: '立即清理' })).toBeVisible();
});

