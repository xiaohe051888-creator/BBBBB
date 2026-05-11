# 顶部极简安装按钮 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把首页安装入口收敛为顶部单个 `安装 App` 按钮，并移除所有说明层、引导层和整块容器结构。

**Architecture:** 保留 `DashboardPage -> useInstallPromptState -> InstallAppEntry` 主链路，但把 Hook 收敛为最小状态，只暴露 `visible` 和 `triggerInstall()`。`InstallAppEntry` 改成纯按钮组件，删除安卓帮助层和 iPhone 引导层接线，同时更新页面和测试只验证“按钮显示/隐藏/点击触发安装”。

**Tech Stack:** React, TypeScript, Ant Design, Vitest, jsdom, Vite

---

## 文件结构与职责

- `frontend/src/hooks/useInstallPromptState.ts`
  - 收敛为极简状态源，只提供 `visible` 和 `triggerInstall`
- `frontend/src/components/dashboard/InstallAppEntry.tsx`
  - 改为只渲染一个顶部按钮
- `frontend/src/pages/DashboardPage.tsx`
  - 改为只给 `InstallAppEntry` 传 `visible` 和 `onInstall`
- `frontend/src/components/dashboard/InstallAppEntry.test.tsx`
  - 更新为校验单按钮行为
- `frontend/src/hooks/useInstallPromptState.test.ts`
  - 更新为校验极简 Hook 行为
- `frontend/src/pages/DashboardInstallEntry.test.tsx`
  - 更新为校验首页顶部接线
- `frontend/src/components/dashboard/InstallAppHelp.tsx`
  - 删除
- `frontend/src/components/dashboard/InstallAppHelp.test.tsx`
  - 删除
- `frontend/src/components/dashboard/InstallAppGuide.tsx`
  - 删除
- `frontend/src/components/dashboard/InstallAppGuide.test.tsx`
  - 删除或移出相关回归命令

---

### Task 1: 收敛 Hook 到最小安装状态

**Files:**
- Modify: `frontend/src/hooks/useInstallPromptState.ts`
- Test: `frontend/src/hooks/useInstallPromptState.test.ts`

- [ ] **Step 1: 写失败测试，锁定极简 Hook 接口**

```ts
// frontend/src/hooks/useInstallPromptState.test.ts
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useInstallPromptState } from './useInstallPromptState';

describe('useInstallPromptState', () => {
  it('returns visible when app is not installed', () => {
    const { result } = renderHook(() =>
      useInstallPromptState({
        displayModeStandalone: false,
        navigatorStandalone: false,
      }),
    );

    expect(result.current.visible).toBe(true);
    expect(typeof result.current.triggerInstall).toBe('function');
    expect('platform' in result.current).toBe(false);
    expect('helpVisible' in result.current).toBe(false);
    expect('guideVisible' in result.current).toBe(false);
  });

  it('hides button when app is already installed', () => {
    const { result } = renderHook(() =>
      useInstallPromptState({
        displayModeStandalone: true,
        navigatorStandalone: false,
      }),
    );

    expect(result.current.visible).toBe(false);
  });

  it('returns unavailable when install event does not exist', async () => {
    const { result } = renderHook(() =>
      useInstallPromptState({
        displayModeStandalone: false,
        navigatorStandalone: false,
      }),
    );

    await act(async () => {
      const outcome = await result.current.triggerInstall();
      expect(outcome).toEqual({ outcome: 'unavailable' });
    });
  });
});
```

- [ ] **Step 2: 运行测试，确认红灯**

Run:

```bash
cd /workspace/frontend
npm test -- --run src/hooks/useInstallPromptState.test.ts
```

Expected:

- 旧 Hook 仍返回 `platform`、`helpVisible`、`guideVisible`
- 新接口断言失败

- [ ] **Step 3: 最小实现极简 Hook**

```ts
// frontend/src/hooks/useInstallPromptState.ts
import { useCallback, useEffect, useState } from 'react';

import { isStandaloneDisplayMode } from '../pwa/installPrompt';

type InstallChoice = {
  outcome: 'accepted' | 'dismissed';
  platform: string;
};

type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

type Options = {
  displayModeStandalone?: boolean;
  navigatorStandalone?: boolean;
};

type InstallResult = InstallChoice | { outcome: 'unavailable' };

export function useInstallPromptState(options: Options = {}) {
  const {
    displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches,
    navigatorStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  } = options;

  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEventLike | null>(null);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEventLike;
      promptEvent.preventDefault();
      setInstallEvent(promptEvent);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const visible = !isStandaloneDisplayMode({
    displayModeStandalone,
    navigatorStandalone,
  });

  const triggerInstall = useCallback(async (): Promise<InstallResult> => {
    if (!installEvent) {
      return { outcome: 'unavailable' };
    }

    await installEvent.prompt();
    return installEvent.userChoice;
  }, [installEvent]);

  return {
    visible,
    triggerInstall,
  };
}
```

