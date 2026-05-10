# Install Entry For Mobile PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为首页补一个轻量的“安装 App”入口，让 Android 可直接触发安装，让 iPhone 显示“添加到主屏幕”引导，并在已安装或用户主动关闭后自动隐藏。

**Architecture:** 把安装能力判断、关闭冷却和平台分流封装到独立 hook 中，由一个独立的首页入口组件消费。首页只负责挂载，不承载复杂判断逻辑，从而保持现有 `DashboardPage` 结构稳定并便于测试。

**Tech Stack:** React 18, TypeScript, Vitest, jsdom, Ant Design, localStorage, matchMedia

---

## 文件结构

### 需要新增

- `frontend/src/pwa/installPrompt.ts`
  - 提供关闭冷却 key、平台判断、standalone 判断、显示条件计算。
- `frontend/src/pwa/installPrompt.test.ts`
  - 校验 Android / iPhone / standalone / 关闭冷却等核心逻辑。
- `frontend/src/hooks/useInstallPromptState.ts`
  - 监听 `beforeinstallprompt`、管理安装入口显示状态和 iPhone 引导状态。
- `frontend/src/hooks/useInstallPromptState.test.ts`
  - 校验 hook 对安装事件、关闭行为和 standalone 条件的响应。
- `frontend/src/components/dashboard/InstallAppEntry.tsx`
  - 渲染首页轻量安装入口。
- `frontend/src/components/dashboard/InstallAppEntry.test.tsx`
  - 校验不同平台文案、Android 点击触发安装、iPhone 点击打开说明层。
- `frontend/src/components/dashboard/InstallAppGuide.tsx`
  - 渲染 iPhone 轻量说明层。
- `frontend/src/components/dashboard/InstallAppGuide.test.tsx`
  - 校验 3 步说明文案和关闭行为。
- `frontend/src/pages/DashboardInstallEntry.test.tsx`
  - 校验 `DashboardPage` 已接入安装入口且位置合理。

### 需要修改

- `frontend/src/pages/DashboardPage.tsx`
  - 在顶部状态区附近挂载 `InstallAppEntry`。
- `frontend/src/styles/global.css`
  - 为安装入口和 iPhone 引导层补充轻量样式。

---

### Task 1: 提炼安装能力判断与关闭冷却逻辑

**Files:**
- Create: `frontend/src/pwa/installPrompt.ts`
- Test: `frontend/src/pwa/installPrompt.test.ts`

- [ ] **Step 1: 写失败测试，先锁定平台判断与关闭冷却**

```ts
import { describe, expect, it } from 'vitest';

import {
  INSTALL_PROMPT_DISMISS_KEY,
  DISMISS_TTL_MS,
  detectInstallPlatform,
  isStandaloneDisplayMode,
  isDismissedRecently,
} from './installPrompt';

describe('install prompt helpers', () => {
  it('detects iphone safari as manual install platform', () => {
    expect(
      detectInstallPlatform({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        hasBeforeInstallPrompt: false,
      }),
    ).toBe('ios');
  });

  it('detects install-capable android browsers when beforeinstallprompt exists', () => {
    expect(
      detectInstallPlatform({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
        hasBeforeInstallPrompt: true,
      }),
    ).toBe('android');
  });

  it('treats standalone display modes as already installed', () => {
    expect(isStandaloneDisplayMode({ displayModeStandalone: true, navigatorStandalone: false })).toBe(true);
    expect(isStandaloneDisplayMode({ displayModeStandalone: false, navigatorStandalone: true })).toBe(true);
  });

  it('uses the dismiss ttl to suppress the entry temporarily', () => {
    const now = 1_700_000_000_000;
    expect(DISMISS_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(INSTALL_PROMPT_DISMISS_KEY).toBe('pwa-install-entry-dismissed-at');
    expect(isDismissedRecently(now - 60_000, now)).toBe(true);
    expect(isDismissedRecently(now - DISMISS_TTL_MS - 1, now)).toBe(false);
    expect(isDismissedRecently(null, now)).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `npm test -- --run src/pwa/installPrompt.test.ts`

Expected: FAIL，因为 `src/pwa/installPrompt.ts` 尚不存在。

- [ ] **Step 3: 写最小实现**

Create `frontend/src/pwa/installPrompt.ts`:

```ts
export const INSTALL_PROMPT_DISMISS_KEY = 'pwa-install-entry-dismissed-at';
export const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type DetectInstallPlatformArgs = {
  userAgent: string;
  hasBeforeInstallPrompt: boolean;
};

