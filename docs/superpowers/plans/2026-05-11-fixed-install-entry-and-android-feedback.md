# 固定安装入口与安卓安装反馈 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让首页安装按钮在未安装状态下固定显示，并在安卓无法直接拉起安装时立即给出中文说明。

**Architecture:** 保留现有 `DashboardPage -> useInstallPromptState -> InstallAppEntry` 结构，把“是否显示入口”从“平台+冷却”改成“仅由已安装状态决定”。同时新增一个安卓帮助说明层，与现有 iPhone 引导层并列，由 `useInstallPromptState` 提供统一状态和打开/关闭动作。

**Tech Stack:** React, TypeScript, Ant Design, Vitest, jsdom, Vite

---

## 文件结构与职责

- `frontend/src/pwa/installPrompt.ts`
  - 负责平台识别、已安装判断、常量定义
  - 删除关闭冷却相关逻辑与常量
- `frontend/src/hooks/useInstallPromptState.ts`
  - 负责安装入口显示状态、平台状态、安卓帮助层与 iPhone 引导层状态
- `frontend/src/components/dashboard/InstallAppEntry.tsx`
  - 负责固定入口渲染与主按钮点击分流
- `frontend/src/components/dashboard/InstallAppGuide.tsx`
  - 继续承载 iPhone 三步引导
- `frontend/src/components/dashboard/InstallAppHelp.tsx`
  - 新增，负责安卓“为什么没弹安装框”的中文帮助说明
- `frontend/src/pages/DashboardPage.tsx`
  - 继续在顶部辅助信息区挂载安装入口，但不再传“稍后隐藏”逻辑
- `frontend/src/pwa/installPrompt.test.ts`
  - 校验平台识别与已安装判断
- `frontend/src/hooks/useInstallPromptState.test.ts`
  - 校验入口固定显示、安卓不可安装时的帮助状态、已安装隐藏
- `frontend/src/components/dashboard/InstallAppEntry.test.tsx`
  - 校验安卓直接安装、安卓帮助说明、iPhone 引导说明
- `frontend/src/components/dashboard/InstallAppHelp.test.tsx`
  - 校验安卓说明层文案与关闭行为
- `frontend/src/pages/DashboardInstallEntry.test.tsx`
  - 校验首页顶部仍然挂载安装入口

---

### Task 1: 重构安装状态判断与 Hook

**Files:**
- Modify: `frontend/src/pwa/installPrompt.ts`
- Modify: `frontend/src/hooks/useInstallPromptState.ts`
- Test: `frontend/src/pwa/installPrompt.test.ts`
- Test: `frontend/src/hooks/useInstallPromptState.test.ts`

- [ ] **Step 1: 写失败测试，锁定新平台状态与固定显示逻辑**

```ts
// frontend/src/pwa/installPrompt.test.ts
import { describe, expect, it } from 'vitest';

import { detectInstallPlatform, isStandaloneDisplayMode } from './installPrompt';

describe('detectInstallPlatform', () => {
  it('returns ios for iphone safari', () => {
    expect(
      detectInstallPlatform({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        hasBeforeInstallPrompt: false,
      }),
    ).toBe('ios');
  });

  it('returns android-ready when beforeinstallprompt is available', () => {
    expect(
      detectInstallPlatform({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        hasBeforeInstallPrompt: true,
      }),
    ).toBe('android-ready');
  });

  it('returns android-help when android has no install event yet', () => {
    expect(
      detectInstallPlatform({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        hasBeforeInstallPrompt: false,
      }),
    ).toBe('android-help');
  });
});

describe('isStandaloneDisplayMode', () => {
  it('returns true when standalone display mode is active', () => {
    expect(
      isStandaloneDisplayMode({
        displayModeStandalone: true,
        navigatorStandalone: false,
      }),
    ).toBe(true);
  });
});
```

```ts
// frontend/src/hooks/useInstallPromptState.test.ts
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useInstallPromptState } from './useInstallPromptState';

describe('useInstallPromptState', () => {
  it('keeps entry visible for android even without install event', () => {
    const { result } = renderHook(() =>
      useInstallPromptState({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        displayModeStandalone: false,
        navigatorStandalone: false,
      }),
    );

    expect(result.current.platform).toBe('android-help');
    expect(result.current.visible).toBe(true);
  });

  it('hides entry when already installed', () => {
    const { result } = renderHook(() =>
      useInstallPromptState({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        displayModeStandalone: true,
        navigatorStandalone: false,
      }),
    );

    expect(result.current.visible).toBe(false);
  });

  it('opens android help when install is unavailable', async () => {
    const { result } = renderHook(() =>
      useInstallPromptState({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        displayModeStandalone: false,
        navigatorStandalone: false,
      }),
    );

    await act(async () => {
      const choice = await result.current.triggerInstall();
      expect(choice.outcome).toBe('unavailable');
    });

    expect(result.current.helpVisible).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试，确认红灯**

Run:

```bash
cd /workspace/frontend
npm test -- --run src/pwa/installPrompt.test.ts src/hooks/useInstallPromptState.test.ts
```

Expected:

- `detectInstallPlatform` 仍返回旧的 `android | ios | none`
- Hook 还没有 `helpVisible`
- 旧的关闭冷却逻辑相关断言或类型报错出现

- [ ] **Step 3: 最小实现平台状态与 Hook 重构**

```ts
// frontend/src/pwa/installPrompt.ts
type InstallPlatform = 'android-ready' | 'android-help' | 'ios';