- [ ] **Step 4: 重新运行测试，确认绿灯**

Run:

```bash
cd /workspace/frontend
npm test -- --run src/hooks/useInstallPromptState.test.ts
```

Expected:

- `1` 个测试文件通过
- Hook 不再暴露帮助层与引导层状态

- [ ] **Step 5: 提交**

```bash
cd /workspace
git add frontend/src/hooks/useInstallPromptState.ts frontend/src/hooks/useInstallPromptState.test.ts
git commit -m "refactor(pwa): simplify install prompt state"
```

---

### Task 2: 把安装入口组件改成单按钮并删除说明组件

**Files:**
- Modify: `frontend/src/components/dashboard/InstallAppEntry.tsx`
- Test: `frontend/src/components/dashboard/InstallAppEntry.test.tsx`
- Delete: `frontend/src/components/dashboard/InstallAppHelp.tsx`
- Delete: `frontend/src/components/dashboard/InstallAppHelp.test.tsx`
- Delete: `frontend/src/components/dashboard/InstallAppGuide.tsx`
- Delete: `frontend/src/components/dashboard/InstallAppGuide.test.tsx`

- [ ] **Step 1: 写失败测试，锁定单按钮行为**

```tsx
// frontend/src/components/dashboard/InstallAppEntry.test.tsx
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { InstallAppEntry } from './InstallAppEntry';

describe('InstallAppEntry', () => {
  it('renders only one install button when visible', async () => {
    const onInstall = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<InstallAppEntry visible onInstall={onInstall} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons).toHaveLength(1);
    expect(container.innerHTML).toContain('安装 App');
    expect(container.innerHTML).not.toContain('像 App 一样打开');
    expect(container.innerHTML).not.toContain('安装到桌面');

    await act(async () => root.unmount());
  });

  it('calls install handler when clicked', async () => {
    const onInstall = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<InstallAppEntry visible onInstall={onInstall} />);
    });

    const button = container.querySelector('button');
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onInstall).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });
});
```

- [ ] **Step 2: 运行测试，确认红灯**

Run:

```bash
cd /workspace/frontend
npm test -- --run src/components/dashboard/InstallAppEntry.test.tsx
```

Expected:

- 旧组件还要求 `platform`、`guideVisible`、`helpVisible`
- 当前实现仍渲染说明结构

- [ ] **Step 3: 最小实现单按钮并删除不再需要的组件**

```tsx
// frontend/src/components/dashboard/InstallAppEntry.tsx
import React from 'react';
import { Button } from 'antd';

type Props = {
  visible: boolean;
  onInstall: () => Promise<unknown> | unknown;
};

export function InstallAppEntry({ visible, onInstall }: Props) {
  if (!visible) {
    return null;
  }

  return (
    <div style={{ padding: '8px 16px 0 16px' }}>
      <Button size="small" type="default" onClick={() => void onInstall()}>
        安装 App
      </Button>
    </div>
  );
}
```

```bash
cd /workspace
rm -f frontend/src/components/dashboard/InstallAppHelp.tsx
rm -f frontend/src/components/dashboard/InstallAppHelp.test.tsx
rm -f frontend/src/components/dashboard/InstallAppGuide.tsx
rm -f frontend/src/components/dashboard/InstallAppGuide.test.tsx
```

- [ ] **Step 4: 重新运行测试，确认绿灯**

Run:

```bash
cd /workspace/frontend
npm test -- --run src/components/dashboard/InstallAppEntry.test.tsx
```

Expected:

- 单按钮测试通过
- 不再依赖任何说明层组件

- [ ] **Step 5: 提交**

```bash
cd /workspace
git add frontend/src/components/dashboard/InstallAppEntry.tsx frontend/src/components/dashboard/InstallAppEntry.test.tsx
git rm frontend/src/components/dashboard/InstallAppHelp.tsx frontend/src/components/dashboard/InstallAppHelp.test.tsx frontend/src/components/dashboard/InstallAppGuide.tsx frontend/src/components/dashboard/InstallAppGuide.test.tsx
git commit -m "refactor(pwa): reduce install entry to top button"
```

---

### Task 3: 更新首页接线到极简接口

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Test: `frontend/src/pages/DashboardInstallEntry.test.tsx`

- [ ] **Step 1: 写失败测试，锁定首页只给按钮最小 props**

