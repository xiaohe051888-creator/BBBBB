# Mobile PWA Install And Baccarat Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让前端支持安卓标准安装、兼容 iPhone 添加到主屏幕，并补齐“智能分析百家乐”主题的 PWA 图标与安全缓存壳。

**Architecture:** 采用 `vite-plugin-pwa` 生成标准安装壳和 service worker，把 PWA 配置收敛到独立模块中供 `vite.config.ts` 与测试共享。缓存只覆盖稳定静态资源，`/api` 与 `/ws` 明确排除，避免实时状态被离线缓存污染。

**Tech Stack:** Vite 8, React 18, TypeScript, Vitest, vite-plugin-pwa, Sharp, Node.js

---

## 文件结构

### 需要新增

- `frontend/src/pwa/config.ts`
  - 集中定义 manifest、图标清单、workbox denylist 与 runtime caching 规则。
- `frontend/src/pwa/config.test.ts`
  - 校验 manifest 字段、图标路径、`/api` 与 `/ws` 的缓存排除规则。
- `frontend/src/pwa/registerServiceWorker.ts`
  - 只在生产环境注册 service worker，并在失败时静默降级为普通网页。
- `frontend/src/pwa/registerServiceWorker.test.ts`
  - 校验生产环境注册、开发环境跳过、缺少 `serviceWorker` 时跳过、异常时不抛出。
- `frontend/src/pwa/indexHtmlMeta.test.ts`
  - 读取 `frontend/index.html`，检查安装相关 meta 与 manifest 链接。
- `frontend/src/pwa/iconAssets.test.ts`
  - 检查生成后的 PNG 图标是否存在且尺寸符合要求。
- `frontend/src/pwa/buildOutput.test.ts`
  - 读取 `frontend/dist`，校验最终构建产物包含 manifest、sw、图标与入口引用。
- `frontend/scripts/generate-pwa-icons.mjs`
  - 把 SVG 源图导出为 `192x192`、`512x512`、`maskable` 与 `apple-touch-icon` PNG。
- `frontend/public/pwa/icon-source.svg`
  - “智能分析百家乐”主题主图标源文件。

### 需要修改

- `frontend/package.json`
  - 增加 `vite-plugin-pwa`、`sharp` 与 `generate:pwa-icons` 脚本。
- `frontend/vite.config.ts`
  - 接入 `VitePWA`，引用 `src/pwa/config.ts` 中的配置。
- `frontend/src/main.tsx`
  - 调用 `registerServiceWorker()`。
- `frontend/index.html`
  - 增加 `manifest`、`theme-color`、Apple 安装 meta、`apple-touch-icon`。

### 需要生成

- `frontend/public/pwa/icon-192.png`
- `frontend/public/pwa/icon-512.png`
- `frontend/public/pwa/icon-maskable-512.png`
- `frontend/public/pwa/apple-touch-icon.png`

---

### Task 1: 接入 PWA 配置模块与 Vite 插件

**Files:**
- Create: `frontend/src/pwa/config.ts`
- Test: `frontend/src/pwa/config.test.ts`
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: 写失败测试，锁定 manifest 与缓存边界**

```ts
import { describe, expect, it } from 'vitest';

import { pwaManifest, pwaWorkbox } from './config';

describe('pwa config', () => {
  it('uses standalone install metadata and expected icon set', () => {
    expect(pwaManifest.name).toBe('百家乐智能分析');
    expect(pwaManifest.short_name).toBe('智能百家乐');
    expect(pwaManifest.display).toBe('standalone');
    expect(pwaManifest.start_url).toBe('/');
    expect(pwaManifest.icons).toEqual([
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/pwa/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]);
  });

  it('keeps api and websocket traffic out of offline caches', () => {
    expect(pwaWorkbox.navigateFallbackDenylist).toEqual([/^\/api\//, /^\/ws/]);
    expect(pwaWorkbox.runtimeCaching).toHaveLength(3);
    expect(pwaWorkbox.runtimeCaching[0]?.handler).toBe('NetworkOnly');
    expect(String(pwaWorkbox.runtimeCaching[0]?.urlPattern)).toContain('/api/');
    expect(pwaWorkbox.runtimeCaching[1]?.handler).toBe('NetworkOnly');
    expect(String(pwaWorkbox.runtimeCaching[1]?.urlPattern)).toContain('/ws');
  });
});
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `npm test -- --run src/pwa/config.test.ts`

Expected: FAIL，因为 `src/pwa/config.ts` 尚不存在，Vitest 报模块找不到或导出缺失。

- [ ] **Step 3: 安装依赖并写最小实现**

Run: `npm install -D vite-plugin-pwa sharp`

Update `frontend/package.json`:

```json
{
  "scripts": {
    "generate:pwa-icons": "node ./scripts/generate-pwa-icons.mjs"
  },
  "devDependencies": {
    "sharp": "^0.34.0",
    "vite-plugin-pwa": "^1.0.0"
  }
}
```

Create `frontend/src/pwa/config.ts`:

```ts
import type { ManifestOptions, VitePWAOptions } from 'vite-plugin-pwa';