type StandaloneArgs = {
  displayModeStandalone: boolean;
  navigatorStandalone: boolean;
};

export function detectInstallPlatform({
  userAgent,
  hasBeforeInstallPrompt,
}: DetectInstallPlatformArgs): 'android' | 'ios' | 'none' {
  const ua = userAgent.toLowerCase();
  const isIphone = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|chrome/.test(ua);
  const isAndroid = /android/.test(ua);

  if (isIphone && isSafari) return 'ios';
  if (isAndroid && hasBeforeInstallPrompt) return 'android';
  return 'none';
}

export function isStandaloneDisplayMode({
  displayModeStandalone,
  navigatorStandalone,
}: StandaloneArgs): boolean {
  return displayModeStandalone || navigatorStandalone;
}

export function isDismissedRecently(lastDismissedAt: number | null, now = Date.now()): boolean {
  if (!lastDismissedAt) return false;
  return now - lastDismissedAt < DISMISS_TTL_MS;
}
```

- [ ] **Step 4: 再跑测试，确认通过**

Run: `npm test -- --run src/pwa/installPrompt.test.ts`

Expected: PASS，平台判断、standalone 判断和关闭冷却规则全部通过。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/pwa/installPrompt.ts frontend/src/pwa/installPrompt.test.ts
git commit -m "feat(pwa): add install prompt helpers"
```

### Task 2: 实现安装状态 hook

**Files:**
- Create: `frontend/src/hooks/useInstallPromptState.ts`
- Test: `frontend/src/hooks/useInstallPromptState.test.ts`

- [ ] **Step 1: 写失败测试，先约束 hook 的状态输出**

```ts
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useInstallPromptState } from './useInstallPromptState';

describe('useInstallPromptState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function renderHookWithValue(options?: Parameters<typeof useInstallPromptState>[0]) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let latest: ReturnType<typeof useInstallPromptState> | null = null;

    const Probe = () => {
      latest = useInstallPromptState(options);
      return null;
    };

    act(() => {
      root.render(<Probe />);
    });

    return {
      getLatest: () => latest,
      cleanup: () =>
        act(() => {
          root.unmount();
          container.remove();
        }),
    };
  }

  it('shows android install entry only after beforeinstallprompt is captured', () => {
    const hook = renderHookWithValue({
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
      displayModeStandalone: false,
      navigatorStandalone: false,
      storage: localStorage,
    });

    expect(hook.getLatest()?.platform).toBe('none');
    expect(hook.getLatest()?.visible).toBe(false);

    const event = new Event('beforeinstallprompt');
    Object.assign(event, {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(hook.getLatest()?.platform).toBe('android');
    expect(hook.getLatest()?.visible).toBe(true);
    hook.cleanup();
  });

  it('shows ios entry without beforeinstallprompt and opens guide on demand', () => {
    const hook = renderHookWithValue({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      displayModeStandalone: false,
      navigatorStandalone: false,
      storage: localStorage,
    });

    expect(hook.getLatest()?.platform).toBe('ios');
    expect(hook.getLatest()?.visible).toBe(true);

    act(() => {
      hook.getLatest()?.openGuide();
    });

    expect(hook.getLatest()?.guideVisible).toBe(true);
    hook.cleanup();
  });
});
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `npm test -- --run src/hooks/useInstallPromptState.test.ts`

Expected: FAIL，因为 `useInstallPromptState.ts` 尚不存在。

- [ ] **Step 3: 写最小实现**

Create `frontend/src/hooks/useInstallPromptState.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  INSTALL_PROMPT_DISMISS_KEY,
  detectInstallPlatform,
  isDismissedRecently,
  isStandaloneDisplayMode,
} from '../pwa/installPrompt';

type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type Options = {
  userAgent?: string;
  displayModeStandalone?: boolean;
  navigatorStandalone?: boolean;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
};