```tsx
// frontend/src/pages/DashboardInstallEntry.test.tsx
import React from 'react';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import DashboardPage from './DashboardPage';

const installEntrySpy = vi.fn(() => <div>install-button-entry</div>);

vi.mock('../components/dashboard/InstallAppEntry', () => ({
  InstallAppEntry: (props: unknown) => installEntrySpy(props),
}));

vi.mock('../hooks/useInstallPromptState', () => ({
  useInstallPromptState: () => ({
    visible: true,
    triggerInstall: vi.fn(),
  }),
}));

describe('DashboardInstallEntry', () => {
  it('wires top install button with visible and onInstall only', async () => {
    const queryClient = new QueryClient();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/dashboard']}>
            <DashboardPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    expect(container.innerHTML).toContain('install-button-entry');
    const props = installEntrySpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(props.visible).toBe(true);
    expect(typeof props.onInstall).toBe('function');
    expect('platform' in props).toBe(false);
    expect('helpVisible' in props).toBe(false);
    expect('guideVisible' in props).toBe(false);

    await act(async () => root.unmount());
  });
});
```

- [ ] **Step 2: 运行测试，确认红灯**

Run:

```bash
cd /workspace/frontend
npm test -- --run src/pages/DashboardInstallEntry.test.tsx
```

Expected:

- 页面仍向组件传入旧的 `platform/helpVisible/guideVisible`
- 新断言失败

- [ ] **Step 3: 最小实现首页接线更新**

```tsx
// frontend/src/pages/DashboardPage.tsx
<InstallAppEntry visible={installPrompt.visible} onInstall={installPrompt.triggerInstall} />
```

- [ ] **Step 4: 重新运行测试，确认绿灯**

Run:

```bash
cd /workspace/frontend
npm test -- --run src/pages/DashboardInstallEntry.test.tsx
```

Expected:

- 页面测试通过
- 顶部按钮仍在原位置挂载

- [ ] **Step 5: 提交**

```bash
cd /workspace
git add frontend/src/pages/DashboardPage.tsx frontend/src/pages/DashboardInstallEntry.test.tsx
git commit -m "refactor(pwa): wire simple top install button"
```

---

### Task 4: 全量回归、构建、推送部署

**Files:**
- Verify: `frontend/src/hooks/useInstallPromptState.ts`
- Verify: `frontend/src/components/dashboard/InstallAppEntry.tsx`
- Verify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: 运行相关测试集**

Run:

```bash
cd /workspace/frontend
npm test -- --run \
  src/hooks/useInstallPromptState.test.ts \
  src/components/dashboard/InstallAppEntry.test.tsx \
  src/pages/DashboardInstallEntry.test.tsx \
  src/components/dashboard/AdminAlertsBar.test.tsx \
  src/components/dashboard/DashboardHeader.test.tsx
```

Expected:

- 所有相关测试通过
- 不再引用 `InstallAppHelp` 或 `InstallAppGuide`

- [ ] **Step 2: 跑生产构建**

Run:

```bash
cd /workspace/frontend
npm run build
```

Expected:

- 构建成功
- 产物继续生成 `dist/manifest.webmanifest` 和 `dist/sw.js`

- [ ] **Step 3: 运行 lint / 类型检查**

Run:

```bash
cd /workspace/frontend
npm exec eslint -- src/hooks/useInstallPromptState.ts src/components/dashboard/InstallAppEntry.tsx src/pages/DashboardPage.tsx
npx tsc -p tsconfig.json --noEmit
```

Expected:

- 无新增 lint / TypeScript 错误

- [ ] **Step 4: 最终提交并推送**

```bash
cd /workspace
git add frontend/src/hooks/useInstallPromptState.ts frontend/src/hooks/useInstallPromptState.test.ts frontend/src/components/dashboard/InstallAppEntry.tsx frontend/src/components/dashboard/InstallAppEntry.test.tsx frontend/src/pages/DashboardPage.tsx frontend/src/pages/DashboardInstallEntry.test.tsx
git commit -m "refactor(pwa): simplify install entry to single top button"
git push origin main
```

Expected:

- 远端接收提交
- Render 自动开始部署

- [ ] **Step 5: 确认部署**

Run:

```bash
# 通过 Render 后台或线上页面确认新提交 live
```

Expected:

- Render 显示最新提交 `Deploy live`
- 首页顶部只剩一个简单的 `安装 App` 按钮

---

## Self-Review

- **Spec coverage:** 已覆盖顶部单按钮、已安装隐藏、删除说明层/引导层、最小 Hook 接口、首页极简接线、测试与部署验证。
- **Placeholder scan:** 没有 `TODO`、`TBD`、`类似 Task N` 等占位描述；每个任务都给了明确文件、代码与命令。
- **Type consistency:** 全部围绕 `visible` 与 `onInstall/triggerInstall` 两个最小接口展开，后续任务不再引用旧的 `platform/helpVisible/guideVisible`。 