export function detectInstallPlatform({
  userAgent,
  hasBeforeInstallPrompt,
}: DetectInstallPlatformArgs): InstallPlatform {
  const ua = userAgent.toLowerCase();
  const isIphone = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|chrome/.test(ua);
  const isAndroid = /android/.test(ua);

  if (isIphone && isSafari) {
    return 'ios';
  }

  if (isAndroid && hasBeforeInstallPrompt) {
    return 'android-ready';
  }

  return 'android-help';
}
```

```ts
// frontend/src/hooks/useInstallPromptState.ts
export function useInstallPromptState(options: Options = {}) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEventLike | null>(null);
  const [guideVisible, setGuideVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);

  const platform = useMemo(
    () =>
      detectInstallPlatform({
        userAgent,
        hasBeforeInstallPrompt: Boolean(installEvent),
      }),
    [installEvent, userAgent],
  );

  const installed = isStandaloneDisplayMode({
    displayModeStandalone,
    navigatorStandalone,
  });

  const visible = !installed;

  const openGuide = useCallback(() => setGuideVisible(true), []);
  const closeGuide = useCallback(() => setGuideVisible(false), []);
  const openHelp = useCallback(() => setHelpVisible(true), []);
  const closeHelp = useCallback(() => setHelpVisible(false), []);

  const triggerInstall = useCallback(async (): Promise<InstallResult> => {
    if (!installEvent) {
      setHelpVisible(true);
      return { outcome: 'unavailable' };
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    return choice;
  }, [installEvent]);

  return {
    platform,
    visible,
    guideVisible,
    helpVisible,
    openGuide,
    closeGuide,
    openHelp,
    closeHelp,
    triggerInstall,
  };
}
```

- [ ] **Step 4: 重新运行测试，确认绿灯**

Run:

```bash
cd /workspace/frontend
npm test -- --run src/pwa/installPrompt.test.ts src/hooks/useInstallPromptState.test.ts
```

Expected:

- `2` 个测试文件全部通过
- 不再出现关闭冷却相关引用

- [ ] **Step 5: 提交**

```bash
cd /workspace
git add frontend/src/pwa/installPrompt.ts frontend/src/pwa/installPrompt.test.ts frontend/src/hooks/useInstallPromptState.ts frontend/src/hooks/useInstallPromptState.test.ts
git commit -m "feat(pwa): keep install entry visible before install"
```

---

### Task 2: 新增安卓帮助说明层并更新安装入口组件

**Files:**
- Create: `frontend/src/components/dashboard/InstallAppHelp.tsx`
- Test: `frontend/src/components/dashboard/InstallAppHelp.test.tsx`
- Modify: `frontend/src/components/dashboard/InstallAppEntry.tsx`
- Test: `frontend/src/components/dashboard/InstallAppEntry.test.tsx`

- [ ] **Step 1: 写失败测试，锁定安卓帮助说明与按钮分流**

```tsx
// frontend/src/components/dashboard/InstallAppHelp.test.tsx
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { InstallAppHelp } from './InstallAppHelp';

describe('InstallAppHelp', () => {
  it('renders android fallback guidance in chinese', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<InstallAppHelp visible onClose={vi.fn()} />);
    });

    expect(container.innerHTML).toContain('暂时没有返回安装能力');
    expect(container.innerHTML).toContain('安装应用');
    expect(container.innerHTML).toContain('添加到主屏幕');

    await act(async () => root.unmount());
  });
});
```

```tsx
// frontend/src/components/dashboard/InstallAppEntry.test.tsx
it('shows android help instead of doing nothing when install is unavailable', async () => {
  const onOpenHelp = vi.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <InstallAppEntry
        visible
        platform="android-help"
        guideVisible={false}
        helpVisible={false}
        onInstall={vi.fn()}
        onOpenGuide={vi.fn()}
        onCloseGuide={vi.fn()}
        onOpenHelp={onOpenHelp}
        onCloseHelp={vi.fn()}
      />,
    );
  });

  const button = Array.from(container.querySelectorAll('button')).find((node) =>
    (node.textContent || '').includes('安装 App'),
  );

  await act(async () => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  expect(onOpenHelp).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});
