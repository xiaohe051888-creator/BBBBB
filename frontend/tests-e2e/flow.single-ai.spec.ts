import { test, expect } from '@playwright/test';

import { adminLoginAndInject, e2eSeedLogs } from './helpers';
import { startMockOpenAI } from './mockOpenAI';

test('单AI配置→测试→启用→日志页刷新与导出', async ({ page, baseURL }) => {
  const mock = await startMockOpenAI();
  const token = await adminLoginAndInject(baseURL!, page);

  await page.goto('/admin', { waitUntil: 'networkidle' });

  await page.getByRole('tab', { name: /AI大模型与规则引擎/ }).click();
  await page.getByRole('button', { name: /选择模式/ }).click();

  await page.getByRole('button', { name: /配置\/测试 DeepSeek V4 Pro/ }).click();

  await page.getByPlaceholder('请输入接口密钥').fill('sk-test-1234567890');
  await page.getByPlaceholder('例如：接口地址').fill(mock.baseURL);

  await page.getByRole('button', { name: '保存配置' }).click();
  await expect(page.getByText(/接口配置保存成功/)).toBeVisible();
  await expect(page.getByText(/已保存过密钥，不修改请留空/)).toBeVisible();

  const testRespPromise = page.waitForResponse((r) => {
    const u = r.url();
    return u.includes('/api/admin/api-config/test') && r.request().method() === 'POST';
  });
  await page.getByRole('button', { name: '测试连通性' }).click();
  const testResp = await testRespPromise;
  const testJson = await testResp.json();
  expect(testJson.success).toBe(true);

  await page.keyboard.press('Escape');
  const enableSingle = page.getByRole('button', { name: /启用 单AI 模式/ });
  await expect(enableSingle).toBeEnabled({ timeout: 20_000 });
  await enableSingle.click();
  await expect(page.getByText(/已切换至.*单AI模式/)).toBeVisible();

  await page.goto('/dashboard/logs', { waitUntil: 'networkidle' });

  await e2eSeedLogs(baseURL!, token, { boot_number: 1, game_number: 1, count: 50, priority: 'P3' });

  await page.getByRole('button', { name: '刷新' }).click();
  await expect(page.getByText('已刷新')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByTitle('导出表格').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^日志_\d{8}_\d{6}\.csv$/);

  await mock.close();
});
