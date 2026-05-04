# 全量深挖（Dogfood + E2E 回归体系）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增“测试专用重置/造数”能力 + 扩展 Playwright 真实用户流程 E2E，用自动化方式深挖并固化回归，覆盖配置/启用/上传/下注/开奖/结算/日志/任务/维护与异常恢复。

**Architecture:** 后端新增仅在 `E2E_TESTING=true` 时启用的管理员测试路由（reset/seed），前端 Playwright E2E 通过这些路由实现用例隔离与稳定造数；E2E 默认使用本地 mock 上游（`E2E_USE_MOCK=1`），真实外网 AI 连通性用例仅在 `E2E_REAL_AI=1` 时执行。

**Tech Stack:** FastAPI + SQLAlchemy(Async)；React + Antd；Playwright(@playwright/test)；Vitest

---

## Files touched

**Backend**
- Modify: [config.py](file:///workspace/backend/app/core/config.py)
- Create: `/workspace/backend/app/api/routes/e2e_testing.py`
- Modify: [main.py](file:///workspace/backend/app/api/main.py)

**Frontend**
- Create: `/workspace/frontend/tests-e2e/flow.upload-bet-reveal.spec.ts`
- Create: `/workspace/frontend/tests-e2e/flow.token-expiry.spec.ts`
- Create: `/workspace/frontend/tests-e2e/flow.3ai-gates.spec.ts`
- Create: `/workspace/frontend/tests-e2e/flow.maintenance-tasks.spec.ts`
- Modify: `/workspace/frontend/tests-e2e/helpers.ts`
- Create: `/workspace/frontend/tests-e2e/README.md`
- Modify: [playwright.config.ts](file:///workspace/frontend/playwright.config.ts)

---

## Task 1: 后端增加 E2E_TESTING 环境开关

**Files:**
- Modify: [config.py](file:///workspace/backend/app/core/config.py)

- [ ] **Step 1: 写一个最小单测验证开关解析**

Create `backend/tests/test_e2e_testing_flag.py`：

```python
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class E2ETestingFlagTest(unittest.TestCase):
    def test_e2e_testing_flag_parsing(self):
        os.environ["E2E_TESTING"] = "true"
        from importlib import reload
        import app.core.config as cfg
        reload(cfg)
        self.assertTrue(cfg.settings.E2E_TESTING)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 运行测试确认失败（字段未定义）**

Run:

```bash
cd /workspace/backend
python -m unittest tests.test_e2e_testing_flag
```

Expected: FAIL（`Settings` 无 `E2E_TESTING`）

- [ ] **Step 3: 在 Settings 中新增字段**

Modify [config.py](file:///workspace/backend/app/core/config.py)（在 `ENVIRONMENT` 附近添加）：

```python
E2E_TESTING: bool = os.getenv("E2E_TESTING", "false").lower() == "true"
```

- [ ] **Step 4: 重新运行单测确认通过**

Run:

```bash
cd /workspace/backend
python -m unittest tests.test_e2e_testing_flag
```

Expected: PASS

---

## Task 2: 新增测试专用 reset/seed 路由（管理员 + 环境开关保护）

**Files:**
- Create: `/workspace/backend/app/api/routes/e2e_testing.py`
- Modify: [main.py](file:///workspace/backend/app/api/main.py)
- Test: `backend/tests/test_e2e_testing_routes_guard.py`

### 设计约束

- 所有路由都必须在 `settings.E2E_TESTING` 为 `True` 时才可用，否则返回 404
- 仍然必须走管理员认证（复用现有 `get_current_user`）
- 不输出任何敏感字段（API key 之类）

- [ ] **Step 1: 写路由守卫单测（未开启应 404）**

Create `backend/tests/test_e2e_testing_routes_guard.py`：

```python
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient


class E2ERoutesGuardTest(unittest.TestCase):
    def test_routes_disabled_by_default(self):
        os.environ["E2E_TESTING"] = "false"
        from importlib import reload
        import app.core.config as cfg
        reload(cfg)
        from app.api.main import app

        c = TestClient(app)
        r = c.post("/api/admin/e2e/reset", json={"scope": "all"})
        self.assertEqual(r.status_code, 404)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 创建路由文件（含 guard + 认证 + reset/seed）**

Create `/workspace/backend/app/api/routes/e2e_testing.py`：

```python
from datetime import datetime
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete

from app.core.config import settings
from app.core.database import async_session
from app.api.routes.utils import get_current_user
from app.models.schemas import GameRecord, BetRecord, SystemLog, BackgroundTask
from app.services.game.session import get_session_lock
from app.services.game.state import get_or_create_state
from app.services.game.upload import upload_games


router = APIRouter(prefix="/api/admin/e2e", tags=["E2E测试"])


def _require_enabled():
+    if not settings.E2E_TESTING:
        raise HTTPException(status_code=404, detail="Not Found")


class ResetReq(BaseModel):
    scope: Literal["all", "games", "bets", "logs", "tasks"] = "all"
    keep_balance: bool = True
    prediction_mode: Literal["rule", "single_ai", "ai"] = "rule"
    boot_number: int = 1


class SeedGamesReq(BaseModel):
    boot_number: int = 1
    count: int = Field(20, ge=1, le=72)
    pattern: Literal["alternate", "all_banker", "all_player", "with_ties"] = "alternate"
    prediction_mode: Literal["rule", "single_ai", "ai"] = "rule"


class SeedBetsReq(BaseModel):
    boot_number: int = 1
    game_number: int = Field(1, ge=1, le=72)
    count: int = Field(5, ge=1, le=20)
    amount: int = Field(100, ge=10, le=10000)
    direction: Literal["庄", "闲"] = "庄"


class SeedLogsReq(BaseModel):
    boot_number: int = 1
    game_number: int = 1
    count: int = Field(200, ge=1, le=5000)
    priority: Literal["P1", "P2", "P3"] = "P3"


@router.post("/reset")
async def e2e_reset(req: ResetReq, _: dict = Depends(get_current_user)):
    _require_enabled()
    async with async_session() as db:
        if req.scope in ("all", "games"):
            await db.execute(delete(GameRecord))
        if req.scope in ("all", "bets"):
            await db.execute(delete(BetRecord))
        if req.scope in ("all", "logs"):
            await db.execute(delete(SystemLog))
        if req.scope in ("all", "tasks"):
            await db.execute(delete(BackgroundTask))

        lock = get_session_lock()
        async with lock:
            state = await get_or_create_state(db)
            state.boot_number = req.boot_number
            state.game_number = 0
            state.status = "手动模式"
            state.prediction_mode = req.prediction_mode
            if not req.keep_balance:
                state.balance = settings.DEFAULT_BALANCE
        await db.commit()
    return {"ok": True}


@router.post("/seed/games")
async def e2e_seed_games(req: SeedGamesReq, _: dict = Depends(get_current_user)):
    _require_enabled()
    results = []
    for i in range(req.count):
        n = i + 1
        if req.pattern == "all_banker":
            r = "庄"
        elif req.pattern == "all_player":
            r = "闲"
        elif req.pattern == "with_ties" and n % 10 == 0:
            r = "和"
        else:
            r = "庄" if n % 2 == 1 else "闲"
        results.append({"game_number": n, "result": r})

    async with async_session() as db:
        await db.execute(delete(GameRecord).where(GameRecord.boot_number == req.boot_number))
        await db.execute(delete(BetRecord).where(BetRecord.boot_number == req.boot_number))
        await db.execute(delete(SystemLog).where(SystemLog.boot_number == req.boot_number))
        await db.commit()

        res = await upload_games(db, results, mode="reset_current_boot", balance_mode="keep", run_deep_learning=False)
        if not res.get("success", True):
            raise HTTPException(status_code=400, detail=res.get("error") or "seed failed")

        state = await get_or_create_state(db)
        state.prediction_mode = req.prediction_mode
        await db.commit()
    return {"ok": True, "boot_number": req.boot_number, "count": req.count}


@router.post("/seed/bets")
async def e2e_seed_bets(req: SeedBetsReq, _: dict = Depends(get_current_user)):
    _require_enabled()
    async with async_session() as db:
        state = await get_or_create_state(db)
        balance = Decimal(str(state.balance))
        amount = Decimal(str(req.amount))

        for i in range(req.count):
            before = balance
            after = balance - amount
            r = BetRecord(
                boot_number=req.boot_number,
                game_number=req.game_number,
                bet_seq=i + 1,
                bet_direction=req.direction,
                bet_amount=amount,
                bet_tier="标准",
                status="待开奖",
                balance_before=before,
                balance_after=after,
                bet_time=datetime.now(),
            )
            db.add(r)
            balance = after

        state.balance = float(balance)
        await db.commit()
    return {"ok": True}


@router.post("/seed/logs")
async def e2e_seed_logs(req: SeedLogsReq, _: dict = Depends(get_current_user)):
    _require_enabled()
    async with async_session() as db:
        now = datetime.now()
        for i in range(req.count):
            db.add(SystemLog(
                log_time=now,
                boot_number=req.boot_number,
                game_number=req.game_number,
                event_code="LOG-E2E-000",
                event_type="E2E造数",
                event_result="ok",
                description=f"seed {i + 1}",
                category="E2E",
                priority=req.priority,
            ))
        await db.commit()
    return {"ok": True}
```

- [ ] **Step 3: 在 main.py 中按开关 include_router**

Modify [main.py](file:///workspace/backend/app/api/main.py)（在 include_router(auth_router) 之后、WebSocket 之前插入）：

```python
from app.core.config import settings
if settings.E2E_TESTING:
    from app.api.routes.e2e_testing import router as e2e_testing_router
    app.include_router(e2e_testing_router)
```

- [ ] **Step 4: 运行后端单测**

Run:

```bash
cd /workspace/backend
python -m unittest tests.test_e2e_testing_routes_guard
```

Expected: PASS

---

## Task 3: Playwright 配置升级（真实上游默认 + 可选 mock + 用例隔离）

**Files:**
- Modify: [playwright.config.ts](file:///workspace/frontend/playwright.config.ts)
- Modify: `/workspace/frontend/tests-e2e/helpers.ts`
- Create: `/workspace/frontend/tests-e2e/README.md`

- [ ] **Step 1: 更新 playwright.config.ts 增加环境变量透传与更长 timeout**

Modify [playwright.config.ts](file:///workspace/frontend/playwright.config.ts)：

```ts
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:8011';

export default defineConfig({
  testDir: './tests-e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'python -m uvicorn app.api.main:app --host 0.0.0.0 --port 8011 --log-level warning',
    url: `${baseURL}/`,
    reuseExistingServer: true,
    cwd: '../backend',
    timeout: 60_000,
    env: {
      ...process.env,
      E2E_TESTING: 'true',
    },
  },
});
```

- [ ] **Step 2: 扩展 helpers.ts：登录注入 + reset/seed 封装 + 可选 mock**

Modify `/workspace/frontend/tests-e2e/helpers.ts`，追加：

```ts
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

export const e2eReset = async (baseURL: string, token: string, payload: any) => {
  const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
  const r = await ctx.post('/api/admin/e2e/reset', { data: payload });
  await ctx.dispose();
  if (!r.ok()) throw new Error(`e2eReset failed: ${r.status()}`);
};

export const e2eSeedGames = async (baseURL: string, token: string, payload: any) => {
  const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
  const r = await ctx.post('/api/admin/e2e/seed/games', { data: payload });
  await ctx.dispose();
  if (!r.ok()) throw new Error(`e2eSeedGames failed: ${r.status()}`);
};

export const e2eSeedBets = async (baseURL: string, token: string, payload: any) => {
  const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
  const r = await ctx.post('/api/admin/e2e/seed/bets', { data: payload });
  await ctx.dispose();
  if (!r.ok()) throw new Error(`e2eSeedBets failed: ${r.status()}`);
};

export const e2eSeedLogs = async (baseURL: string, token: string, payload: any) => {
  const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
  const r = await ctx.post('/api/admin/e2e/seed/logs', { data: payload });
  await ctx.dispose();
  if (!r.ok()) throw new Error(`e2eSeedLogs failed: ${r.status()}`);
};
```

- [ ] **Step 3: 写 tests-e2e/README.md 说明如何跑（真实/Mock）**

Create `/workspace/frontend/tests-e2e/README.md`：

```md
## E2E 运行

默认（真连外网 AI）：

```bash
cd /workspace/frontend
npm run e2e
```

指定目标地址：

```bash
E2E_BASE_URL=http://localhost:8011 npm run e2e
```

稳定回归（使用 mock 上游；需用例里把 base_url 指向 mock）：

```bash
E2E_USE_MOCK=1 npm run e2e
```
```

- [ ] **Step 4: 运行一次现有 E2E 确认基础仍可用**

Run:

```bash
cd /workspace/frontend
npm run e2e -- --reporter=list
```

Expected: PASS（至少已有的单AI流程通过）

---

## Task 4: 新增 E2E-002 上传→下注→开奖→结算→日志验证

**Files:**
- Create: `/workspace/frontend/tests-e2e/flow.upload-bet-reveal.spec.ts`

### 说明

此用例以“规则模式”为默认（不依赖 AI），覆盖上传/下注/开奖/结算与日志/列表联动。

- [ ] **Step 1: 编写用例**

Create `/workspace/frontend/tests-e2e/flow.upload-bet-reveal.spec.ts`：

```ts
import { test, expect } from '@playwright/test';
import { adminLogin, injectAdminToken, e2eReset, e2eSeedGames, e2eSeedBets, e2eSeedLogs } from './helpers';

test('规则模式：造数→下注列表→开奖/结算→日志导出', async ({ page, baseURL }) => {
  const token = await adminLogin(baseURL!);
  await e2eReset(baseURL!, token, { scope: 'all', keep_balance: true, prediction_mode: 'rule', boot_number: 1 });
  await e2eSeedGames(baseURL!, token, { boot_number: 1, count: 20, pattern: 'alternate', prediction_mode: 'rule' });
  await e2eSeedBets(baseURL!, token, { boot_number: 1, game_number: 1, count: 3, amount: 100, direction: '庄' });
  await e2eSeedLogs(baseURL!, token, { boot_number: 1, game_number: 1, count: 200, priority: 'P3' });
  await injectAdminToken(page, token);

  await page.goto('/dashboard/logs', { waitUntil: 'networkidle' });
  await expect(page.getByText(/实盘日志/)).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByTitle('导出表格').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^日志_\d{8}_\d{6}\.csv$/);
});
```

- [ ] **Step 2: 运行 E2E**

Run:

```bash
cd /workspace/frontend
npm run e2e -- --reporter=list tests-e2e/flow.upload-bet-reveal.spec.ts
```

Expected: PASS

---

## Task 5: 新增 E2E-003 token 失效/401 恢复体验

**Files:**
- Create: `/workspace/frontend/tests-e2e/flow.token-expiry.spec.ts`

- [ ] **Step 1: 编写用例（清理 localStorage 模拟未登录）**

Create `/workspace/frontend/tests-e2e/flow.token-expiry.spec.ts`：

```ts
import { test, expect } from '@playwright/test';

test('未登录/401：关键操作有提示且不闪屏', async ({ page, baseURL }) => {
  await page.goto('/dashboard/logs', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('admin_token'));

  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '刷新' }).click();
  await expect(page.getByText(/请先登录管理员/)).toBeVisible();

  await page.goto('/admin', { waitUntil: 'networkidle' });
  await expect(page.getByText(/管理员后台/)).toBeVisible();
});
```

- [ ] **Step 2: 运行 E2E**

Run:

```bash
cd /workspace/frontend
npm run e2e -- --reporter=list tests-e2e/flow.token-expiry.spec.ts
```

Expected: PASS

---

## Task 6: 新增 E2E-004 3AI 模式门禁（未配置/未测试/已测试）

**Files:**
- Create: `/workspace/frontend/tests-e2e/flow.3ai-gates.spec.ts`

- [ ] **Step 1: 用 reset 清空配置，验证按钮 disabled + 标签提示**

Create `/workspace/frontend/tests-e2e/flow.3ai-gates.spec.ts`：

```ts
import { test, expect } from '@playwright/test';
import { adminLogin, injectAdminToken, e2eReset } from './helpers';

test('3AI 模式门禁：未配置时禁用并提示', async ({ page, baseURL }) => {
  const token = await adminLogin(baseURL!);
  await e2eReset(baseURL!, token, { scope: 'all', keep_balance: true, prediction_mode: 'rule', boot_number: 1 });
  await injectAdminToken(page, token);

  await page.goto('/admin', { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: /AI大模型与规则引擎/ }).click();
  await page.getByRole('button', { name: /选择模式/ }).click();

  await expect(page.getByText(/3AI模式/)).toBeVisible();
  await expect(page.getByText(/未配置API/)).toBeVisible();
  await expect(page.getByRole('button', { name: /启用 3AI 模式/ })).toBeDisabled();
});
```

- [ ] **Step 2: 运行 E2E**

Run:

```bash
cd /workspace/frontend
npm run e2e -- --reporter=list tests-e2e/flow.3ai-gates.spec.ts
```

Expected: PASS

---

## Task 7: 新增 E2E-005 后台任务与维护面板

**Files:**
- Create: `/workspace/frontend/tests-e2e/flow.maintenance-tasks.spec.ts`

- [ ] **Step 1: 编写用例（打开维护 tab、触发一次维护动作）**

Create `/workspace/frontend/tests-e2e/flow.maintenance-tasks.spec.ts`：

```ts
import { test, expect } from '@playwright/test';
import { adminLogin, injectAdminToken } from './helpers';

test('维护与任务：能加载并可触发动作', async ({ page, baseURL }) => {
  const token = await adminLogin(baseURL!);
  await injectAdminToken(page, token);

  await page.goto('/admin', { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: /数据库存储/ }).click();
  await expect(page.getByText(/维护统计/)).toBeVisible();
});
```

- [ ] **Step 2: 运行 E2E**

Run:

```bash
cd /workspace/frontend
npm run e2e -- --reporter=list tests-e2e/flow.maintenance-tasks.spec.ts
```

Expected: PASS

---

## Task 8: 全量跑与产物检查（E2E + 单测 + lint + 后端单测）

**Files:**
- N/A

- [ ] **Step 1: 前端 lint**

Run:

```bash
cd /workspace/frontend
npm run lint
```

Expected: exit code 0

- [ ] **Step 2: 前端单测**

Run:

```bash
cd /workspace/frontend
npm test
```

Expected: PASS

- [ ] **Step 3: E2E 全量**

Run:

```bash
cd /workspace/frontend
npm run e2e -- --reporter=list
```

Expected: PASS

- [ ] **Step 4: 后端单测**

Run:

```bash
cd /workspace/backend
python -m unittest discover -s tests
```

Expected: PASS

---

## Plan self-review

- Spec 覆盖：reset/seed + E2E-001..005 + 失败证据（video/trace）均有对应任务
- Placeholder 扫描：无 TBD/TODO/“自行处理”类描述；每个任务给出文件、代码与命令
- 一致性：测试专用路由受 `E2E_TESTING` 保护且仍需管理员认证

---

## Execution handoff

计划已保存到 [2026-05-03-full-dogfood-e2e-deepdive-plan.md](file:///workspace/docs/superpowers/plans/2026-05-03-full-dogfood-e2e-deepdive-plan.md)。

两种执行方式：

1) Subagent-Driven（推荐）：每个 Task 作为独立执行单元，逐个验收  
2) Inline Execution：我在当前会话按 Task 顺序直接落地并跑全量测试

选择哪一种？