export const pwaManifest: Partial<ManifestOptions> = {
  name: '百家乐智能分析',
  short_name: '智能百家乐',
  description: '百家乐实时智能分析与决策面板',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  theme_color: '#08101f',
  background_color: '#08101f',
  icons: [
    { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/pwa/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

export const pwaWorkbox: NonNullable<VitePWAOptions['workbox']> = {
  globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [/^\/api\//, /^\/ws/],
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/.*\/api\/.*/i,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /^wss?:\/\/.*\/ws.*/i,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: ({ request }) =>
        ['style', 'script', 'worker', 'image', 'font'].includes(request.destination),
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'static-assets' },
    },
  ],
};

export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'prompt',
  injectRegister: false,
  includeAssets: ['favicon.svg', 'pwa/apple-touch-icon.png'],
  manifest: pwaManifest,
  workbox: pwaWorkbox,
  devOptions: { enabled: false },
};
```

Update `frontend/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaOptions } from './src/pwa/config';

export default defineConfig({
  plugins: [react(), VitePWA(pwaOptions)],
  base: '/',
  // 其余现有 server / build 配置保持不变
});
```

- [ ] **Step 4: 再跑测试，确认转绿**

Run: `npm test -- --run src/pwa/config.test.ts`

Expected: PASS，manifest 与缓存排除规则全部通过。

- [ ] **Step 5: 提交**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/src/pwa/config.ts frontend/src/pwa/config.test.ts
git commit -m "feat(pwa): add install config and cache guardrails"
```

### Task 2: 注册 service worker 且不影响开发环境

**Files:**
- Create: `frontend/src/pwa/registerServiceWorker.ts`
- Test: `frontend/src/pwa/registerServiceWorker.test.ts`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: 写失败测试，约束注册行为**

```ts
import { describe, expect, it, vi } from 'vitest';

import { registerServiceWorker } from './registerServiceWorker';

describe('registerServiceWorker', () => {
  it('registers the root service worker in production', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    await registerServiceWorker({
      isProduction: true,
      navigatorRef: { serviceWorker: { register } } as never,
      onError: vi.fn(),
    });
    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('skips registration outside production', async () => {
    const register = vi.fn();
    await registerServiceWorker({
      isProduction: false,
      navigatorRef: { serviceWorker: { register } } as never,
      onError: vi.fn(),
    });
    expect(register).not.toHaveBeenCalled();
  });

  it('swallows registration errors', async () => {
    const onError = vi.fn();
    const register = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(
      registerServiceWorker({
        isProduction: true,
        navigatorRef: { serviceWorker: { register } } as never,
        onError,
      }),
    ).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `npm test -- --run src/pwa/registerServiceWorker.test.ts`

Expected: FAIL，因为 `registerServiceWorker.ts` 尚不存在。

- [ ] **Step 3: 写最小实现并接入入口**

Create `frontend/src/pwa/registerServiceWorker.ts`:

```ts
type RegisterOptions = {
  isProduction?: boolean;
  navigatorRef?: Navigator;
  onError?: (error: unknown) => void;
};

export async function registerServiceWorker({
  isProduction = import.meta.env.PROD,
  navigatorRef = navigator,
  onError = () => undefined,
}: RegisterOptions = {}): Promise<void> {
  if (!isProduction) return;
  if (!('serviceWorker' in navigatorRef)) return;

  try {
    await navigatorRef.serviceWorker.register('/sw.js');
  } catch (error) {
    onError(error);
  }
}
```

Update `frontend/src/main.tsx`:

```ts
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import './styles/global.css';

void registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 4: 再跑测试，确认注册逻辑通过**