```

- [ ] **Step 2: 运行测试，确认红灯**

Run:

```bash
cd /workspace/frontend
npm test -- --run src/components/dashboard/InstallAppHelp.test.tsx src/components/dashboard/InstallAppEntry.test.tsx
```

Expected:

- `InstallAppHelp.tsx` 文件不存在
- `InstallAppEntry` 还不认识 `android-help`
- 组件 props 缺少 `helpVisible` / `onOpenHelp` / `onCloseHelp`

- [ ] **Step 3: 实现安卓帮助说明层与入口点击分流**

```tsx
// frontend/src/components/dashboard/InstallAppHelp.tsx
import React from 'react';
import { Button } from 'antd';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function InstallAppHelp({ visible, onClose }: Props) {
  if (!visible) return null;

  return (
    <div className="install-app-guide" role="dialog" aria-modal="false">
      <div className="install-app-guide-head">
        <strong>安装 App</strong>
        <Button size="small" type="text" onClick={onClose}>
          关闭
        </Button>
      </div>
      <ol className="install-app-guide-steps">
        <li>当前浏览器暂时没有返回安装能力</li>
        <li>请继续使用 Chrome 打开本站，不要放在内嵌浏览器里</li>
        <li>可尝试从浏览器菜单选择“安装应用”或“添加到主屏幕”</li>
      </ol>
    </div>
  );
}
```

```tsx
// frontend/src/components/dashboard/InstallAppEntry.tsx
type Props = {
  visible: boolean;
  platform: 'android-ready' | 'android-help' | 'ios';
  guideVisible: boolean;
  helpVisible: boolean;
  onInstall: () => Promise<unknown> | unknown;
  onOpenGuide: () => void;
  onCloseGuide: () => void;
  onOpenHelp: () => void;
  onCloseHelp: () => void;
};

const isIos = platform === 'ios';
const isAndroidHelp = platform === 'android-help';

const handlePrimaryClick = isIos
  ? onOpenGuide
  : isAndroidHelp
    ? onOpenHelp
    : () => void onInstall();
```

```tsx
// frontend/src/components/dashboard/InstallAppEntry.tsx
return (
  <>
    <div className="install-app-entry">
      <div className="install-app-entry-copy">
        <strong>{isIos ? '安装到桌面' : '安装 App'}</strong>
        <span>像 App 一样打开</span>
      </div>
      <div className="install-app-entry-actions">
        <Button size="small" type="default" onClick={handlePrimaryClick}>
          {isIos ? '安装到桌面' : '安装 App'}
        </Button>
      </div>
    </div>
    <InstallAppGuide visible={guideVisible} onClose={onCloseGuide} />
    <InstallAppHelp visible={helpVisible} onClose={onCloseHelp} />
  </>
);
```

- [ ] **Step 4: 重新运行测试，确认绿灯**

Run:

```bash
cd /workspace/frontend
npm test -- --run src/components/dashboard/InstallAppHelp.test.tsx src/components/dashboard/InstallAppEntry.test.tsx
```

Expected:

- 安卓可安装分支仍可通过
- 安卓帮助分支通过
- iPhone 引导分支继续通过

- [ ] **Step 5: 提交**

```bash
cd /workspace
git add frontend/src/components/dashboard/InstallAppHelp.tsx frontend/src/components/dashboard/InstallAppHelp.test.tsx frontend/src/components/dashboard/InstallAppEntry.tsx frontend/src/components/dashboard/InstallAppEntry.test.tsx
git commit -m "feat(pwa): show android install help feedback"
```

---

### Task 3: 首页接线并移除“稍后隐藏”路径

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/pages/DashboardInstallEntry.test.tsx`

- [ ] **Step 1: 写失败测试，锁定首页仍在顶部挂载入口**

```tsx
// frontend/src/pages/DashboardInstallEntry.test.tsx
vi.mock('../components/dashboard/InstallAppEntry', () => ({
  InstallAppEntry: () => <div>install-entry-fixed</div>,
}));

it('renders fixed install entry between workflow and admin alerts', async () => {
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

  expect(container.innerHTML).toContain('workflow');
  expect(container.innerHTML).toContain('install-entry-fixed');
  expect(container.innerHTML).toContain('admin alerts');

  await act(async () => root.unmount());
});
```

- [ ] **Step 2: 运行测试，确认红灯或类型不通过**

Run:

```bash
cd /workspace/frontend
npm test -- --run src/pages/DashboardInstallEntry.test.tsx
```

Expected:

- `DashboardPage.tsx` 仍在向 `InstallAppEntry` 传 `onDismiss`
- 新 props 还没有接齐