export function useInstallPromptState(options: Options = {}) {
  const {
    userAgent = navigator.userAgent,
    displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches,
    navigatorStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    storage = window.localStorage,
  } = options;

  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEventLike | null>(null);
  const [guideVisible, setGuideVisible] = useState(false);
  const [dismissedAt, setDismissedAt] = useState<number | null>(() => {
    const raw = storage.getItem(INSTALL_PROMPT_DISMISS_KEY);
    return raw ? Number(raw) : null;
  });

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEventLike;
      promptEvent.preventDefault();
      setInstallEvent(promptEvent);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const platform = useMemo(
    () =>
      detectInstallPlatform({
        userAgent,
        hasBeforeInstallPrompt: Boolean(installEvent),
      }),
    [installEvent, userAgent],
  );

  const installed = isStandaloneDisplayMode({ displayModeStandalone, navigatorStandalone });
  const visible = !installed && platform !== 'none' && !isDismissedRecently(dismissedAt);

  const dismiss = useCallback(() => {
    const now = Date.now();
    storage.setItem(INSTALL_PROMPT_DISMISS_KEY, String(now));
    setDismissedAt(now);
    setGuideVisible(false);
  }, [storage]);

  const openGuide = useCallback(() => setGuideVisible(true), []);
  const closeGuide = useCallback(() => setGuideVisible(false), []);

  const triggerInstall = useCallback(async () => {
    if (!installEvent) return { outcome: 'unavailable' as const };
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') {
      dismiss();
    }
    return choice;
  }, [dismiss, installEvent]);

  return {
    platform,
    visible,
    guideVisible,
    openGuide,
    closeGuide,
    dismiss,
    triggerInstall,
  };
}
```

- [ ] **Step 4: 再跑测试，确认通过**

Run: `npm test -- --run src/hooks/useInstallPromptState.test.ts`

Expected: PASS，Android 安装事件捕获、iPhone 引导显示均通过。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/hooks/useInstallPromptState.ts frontend/src/hooks/useInstallPromptState.test.ts
git commit -m "feat(pwa): add install prompt state hook"
```

### Task 3: 实现 iPhone 引导层与首页安装入口组件

**Files:**
- Create: `frontend/src/components/dashboard/InstallAppGuide.tsx`
- Create: `frontend/src/components/dashboard/InstallAppGuide.test.tsx`
- Create: `frontend/src/components/dashboard/InstallAppEntry.tsx`
- Create: `frontend/src/components/dashboard/InstallAppEntry.test.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: 写失败测试，锁定组件行为**

Create `frontend/src/components/dashboard/InstallAppGuide.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InstallAppGuide } from './InstallAppGuide';

describe('InstallAppGuide', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the three-step iphone install instructions', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<InstallAppGuide visible onClose={vi.fn()} />);
    });

    const html = container.innerHTML;
    expect(html).toContain('安装到桌面');
    expect(html).toContain('点击 Safari 的分享按钮');
    expect(html).toContain('选择“添加到主屏幕”');
    expect(html).toContain('从桌面像 App 一样打开');

    await act(async () => root.unmount());
  });
});
```

Create `frontend/src/components/dashboard/InstallAppEntry.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InstallAppEntry } from './InstallAppEntry';

describe('InstallAppEntry', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows android install action and triggers prompt callback', async () => {
    const onInstall = vi.fn().mockResolvedValue(undefined);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <InstallAppEntry
          visible
          platform="android"
          guideVisible={false}
          onInstall={onInstall}
          onOpenGuide={vi.fn()}
          onCloseGuide={vi.fn()}
          onDismiss={vi.fn()}
        />,
      );
    });

    const button = Array.from(container.querySelectorAll('button')).find((node) =>
      (node.textContent || '').includes('安装 App'),
    );
    expect(button).toBeTruthy();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onInstall).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });

  it('shows ios wording and opens the guide instead of triggering install', async () => {
    const onOpenGuide = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <InstallAppEntry
          visible
          platform="ios"
          guideVisible={false}
          onInstall={vi.fn()}
          onOpenGuide={onOpenGuide}
          onCloseGuide={vi.fn()}
          onDismiss={vi.fn()}
        />,
      );
    });

    const html = container.innerHTML;
    expect(html).toContain('安装到桌面');
    expect(html).toContain('像 App 一样打开');

    const button = Array.from(container.querySelectorAll('button')).find((node) =>
      (node.textContent || '').includes('安装到桌面'),
    );

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onOpenGuide).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });
});
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `npm test -- --run src/components/dashboard/InstallAppGuide.test.tsx src/components/dashboard/InstallAppEntry.test.tsx`

