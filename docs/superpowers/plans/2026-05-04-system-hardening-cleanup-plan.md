# 系统硬化与历史残留清理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一前后端状态源、移除旧流程残留、收敛发布产物路径，消除“旧逻辑影响新逻辑”的结构性风险，同时保持现有测试与构建全绿。

**Architecture:** 前端把“模式已选择”收敛成一套可复用判断逻辑，并同步登录、选模、后台切模三个入口；鉴权过期跳转只面向当前真实路由；后端所有 `SystemState` 读取强制走单例键，状态字面量统一到一套词表；发布链路只保留一套前端产物来源，并清理历史静态文件堆积。

**Tech Stack:** React 18 + TypeScript + Vitest + FastAPI + SQLAlchemy + Pytest + Vite。

---

## Files

**Frontend**
- Modify: [App.tsx](file:///workspace/frontend/src/App.tsx)
- Modify: [AdminPage.tsx](file:///workspace/frontend/src/pages/AdminPage.tsx)
- Modify: [ModeSelectPage.tsx](file:///workspace/frontend/src/pages/ModeSelectPage.tsx)
- Modify: [api.ts](file:///workspace/frontend/src/services/api.ts)
- Modify: [main.tsx](file:///workspace/frontend/src/main.tsx)
- Modify: [global.css](file:///workspace/frontend/src/styles/global.css)
- Create: `/workspace/frontend/src/utils/modeSelection.ts`
- Create: `/workspace/frontend/src/utils/modeSelection.test.ts`

**Backend**
- Modify: [state.py](file:///workspace/backend/app/services/game/state.py)
- Modify: [session.py](file:///workspace/backend/app/services/game/session.py)
- Modify: [state_machine.py](file:///workspace/backend/app/services/game/state_machine.py)
- Modify: [maintenance.py](file:///workspace/backend/app/api/routes/maintenance.py)
- Modify: [analysis.py](file:///workspace/backend/app/api/routes/analysis.py)
- Modify: [main.py](file:///workspace/backend/app/api/main.py)
- Modify: [system.py](file:///workspace/backend/app/api/routes/system.py)
- Modify: [schemas.py](file:///workspace/backend/app/models/schemas.py)
- Create: `/workspace/backend/tests/test_system_state_singleton_reads.py`
- Create: `/workspace/backend/tests/test_status_vocabulary_consistency.py`

**Build / Deploy**
- Modify: [vite.config.ts](file:///workspace/frontend/vite.config.ts)
- Modify: [render.yaml](file:///workspace/render.yaml)（只在需要对齐说明时）
- Modify: [README.md](file:///workspace/README.md)
- Delete generated files in: `/workspace/backend/static/assets/*`

---

### Task 1: 统一前端“模式已选择”状态源

**Files:**
- Create: `/workspace/frontend/src/utils/modeSelection.ts`
- Create: `/workspace/frontend/src/utils/modeSelection.test.ts`
- Modify: [App.tsx](file:///workspace/frontend/src/App.tsx)
- Modify: [AdminPage.tsx](file:///workspace/frontend/src/pages/AdminPage.tsx)
- Modify: [ModeSelectPage.tsx](file:///workspace/frontend/src/pages/ModeSelectPage.tsx)

- [ ] **Step 1: 先写失败测试，锁定模式标记的唯一行为**

Create `/workspace/frontend/src/utils/modeSelection.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  MODE_SELECTED_KEY,
  markModeSelected,
  clearModeSelected,
  isModeSelected,
} from './modeSelection';

describe('modeSelection', () => {
  it('stores and reads mode_selected consistently', () => {
    localStorage.removeItem(MODE_SELECTED_KEY);
    expect(isModeSelected()).toBe(false);

    markModeSelected();
    expect(localStorage.getItem(MODE_SELECTED_KEY)).toBe('1');
    expect(isModeSelected()).toBe(true);

    clearModeSelected();
    expect(isModeSelected()).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试并确认先失败**

Run:

```bash
npm test -- src/utils/modeSelection.test.ts
```

Expected: FAIL with module-not-found for `./modeSelection`.

- [ ] **Step 3: 写最小实现，集中管理 `mode_selected`**

Create `/workspace/frontend/src/utils/modeSelection.ts`:

```ts
export const MODE_SELECTED_KEY = 'mode_selected';

export const isModeSelected = (): boolean =>
  localStorage.getItem(MODE_SELECTED_KEY) === '1';

export const markModeSelected = (): void => {
  localStorage.setItem(MODE_SELECTED_KEY, '1');
};

export const clearModeSelected = (): void => {
  localStorage.removeItem(MODE_SELECTED_KEY);
};
```

- [ ] **Step 4: 让三个入口都使用同一套 helper**

在 [App.tsx](file:///workspace/frontend/src/App.tsx) 中把：

```tsx
const selected = localStorage.getItem('mode_selected') === '1';
```

替换为：

```tsx
import { isModeSelected } from './utils/modeSelection';

const selected = isModeSelected();
```

在 [ModeSelectPage.tsx](file:///workspace/frontend/src/pages/ModeSelectPage.tsx) 中把：

```tsx
localStorage.setItem('mode_selected', '1');
```

替换为：

```tsx
import { markModeSelected } from '../utils/modeSelection';

markModeSelected();
```

在 [AdminPage.tsx](file:///workspace/frontend/src/pages/AdminPage.tsx) 的 `applyModeChange()` 成功分支补上：

```tsx
import { markModeSelected } from '../utils/modeSelection';

await api.updatePredictionMode(newMode);
markModeSelected();
setPredictionMode(newMode);
```

- [ ] **Step 5: 重新运行测试确认通过**

Run:

```bash
npm test -- src/utils/modeSelection.test.ts
```

Expected: PASS

- [ ] **Step 6: 提交这一小步**

```bash
git add frontend/src/utils/modeSelection.ts frontend/src/utils/modeSelection.test.ts frontend/src/App.tsx frontend/src/pages/AdminPage.tsx frontend/src/pages/ModeSelectPage.tsx
git commit -m "fix(frontend): unify mode selection state"
```

---

### Task 2: 清理前端旧跳转、重复样式和无效 CSS

**Files:**
- Modify: [api.ts](file:///workspace/frontend/src/services/api.ts)
- Modify: [main.tsx](file:///workspace/frontend/src/main.tsx)
- Modify: [App.tsx](file:///workspace/frontend/src/App.tsx)
- Modify: [global.css](file:///workspace/frontend/src/styles/global.css)
- Modify: [api.interceptor.test.ts](file:///workspace/frontend/src/services/api.interceptor.test.ts)

- [ ] **Step 1: 先扩展失败测试，锁定 401 过期后跳转到当前真实路由**

在 `/workspace/frontend/src/services/api.interceptor.test.ts` 增加：

```ts
it('redirects expired session to /mode instead of legacy start routes', async () => {
  const assign = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { pathname: '/dashboard', assign },
    writable: true,
  });

  localStorage.setItem('auth_token', 'token');

  const error = {
    response: { status: 401, data: { detail: 'expired' } },
    config: { url: '/api/system/state' },
  };

  const handler = responseRejectedHandlers.at(-1);
  await expect(handler?.(error)).rejects.toBeTruthy();
  expect(assign).toHaveBeenCalledWith('/mode?session_expired=1');
});
```

- [ ] **Step 2: 运行测试并确认先失败**

Run:

```bash
npm test -- src/services/api.interceptor.test.ts
```

Expected: FAIL because current code still redirects to `/?session_expired=true`.

- [ ] **Step 3: 修正 401 跳转，只保留当前路由体系**

在 [api.ts](file:///workspace/frontend/src/services/api.ts) 中把：

```ts
if (!currentPath.includes('/login') && !currentPath.includes('/start') && currentPath !== '/') {
  window.location.assign('/?session_expired=true');
}
```

替换为：

```ts
if (!currentPath.startsWith('/mode')) {
  window.location.assign('/mode?session_expired=1');
}
```

- [ ] **Step 4: 移除重复样式导入和无效 CSS**

在 [main.tsx](file:///workspace/frontend/src/main.tsx) 与 [App.tsx](file:///workspace/frontend/src/App.tsx) 中保留一次 `global.css` 导入，推荐只保留入口导入：

```ts
// main.tsx
import './styles/global.css';
```

并从 `App.tsx` 删除：

```ts
import './styles/global.css';
```

在 [global.css](file:///workspace/frontend/src/styles/global.css) 修复无效值：

```css
.nav-active-indicator {
  top: 10px;
  bottom: 10px;
}

.table-card-btn::after {
  top: 0;
  left: -100%;
}
```

同时删除重复定义的这一段，仅保留一处：

```css
.ant-empty-description { color: #484f58 !important; }
.ant-descriptions-item-label { font-weight: 500 !important; }
.ant-alert-message { font-weight: 600 !important; }
```

- [ ] **Step 5: 重新运行测试与 lint**

Run:

```bash
npm test -- src/services/api.interceptor.test.ts
npm run lint
```

Expected: PASS and no lint errors.

- [ ] **Step 6: 提交这一小步**

```bash
git add frontend/src/services/api.ts frontend/src/services/api.interceptor.test.ts frontend/src/main.tsx frontend/src/App.tsx frontend/src/styles/global.css
git commit -m "fix(frontend): remove legacy redirects and stale css"
```

---

### Task 3: 统一后端 `SystemState` 单例读取路径

**Files:**
- Create: `/workspace/backend/tests/test_system_state_singleton_reads.py`
- Modify: [state.py](file:///workspace/backend/app/services/game/state.py)
- Modify: [analysis.py](file:///workspace/backend/app/api/routes/analysis.py)
- Modify: [main.py](file:///workspace/backend/app/api/main.py)
- Modify: [system.py](file:///workspace/backend/app/api/routes/system.py)

- [ ] **Step 1: 先写失败测试，锁定读取必须命中 `singleton_key=1`**

Create `/workspace/backend/tests/test_system_state_singleton_reads.py`:

```python
import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class SystemStateSingletonReadsTest(unittest.TestCase):
    def test_sync_balance_reads_singleton_row(self):
        async def _run():
            from app.core.database import async_session, init_db
            from app.models.schemas import SystemState
            from app.services.game.state import sync_balance_from_db
            from sqlalchemy import delete

            await init_db()

            async with async_session() as session:
                await session.execute(delete(SystemState))
                session.add(SystemState(id=99, singleton_key=2, balance=999, boot_number=9, game_number=9, prediction_mode="ai"))
                session.add(SystemState(id=1, singleton_key=1, balance=123, boot_number=2, game_number=3, prediction_mode="rule"))
                await session.commit()

            async with async_session() as session:
                await sync_balance_from_db(session)

            from app.services.game.session import get_session
            sess = get_session()
            return sess.balance, sess.boot_number, sess.prediction_mode

        balance, boot_number, prediction_mode = asyncio.run(_run())
        self.assertEqual(balance, 123.0)
        self.assertEqual(boot_number, 2)
        self.assertEqual(prediction_mode, "rule")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 运行测试并确认先失败**

Run:

```bash
pytest backend/tests/test_system_state_singleton_reads.py -q
```

Expected: FAIL because current `sync_balance_from_db()` uses `select(SystemState)` without singleton filter.

- [ ] **Step 3: 统一所有旧读法到 `singleton_key == 1`**

在 [state.py](file:///workspace/backend/app/services/game/state.py) 中把：

```python
stmt = select(SystemState)
```

替换为：

```python
stmt = select(SystemState).where(SystemState.singleton_key == 1)
```

在 [analysis.py](file:///workspace/backend/app/api/routes/analysis.py) 中把：

```python
state_stmt = select(SystemState)
```

替换为：

```python
state_stmt = select(SystemState).where(SystemState.singleton_key == 1)
```

在 [main.py](file:///workspace/backend/app/api/main.py) 中把：

```python
stmt_state = select(SystemState).order_by(SystemState.id.desc()).limit(1)
```

替换为：

```python
stmt_state = select(SystemState).where(SystemState.singleton_key == 1).limit(1)
```

如果 [system.py](file:///workspace/backend/app/api/routes/system.py) 内仍存在裸读，也同样替换成单例过滤。

- [ ] **Step 4: 回归相关测试**

Run:

```bash
pytest backend/tests/test_system_state_singleton_reads.py backend/tests/test_system_state_public.py backend/tests/test_startup_recovery.py -q
```

Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add backend/app/services/game/state.py backend/app/api/routes/analysis.py backend/app/api/main.py backend/app/api/routes/system.py backend/tests/test_system_state_singleton_reads.py
git commit -m "fix(backend): enforce singleton system state reads"
```

---

### Task 4: 统一后端状态词表并对齐前后端发布链路

**Files:**
- Create: `/workspace/backend/tests/test_status_vocabulary_consistency.py`
- Modify: [session.py](file:///workspace/backend/app/services/game/session.py)
- Modify: [schemas.py](file:///workspace/backend/app/models/schemas.py)
- Modify: [state_machine.py](file:///workspace/backend/app/services/game/state_machine.py)
- Modify: [maintenance.py](file:///workspace/backend/app/api/routes/maintenance.py)
- Modify: [vite.config.ts](file:///workspace/frontend/vite.config.ts)
- Modify: [README.md](file:///workspace/README.md)
- Delete generated files in: `/workspace/backend/static/assets/*`

- [ ] **Step 1: 先写失败测试，锁定允许状态词表**

Create `/workspace/backend/tests/test_status_vocabulary_consistency.py`:

```python
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class StatusVocabularyConsistencyTest(unittest.TestCase):
    def test_runtime_and_db_default_status_use_same_idle_wording(self):
        from app.services.game.session import ManualSession
        from app.models.schemas import SystemState

        runtime_default = ManualSession().status
        db_default = SystemState.status.default.arg

        self.assertEqual(runtime_default, "空闲")
        self.assertEqual(db_default, "空闲")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 运行测试并确认先失败**

Run:

```bash
pytest backend/tests/test_status_vocabulary_consistency.py -q
```

Expected: FAIL because current DB default is `已停止`.

- [ ] **Step 3: 统一状态字面量**

在 [schemas.py](file:///workspace/backend/app/models/schemas.py) 把：

```python
status = Column(String(20), default="已停止")
```

替换为：

```python
status = Column(String(20), default="空闲", server_default="空闲")
```

在 [state.py](file:///workspace/backend/app/services/game/state.py) 创建单例时把：

```python
status="手动模式",
```

替换为：

```python
status="空闲",
```

在 [maintenance.py](file:///workspace/backend/app/api/routes/maintenance.py) 重置时把：

```python
state.status = "手动模式"
```

替换为：

```python
state.status = "空闲"
```

在 [state_machine.py](file:///workspace/backend/app/services/game/state_machine.py) 把：

```python
return status in ("等待下注", "分析完成")
```

替换为：

```python
return status == "分析完成"
```

- [ ] **Step 4: 收敛前端产物目录与文档说明**

在 [vite.config.ts](file:///workspace/frontend/vite.config.ts) 中把：

```ts
outDir: process.env.BUILD_BACKEND_STATIC === '1' ? '../backend/static' : 'dist',
```

替换为：

```ts
outDir: 'dist',
```

在 [README.md](file:///workspace/README.md) 明确说明：

```md
- Render 静态站使用 `frontend/dist`
- 后端 `backend/static` 仅作为容器内托管产物目录，不再作为前端本地构建输出目录
```

并删除 `/workspace/backend/static/assets/*` 历史生成文件，保留由部署流程重新生成。

- [ ] **Step 5: 运行回归验证**

Run:

```bash
pytest backend/tests/test_status_vocabulary_consistency.py backend/tests/test_state_machine_rules.py backend/tests/test_admin_maintenance_api.py -q
npm run build
```

Expected: PASS

- [ ] **Step 6: 提交这一小步**

```bash
git add backend/app/models/schemas.py backend/app/services/game/state.py backend/app/services/game/state_machine.py backend/app/api/routes/maintenance.py frontend/vite.config.ts README.md backend/tests/test_status_vocabulary_consistency.py
git add -u backend/static/assets
git commit -m "refactor: unify system state vocabulary and build output"
```

---

## Final Verification

- [ ] Run:

```bash
cd /workspace/frontend && npm test
cd /workspace/frontend && npm run lint
cd /workspace/frontend && npm run build
cd /workspace/backend && pytest
```

Expected:
- Frontend tests PASS
- Frontend lint PASS
- Frontend build PASS
- Backend pytest PASS

- [ ] Smoke-check these paths manually or by browser automation:
  - `/mode`
  - `/dashboard`
  - `/admin`
  - 管理员页切模式后直接访问 `/dashboard` 不再被错误重定向
  - 401 过期后跳到 `/mode?session_expired=1`

- [ ] Final commit:

```bash
git add .
git commit -m "fix: harden system state and remove legacy conflicts"
```
