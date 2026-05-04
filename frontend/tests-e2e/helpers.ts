import { request } from '@playwright/test';

export const adminLogin = async (baseURL: string) => {
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post('/api/admin/login', { data: { password: '8888' } });
  const body = await res.json();
  await ctx.dispose();
  return body.token as string;
};

export const injectAdminToken = async (page: import('@playwright/test').Page, token: string) => {
  await page.addInitScript(([t]) => {
    localStorage.setItem('admin_token', t);
    localStorage.setItem('mode_selected', '1');
  }, [token]);
};

export const adminLoginAndInject = async (baseURL: string, page: import('@playwright/test').Page) => {
  const token = await adminLogin(baseURL);
  const ctx = await authedContext(baseURL, token);
  await ctx.post('/api/system/prediction-mode', { data: { mode: 'rule' } });
  await ctx.dispose();
  await injectAdminToken(page, token);
  return token;
};

const authedContext = async (baseURL: string, token: string) => {
  return request.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
};

export const e2eReset = async (
  baseURL: string,
  token: string,
  payload: { scope?: string; keep_balance?: boolean; prediction_mode?: string; boot_number?: number }
) => {
  const ctx = await authedContext(baseURL, token);
  const r = await ctx.post('/api/admin/e2e/reset', { data: payload });
  await ctx.dispose();
  if (!r.ok()) throw new Error(`e2eReset failed: ${r.status()}`);
};

export const e2eSeedGames = async (baseURL: string, token: string, payload: Record<string, unknown>) => {
  const ctx = await authedContext(baseURL, token);
  const r = await ctx.post('/api/admin/e2e/seed/games', { data: payload });
  await ctx.dispose();
  if (!r.ok()) throw new Error(`e2eSeedGames failed: ${r.status()}`);
};

export const e2eSeedBets = async (baseURL: string, token: string, payload: Record<string, unknown>) => {
  const ctx = await authedContext(baseURL, token);
  const r = await ctx.post('/api/admin/e2e/seed/bets', { data: payload });
  await ctx.dispose();
  if (!r.ok()) throw new Error(`e2eSeedBets failed: ${r.status()}`);
};

export const e2eSeedLogs = async (baseURL: string, token: string, payload: Record<string, unknown>) => {
  const ctx = await authedContext(baseURL, token);
  const r = await ctx.post('/api/admin/e2e/seed/logs', { data: payload });
  await ctx.dispose();
  if (!r.ok()) throw new Error(`e2eSeedLogs failed: ${r.status()}`);
};