Expected: FAIL，因为两个组件文件都还不存在。

- [ ] **Step 3: 写最小实现和样式**

Create `frontend/src/components/dashboard/InstallAppGuide.tsx`:

```tsx
import React from 'react';
import { Button } from 'antd';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function InstallAppGuide({ visible, onClose }: Props) {
  if (!visible) return null;

  return (
    <div className="install-app-guide" role="dialog" aria-modal="false">
      <div className="install-app-guide-head">
        <strong>安装到桌面</strong>
        <Button size="small" type="text" onClick={onClose}>
          关闭
        </Button>
      </div>
      <ol className="install-app-guide-steps">
        <li>点击 Safari 的分享按钮</li>
        <li>选择“添加到主屏幕”</li>
        <li>从桌面像 App 一样打开</li>
      </ol>
    </div>
  );
}
```

Create `frontend/src/components/dashboard/InstallAppEntry.tsx`:

```tsx
import React from 'react';
import { Button } from 'antd';

import { InstallAppGuide } from './InstallAppGuide';

type Props = {
  visible: boolean;
  platform: 'android' | 'ios' | 'none';
  guideVisible: boolean;
  onInstall: () => Promise<unknown> | unknown;
  onOpenGuide: () => void;
  onCloseGuide: () => void;
  onDismiss: () => void;
};

export function InstallAppEntry({
  visible,
  platform,
  guideVisible,
  onInstall,
  onOpenGuide,
  onCloseGuide,
  onDismiss,
}: Props) {
  if (!visible || platform === 'none') return null;

  const isIos = platform === 'ios';

  return (
    <>
      <div className="install-app-entry">
        <div className="install-app-entry-copy">
          <strong>{isIos ? '安装到桌面' : '安装 App'}</strong>
          <span>像 App 一样打开</span>
        </div>
        <div className="install-app-entry-actions">
          <Button size="small" type="default" onClick={isIos ? onOpenGuide : () => void onInstall()}>
            {isIos ? '安装到桌面' : '安装 App'}
          </Button>
          <Button size="small" type="text" onClick={onDismiss}>
            稍后
          </Button>
        </div>
      </div>
      <InstallAppGuide visible={guideVisible} onClose={onCloseGuide} />
    </>
  );
}
```

Update `frontend/src/styles/global.css` by appending:

```css
.install-app-entry {
  margin: 12px 16px 0;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 215, 0, 0.14);
  background: rgba(255, 215, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.install-app-entry-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.install-app-entry-copy strong {
  color: rgba(255, 255, 255, 0.92);
  font-size: 13px;
  font-weight: 700;
}

.install-app-entry-copy span {
  color: rgba(255, 255, 255, 0.56);
  font-size: 11px;
}

.install-app-entry-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.install-app-guide {
  margin: 10px 16px 0;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(88, 166, 255, 0.16);
  background: rgba(88, 166, 255, 0.05);
}

.install-app-guide-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.install-app-guide-steps {
  margin: 0;
  padding-left: 18px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  line-height: 1.7;
}

@media (max-width: 576px) {
  .install-app-entry {
    margin: 10px 12px 0;
    flex-direction: column;
    align-items: stretch;
  }

  .install-app-entry-actions {
    width: 100%;
  }

  .install-app-entry-actions .ant-btn {
    flex: 1 1 0;
  }

  .install-app-guide {
    margin: 10px 12px 0;
  }
}
```

- [ ] **Step 4: 再跑测试，确认转绿**

Run: `npm test -- --run src/components/dashboard/InstallAppGuide.test.tsx src/components/dashboard/InstallAppEntry.test.tsx`

