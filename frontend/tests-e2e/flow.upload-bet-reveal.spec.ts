import { test, expect } from '@playwright/test';

import { adminLogin, injectAdminToken, e2eReset, e2eSeedGames, e2eSeedBets, e2eSeedLogs } from './helpers';

test('规则模式：造数→日志导出', async ({ page, baseURL }) => {
  const token = await adminLogin(baseURL!);
  await e2eReset(baseURL!, token, { scope: 'all', keep_balance: true, prediction_mode: 'rule', boot_number: 1 });
  await e2eSeedGames(baseURL!, token, { boot_number: 1, count: 20, pattern: 'alternate', prediction_mode: 'rule' });
  await e2eSeedBets(baseURL!, token, { boot_number: 1, game_number: 1, count: 3, amount: 100, direction: '庄' });
  await e2eSeedLogs(baseURL!, token, { boot_number: 1, game_number: 1, count: 200, priority: 'P3' });
  await injectAdminToken(page, token);

  await page.goto('/dashboard/logs', { waitUntil: 'networkidle' });
  await expect(page).toHaveURL(/\/dashboard\/logs/);

  const downloadPromise = page.waitForEvent('download');
  await page.getByTitle('导出表格').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^日志_\d{8}_\d{6}\.csv$/);
});
