import { test, expect } from '@playwright/test';

import { adminLogin, injectAdminToken, e2eReset } from './helpers';

test('3AI 模式门禁：未配置时禁用并提示', async ({ page, baseURL }) => {
  const token = await adminLogin(baseURL!);
  await e2eReset(baseURL!, token, { scope: 'all', keep_balance: true, prediction_mode: 'rule', boot_number: 1 });
  await injectAdminToken(page, token);

  await page.goto('/admin', { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: /AI大模型与规则引擎/ }).click();
  await page.getByRole('button', { name: /选择模式/ }).click();

  await expect(page.getByText(/3AI模式/)).toBeVisible();
  await expect(page.getByText('未配置API').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /启用 3AI 模式/ })).toBeDisabled();
});
