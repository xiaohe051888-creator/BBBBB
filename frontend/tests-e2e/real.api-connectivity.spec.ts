import { test, expect, request } from '@playwright/test';

import { adminLogin } from './helpers';

test('真实上游：已保存密钥时单AI连通性应通过', async ({ baseURL }) => {
  if (process.env.E2E_REAL_AI !== '1') test.skip(true, '未开启 E2E_REAL_AI=1，跳过真实上游用例');
  const token = await adminLogin(baseURL!);
  const ctx = await request.newContext({
    baseURL: baseURL!,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });

  const statusRes = await ctx.get('/api/admin/three-model-status');
  const statusJson = await statusRes.json();
  const single = statusJson.models?.single;
  if (!single?.api_key_set) {
    await ctx.dispose();
    test.skip(true, '未保存单AI密钥，跳过真实上游连通性用例');
  }

  const testRes = await ctx.post('/api/admin/api-config/test', {
    data: {
      role: 'single',
      provider: single.provider || 'deepseek',
      model: single.model || 'deepseek-v4-pro',
      api_key: '',
      base_url: single.base_url || 'https://api.deepseek.com',
    },
  });
  const testJson = await testRes.json();
  await ctx.dispose();

  expect(testRes.ok()).toBe(true);
  expect(testJson.success).toBe(true);
});
