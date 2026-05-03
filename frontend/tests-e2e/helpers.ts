import { request } from '@playwright/test';

export const adminLoginAndInject = async (baseURL: string, page: import('@playwright/test').Page) => {
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post('/api/admin/login', { data: { password: '8888' } });
  const body = await res.json();
  const token = body.token as string;

  const authed = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  await authed.post('/api/system/prediction-mode', { data: { mode: 'rule' } });
  await authed.dispose();
  await ctx.dispose();

  await page.addInitScript(([t]) => {
    localStorage.setItem('admin_token', t);
    localStorage.setItem('mode_selected', '1');
  }, [token]);

  return token;
};