Run: `npm test -- --run src/pwa/registerServiceWorker.test.ts`

Expected: PASS，生产环境注册、开发跳过、异常吞掉三类行为都通过。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/main.tsx frontend/src/pwa/registerServiceWorker.ts frontend/src/pwa/registerServiceWorker.test.ts
git commit -m "feat(pwa): register service worker safely"
```

### Task 3: 补齐安装所需 HTML 元信息

**Files:**
- Test: `frontend/src/pwa/indexHtmlMeta.test.ts`
- Modify: `frontend/index.html`

- [ ] **Step 1: 写失败测试，锁定安装入口元信息**

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');

describe('index html pwa meta', () => {
  it('links the manifest and apple touch icon', () => {
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('rel="apple-touch-icon" href="/pwa/apple-touch-icon.png"');
  });

  it('declares standalone friendly mobile meta tags', () => {
    expect(html).toContain('name="theme-color" content="#08101f"');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="智能百家乐"');
  });
});
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `npm test -- --run src/pwa/indexHtmlMeta.test.ts`

Expected: FAIL，因为当前 `index.html` 还没有 `manifest`、`theme-color` 和 Apple 安装 meta。

- [ ] **Step 3: 写最小实现**

Update `frontend/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/pwa/apple-touch-icon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#08101f" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="智能百家乐" />
    <title>百家乐分析预测系统</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: 再跑测试，确认 HTML 元信息转绿**

Run: `npm test -- --run src/pwa/indexHtmlMeta.test.ts`

Expected: PASS，所有安装 meta 和图标链接都存在。

- [ ] **Step 5: 提交**

```bash
git add frontend/index.html frontend/src/pwa/indexHtmlMeta.test.ts
git commit -m "feat(pwa): add install metadata to html shell"
```

### Task 4: 生成“智能分析百家乐”主题图标资源

**Files:**
- Create: `frontend/public/pwa/icon-source.svg`
- Create: `frontend/scripts/generate-pwa-icons.mjs`
- Test: `frontend/src/pwa/iconAssets.test.ts`
- Generate: `frontend/public/pwa/icon-192.png`
- Generate: `frontend/public/pwa/icon-512.png`
- Generate: `frontend/public/pwa/icon-maskable-512.png`
- Generate: `frontend/public/pwa/apple-touch-icon.png`

- [ ] **Step 1: 写失败测试，先锁定图标产物**