- [ ] **Step 3: 更新首页接线，删掉隐藏入口的旧动作**

```tsx
// frontend/src/pages/DashboardPage.tsx
<InstallAppEntry
  visible={installPrompt.visible}
  platform={installPrompt.platform}
  guideVisible={installPrompt.guideVisible}
  helpVisible={installPrompt.helpVisible}
  onInstall={installPrompt.triggerInstall}
  onOpenGuide={installPrompt.openGuide}
  onCloseGuide={installPrompt.closeGuide}
  onOpenHelp={installPrompt.openHelp}
  onCloseHelp={installPrompt.closeHelp}
/>
```

```tsx
// frontend/src/pages/DashboardPage.tsx
// 删除旧的 onDismiss 传参，保留入口固定显示
```

- [ ] **Step 4: 重新运行页面测试，确认绿灯**

Run:

```bash
cd /workspace/frontend
npm test -- --run src/pages/DashboardInstallEntry.test.tsx
```

Expected:

- 页面测试通过
- 顶部顺序仍是 `workflow -> install entry -> admin alerts`

- [ ] **Step 5: 提交**

```bash
cd /workspace
git add frontend/src/pages/DashboardPage.tsx frontend/src/pages/DashboardInstallEntry.test.tsx
git commit -m "feat(pwa): wire fixed install entry on dashboard"
```

---

### Task 4: 全量回归、诊断与最终提交

**Files:**
- Modify: `frontend/src/hooks/index.ts`（仅当导出需要同步时）
- Verify: `frontend/src/components/dashboard/InstallAppGuide.tsx`
- Verify: `frontend/src/styles/global.css`

- [ ] **Step 1: 运行完整相关测试集**

Run:

```bash
cd /workspace/frontend
npm test -- --run \
  src/pwa/installPrompt.test.ts \
  src/hooks/useInstallPromptState.test.ts \
  src/components/dashboard/InstallAppGuide.test.tsx \
  src/components/dashboard/InstallAppHelp.test.tsx \
  src/components/dashboard/InstallAppEntry.test.tsx \
  src/pages/DashboardInstallEntry.test.tsx \
  src/components/dashboard/AdminAlertsBar.test.tsx \
  src/components/dashboard/DashboardHeader.test.tsx
```

Expected:

- 所有相关测试通过
- 不再出现 `onDismiss`、`INSTALL_PROMPT_DISMISS_KEY` 之类的旧逻辑报错

- [ ] **Step 2: 跑生产构建确认 PWA 壳未被破坏**

Run:

```bash
cd /workspace/frontend
npm run build
```

Expected:

- 构建成功
- `dist/sw.js`、`dist/manifest.webmanifest` 继续生成

- [ ] **Step 3: 检查诊断并修正容易处理的问题**

Run:

```bash
# 在 IDE/Agent 中对以下文件执行诊断检查
frontend/src/pwa/installPrompt.ts
frontend/src/hooks/useInstallPromptState.ts
frontend/src/components/dashboard/InstallAppEntry.tsx
frontend/src/components/dashboard/InstallAppHelp.tsx
frontend/src/pages/DashboardPage.tsx
```

Expected:

- 无 TypeScript / lint 新错误

- [ ] **Step 4: 最终提交**

```bash
cd /workspace
git add frontend/src/pwa/installPrompt.ts frontend/src/pwa/installPrompt.test.ts frontend/src/hooks/useInstallPromptState.ts frontend/src/hooks/useInstallPromptState.test.ts frontend/src/components/dashboard/InstallAppEntry.tsx frontend/src/components/dashboard/InstallAppEntry.test.tsx frontend/src/components/dashboard/InstallAppHelp.tsx frontend/src/components/dashboard/InstallAppHelp.test.tsx frontend/src/pages/DashboardPage.tsx frontend/src/pages/DashboardInstallEntry.test.tsx
git commit -m "feat(pwa): keep install action visible with android feedback"
```

- [ ] **Step 5: 推送并部署验证**

Run:

```bash
cd /workspace
git push origin main
```

Expected:

- 远端接收最新提交
- Render 前端服务自动部署
- 线上首页未安装状态下固定显示安装入口

---

## Self-Review

- **Spec coverage:** 已覆盖固定显示、已安装隐藏、安卓 `unavailable` 中文反馈、iPhone 引导延续、移除 7 天隐藏、顶部挂载不变、测试与构建回归。
- **Placeholder scan:** 计划中未保留 `TODO`、`TBD`、`类似 Task N` 之类占位内容；每个任务都给了明确文件、代码片段和命令。
- **Type consistency:** 统一使用 `platform: 'android-ready' | 'android-help' | 'ios'`、`helpVisible`、`openHelp/closeHelp` 命名，避免任务间名称漂移。