Expected: PASS，组件文案、Android 安装按钮和 iPhone 引导入口都通过。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/dashboard/InstallAppGuide.tsx frontend/src/components/dashboard/InstallAppGuide.test.tsx frontend/src/components/dashboard/InstallAppEntry.tsx frontend/src/components/dashboard/InstallAppEntry.test.tsx frontend/src/styles/global.css
git commit -m "feat(pwa): add install entry ui"
```

### Task 4: 把安装入口接入首页并补页面回归

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Test: `frontend/src/pages/DashboardInstallEntry.test.tsx`

- [ ] **Step 1: 写失败测试，先约束首页已挂载安装入口**

```tsx
// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardPage from './DashboardPage';

const hooksMock = vi.hoisted(() => ({
  useSmartDetection: vi.fn(() => ({
    integrityIssues: [],
    abnormalPatterns: [],
    bettingAdvice: [],
    alerts: [],
    removeAlert: vi.fn(),
    markSynced: vi.fn(),
  })),
  useSystemDiagnostics: vi.fn(() => ({
    diagnostics: [],
    dismissIssue: vi.fn(),
    retryConnection: vi.fn(),
    addIssue: vi.fn(),
  })),
  useSystemStateQuery: vi.fn(() => ({ data: { status: '等待开奖', next_game_number: 12, boot_number: 3, balance: 5000 } })),
  useStatsQuery: vi.fn(() => ({ data: { hit_count: 1, miss_count: 0, accuracy: 1 } })),
  useLogsQuery: vi.fn(() => ({ data: { logs: [] } })),
  useGamesQuery: vi.fn(() => ({ data: { games: [], total: 0 } })),
  useBetsQuery: vi.fn(() => ({ data: { bets: [], total: 0 } })),
  useRoadsQuery: vi.fn(() => ({ data: { roads: null } })),
  useAnalysisQuery: vi.fn(() => ({ data: null, isFetching: false })),
  useRevealResultMutation: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useRetrySingleAiAnalysisMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useAddLogOptimistically: vi.fn(() => vi.fn()),
  useAddBetOptimistically: vi.fn(() => vi.fn()),
  useAddGameOptimistically: vi.fn(() => vi.fn()),
  useUpdateAnalysisOptimistically: vi.fn(() => vi.fn()),
  useUpdateStateOptimistically: vi.fn(() => vi.fn()),
  useWebSocket: vi.fn(),
}));

vi.mock('../hooks', () => hooksMock);
vi.mock('../components/dashboard', async () => {
  const actual = await vi.importActual<typeof import('../components/dashboard')>('../components/dashboard');
  return {
    ...actual,
    DashboardHeader: () => <div>header</div>,
    WorkflowStatusBar: () => <div>workflow</div>,
    AnalysisPanel: () => <div>analysis</div>,
    RevealModal: () => null,
  };
});
vi.mock('../components/tables', () => ({
  GameTable: () => <div>games</div>,
  BetTable: () => <div>bets</div>,
  LogTable: () => <div>logs</div>,
}));
vi.mock('../components/roads', () => ({ FiveRoadChart: () => <div>roads</div> }));
vi.mock('../components/learning', () => ({ LearningStatusPanel: () => <div>learning</div> }));
vi.mock('../components/ui', () => ({ SmartAlerts: () => <div>alerts</div> }));
vi.mock('../components/dashboard/AdminAlertsBar', () => ({ AdminAlertsBar: () => <div>admin alerts</div> }));
vi.mock('../components/dashboard/InstallAppEntry', () => ({ InstallAppEntry: () => <div>install-entry</div> }));

describe('DashboardPage install entry', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renders the install entry near the top dashboard helpers', async () => {
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
    expect(container.innerHTML).toContain('install-entry');
    expect(container.innerHTML).toContain('admin alerts');

    await act(async () => root.unmount());
  });
});
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `npm test -- --run src/pages/DashboardInstallEntry.test.tsx`

Expected: FAIL，因为 `DashboardPage` 还没有挂载 `InstallAppEntry`。

- [ ] **Step 3: 写最小实现**

Update `frontend/src/pages/DashboardPage.tsx` by adding imports:

```tsx
import { InstallAppEntry } from '../components/dashboard/InstallAppEntry';
import { useInstallPromptState } from '../hooks/useInstallPromptState';
```

And inside `DashboardPage` after `const isMobile = !screens.md;`:

```tsx
  const installPrompt = useInstallPromptState();
```

And render it between `WorkflowStatusBar` and `AdminAlertsBar`:

```tsx
      <InstallAppEntry
        visible={installPrompt.visible}
        platform={installPrompt.platform}
        guideVisible={installPrompt.guideVisible}
        onInstall={installPrompt.triggerInstall}
        onOpenGuide={installPrompt.openGuide}
        onCloseGuide={installPrompt.closeGuide}
        onDismiss={installPrompt.dismiss}
      />
```

- [ ] **Step 4: 再跑页面测试与相关回归**

Run: `npm test -- --run src/pages/DashboardInstallEntry.test.tsx src/components/dashboard/AdminAlertsBar.test.tsx`

Expected: PASS，首页已挂载安装入口，顶部轻量提示条的既有行为不受影响。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/pages/DashboardInstallEntry.test.tsx
git commit -m "feat(pwa): surface install entry on dashboard"
```

### Task 5: 跑完整安装入口相关回归并确认无诊断问题

**Files:**
- Modify: `frontend/src/hooks/index.ts` 或相关导出文件（如果 `useInstallPromptState` 需要从 hooks 索引导出）

- [ ] **Step 1: 如果需要，先补导出**

If `frontend/src/hooks/index.ts` already re-exports hooks, update it:

```ts
export { useInstallPromptState } from './useInstallPromptState';
```

If not needed, skip this file change.

- [ ] **Step 2: 运行完整目标测试集合**

Run: `npm test -- --run src/pwa/installPrompt.test.ts src/hooks/useInstallPromptState.test.ts src/components/dashboard/InstallAppGuide.test.tsx src/components/dashboard/InstallAppEntry.test.tsx src/pages/DashboardInstallEntry.test.tsx`

Expected: PASS，安装入口的能力判断、hook 状态、组件行为和首页接入测试全部通过。

- [ ] **Step 3: 运行相关既有回归**

Run: `npm test -- --run src/components/dashboard/AdminAlertsBar.test.tsx src/components/dashboard/DashboardHeader.test.tsx`

Expected: PASS，现有顶部区域组件没有被安装入口改坏。

- [ ] **Step 4: 检查诊断与 lint**

Run: `npx eslint src/pwa/installPrompt.ts src/pwa/installPrompt.test.ts src/hooks/useInstallPromptState.ts src/hooks/useInstallPromptState.test.ts src/components/dashboard/InstallAppGuide.tsx src/components/dashboard/InstallAppGuide.test.tsx src/components/dashboard/InstallAppEntry.tsx src/components/dashboard/InstallAppEntry.test.tsx src/pages/DashboardPage.tsx src/pages/DashboardInstallEntry.test.tsx`

Expected: PASS，无新增 lint 错误。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/hooks/index.ts frontend/src/pwa/installPrompt.ts frontend/src/pwa/installPrompt.test.ts frontend/src/hooks/useInstallPromptState.ts frontend/src/hooks/useInstallPromptState.test.ts frontend/src/components/dashboard/InstallAppGuide.tsx frontend/src/components/dashboard/InstallAppGuide.test.tsx frontend/src/components/dashboard/InstallAppEntry.tsx frontend/src/components/dashboard/InstallAppEntry.test.tsx frontend/src/pages/DashboardPage.tsx frontend/src/pages/DashboardInstallEntry.test.tsx frontend/src/styles/global.css
git commit -m "test(pwa): verify install entry flow"
```

---

## 自检

- 规格覆盖：
  - 首页轻量入口：Task 3、Task 4
  - Android 直接安装：Task 2、Task 3
  - iPhone 添加到主屏幕引导：Task 2、Task 3
  - 已安装自动隐藏：Task 1、Task 2
  - 关闭冷却 7 天：Task 1、Task 2
- 占位符扫描：
  - 无 `TODO`、`TBD`、`implement later`
- 类型一致性：
  - `detectInstallPlatform()`、`isStandaloneDisplayMode()`、`useInstallPromptState()`、`InstallAppEntry`、`InstallAppGuide` 命名一致

## 执行交接

Plan complete and saved to `docs/superpowers/plans/2026-05-10-install-entry-for-mobile-pwa-implementation-plan.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