```ts
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const rootDir = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const pwaDir = resolve(rootDir, 'public/pwa');

describe('pwa icon assets', () => {
  it('emits required raster icons with expected sizes', async () => {
    const files = [
      ['icon-192.png', 192],
      ['icon-512.png', 512],
      ['icon-maskable-512.png', 512],
      ['apple-touch-icon.png', 180],
    ] as const;

    for (const [fileName, expectedSize] of files) {
      const filePath = resolve(pwaDir, fileName);
      expect(existsSync(filePath)).toBe(true);
      const meta = await sharp(filePath).metadata();
      expect(meta.width).toBe(expectedSize);
      expect(meta.height).toBe(expectedSize);
    }
  });
});
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `npm test -- --run src/pwa/iconAssets.test.ts`

Expected: FAIL，因为 `public/pwa/*.png` 还不存在。

- [ ] **Step 3: 写最小实现，先有源图再生成 PNG**

Create `frontend/public/pwa/icon-source.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#08101f" />
      <stop offset="100%" stop-color="#13264f" />
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6a7bff" />
      <stop offset="100%" stop-color="#a855f7" />
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f6d365" />
      <stop offset="100%" stop-color="#fda085" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="120" fill="url(#bg)" />
  <circle cx="256" cy="256" r="150" fill="none" stroke="url(#accent)" stroke-width="22" opacity="0.9" />
  <path d="M160 312c34-58 72-88 114-88 30 0 58 10 84 31" fill="none" stroke="url(#accent)" stroke-width="22" stroke-linecap="round" />
  <circle cx="352" cy="224" r="18" fill="url(#gold)" />
  <path d="M196 156h42c26 0 46 18 46 42 0 18-12 33-29 39 24 5 39 22 39 45 0 32-24 54-59 54h-39z" fill="#f8fafc" />
  <path d="M284 156h33c46 0 78 26 78 69 0 42-33 69-83 69h-28z" fill="#f8fafc" opacity="0.95" />
  <path d="M154 368h204" stroke="url(#gold)" stroke-width="18" stroke-linecap="round" opacity="0.9" />
</svg>
```

Create `frontend/scripts/generate-pwa-icons.mjs`:

```js
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(here, '..');
const outputDir = resolve(rootDir, 'public/pwa');
const svgPath = resolve(outputDir, 'icon-source.svg');
const svgBuffer = await readFile(svgPath);

await mkdir(outputDir, { recursive: true });

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
];

for (const [fileName, size] of targets) {
  await sharp(svgBuffer)
    .resize(size, size, { fit: 'contain', background: { r: 8, g: 16, b: 31, alpha: 1 } })
    .png()
    .toFile(resolve(outputDir, fileName));
}
```

Run: `npm run generate:pwa-icons`

- [ ] **Step 4: 再跑测试，确认图标尺寸与文件都正确**

Run: `npm test -- --run src/pwa/iconAssets.test.ts`

Expected: PASS，四个 PNG 图标都存在，尺寸分别是 `192`、`512`、`512`、`180`。

- [ ] **Step 5: 提交**

```bash
git add frontend/public/pwa frontend/scripts/generate-pwa-icons.mjs frontend/src/pwa/iconAssets.test.ts
git commit -m "feat(pwa): add baccarat install icon assets"
```

### Task 5: 验证最终构建产物与安装壳

**Files:**
- Test: `frontend/src/pwa/buildOutput.test.ts`

- [ ] **Step 1: 写失败测试，检查最终构建必须带出安装资源**

```ts
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rootDir = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const distDir = resolve(rootDir, 'dist');

describe('pwa build output', () => {
  it('ships manifest, service worker and icon assets in dist', () => {
    expect(existsSync(resolve(distDir, 'manifest.webmanifest'))).toBe(true);
    expect(existsSync(resolve(distDir, 'sw.js'))).toBe(true);
    expect(existsSync(resolve(distDir, 'pwa/icon-192.png'))).toBe(true);
    expect(existsSync(resolve(distDir, 'pwa/icon-512.png'))).toBe(true);

    const html = readFileSync(resolve(distDir, 'index.html'), 'utf8');
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('name="theme-color"');
  });
});
```

- [ ] **Step 2: 先跑构建加测试，确认当前失败**

Run: `npm run build && npm test -- --run src/pwa/buildOutput.test.ts`

Expected: 在前四个任务未完成前，这里会因为 `manifest.webmanifest`、`sw.js` 或 `pwa` 图标缺失而失败。

- [ ] **Step 3: 在前四个任务完成后重跑构建并验证最终结果**

Run: `npm run build && npm test -- --run src/pwa/buildOutput.test.ts`

Expected: PASS，`dist` 中存在 `manifest.webmanifest`、`sw.js`、PWA 图标，且入口 HTML 带有安装元信息。

再补一轮人工检查：

Run: `npm run preview -- --host 0.0.0.0 --port 4173`

在浏览器中确认：

```text
1. 页面能正常打开
2. DevTools Application 面板能看到 Manifest
3. Service Worker 已注册
4. 安卓浏览器能出现安装入口
5. iPhone Safari 可添加到主屏幕
```

- [ ] **Step 4: 运行完整回归测试**

Run: `npm test -- --run src/pwa/config.test.ts src/pwa/registerServiceWorker.test.ts src/pwa/indexHtmlMeta.test.ts src/pwa/iconAssets.test.ts src/pwa/buildOutput.test.ts`

Expected: PASS，PWA 相关单测全部通过。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/pwa/buildOutput.test.ts
git commit -m "test(pwa): verify installable build output"
```

---

## 自检

- 规格覆盖：
  - 安卓标准安装：Task 1、Task 3、Task 5
  - iPhone 添加到主屏幕：Task 3、Task 5
  - 保守缓存与排除 `/api`、`/ws`：Task 1
  - 图标设计与导出：Task 4
  - 独立窗口与启动壳：Task 1、Task 3、Task 5
- 占位符扫描：
  - 无 `TODO`、`TBD`、`implement later`
- 类型一致性：
  - `pwaManifest`、`pwaWorkbox`、`pwaOptions`、`registerServiceWorker()` 命名在任务内保持一致

## 执行交接

Plan complete and saved to `docs/superpowers/plans/2026-05-10-mobile-pwa-install-and-baccarat-icon-implementation-plan.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
