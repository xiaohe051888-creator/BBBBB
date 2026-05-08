import { test, expect } from '@playwright/test';

import { adminLoginAndInject, e2eReset, e2eSeedLogs, e2eSeedMistakes } from './helpers';

test('桌面端与手机端：日志页和复盘页基础布局可用', async ({ page, baseURL }) => {
  const token = await adminLoginAndInject(baseURL!, page);
  await e2eReset(baseURL!, token, { scope: 'all', keep_balance: true, prediction_mode: 'rule', boot_number: 7 });
  await e2eSeedLogs(baseURL!, token, { boot_number: 7, game_number: 3, count: 12, priority: 'P1' });
  await e2eSeedMistakes(baseURL!, token, { boot_number: 7, count: 6, prediction_mode: 'rule' });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/dashboard/logs?priority=P1&task_id=task-7&q=LOG-E2E-000', { waitUntil: 'networkidle' });
  await expect(page.getByRole('textbox', { name: '按处理编号筛选' })).toHaveValue('task-7');
  await expect(page.getByRole('textbox', { name: '搜索：说明/事件/局号' })).toHaveValue('LOG-E2E-000');
  await expect(page.getByRole('button', { name: '刷新' })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard/mistakes', { waitUntil: 'networkidle' });
  await expect(page.getByText('共 6 条记录')).toBeVisible();
  await expect(page.getByText('共 6 条', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '搜索局号' })).toBeVisible();
  await expect(page.getByText('重 置')).toBeVisible();
});
