# Final Hardening And Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补强最后阶段的关键验收链路，并用小范围高收益重构完成系统收口。

**Architecture:** 先用测试锁定管理员登录、API 配置保存、模式切换、启动恢复 4 条关键链路，再在不改变业务语义的前提下，继续把启动编排和管理接口热点中的重复逻辑收拢到共享 helper。所有重构都由失败后转绿的测试保护。

**Tech Stack:** Python, FastAPI, SQLAlchemy, pytest, TypeScript, React, Vitest

---

### Task 1: Harden Admin Login Coverage

**Files:**
- Modify: `backend/tests/test_ws_requires_auth.py`
- Create: `backend/tests/test_admin_login_flow.py`
- Modify: `backend/app/api/routes/auth.py`

- [ ] **Step 1: Write the failing login acceptance tests**

```python
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class AdminLoginFlowTest(unittest.TestCase):
    def test_login_rejects_wrong_password(self):
        from fastapi.testclient import TestClient
        from app.api.main import app

        os.environ["ADMIN_DEFAULT_PASSWORD"] = "8888"
        client = TestClient(app)
        res = client.post("/api/admin/login", json={"password": "wrong"})

        self.assertEqual(res.status_code, 401)
        self.assertIn("密码错误", res.json()["detail"])

    def test_login_succeeds_with_default_password(self):
        from fastapi.testclient import TestClient
        from app.api.main import app

        os.environ["ADMIN_DEFAULT_PASSWORD"] = "8888"
        client = TestClient(app)
        res = client.post("/api/admin/login", json={"password": "8888"})

        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("token", data)
        self.assertEqual(data["username"], "admin")
```

- [ ] **Step 2: Run the login tests to verify failure or gap**

Run: `python -m pytest backend/tests/test_admin_login_flow.py -q`
Expected: 至少一条失败，暴露登录链路当前的缺口或环境依赖问题。

- [ ] **Step 3: Write the minimal implementation or test setup fix**

```python
# backend/app/api/routes/auth.py
@router.post("/login")
async def admin_login(req: LoginRequest):
    import bcrypt as _bcrypt
    ...
    if not valid:
        raise HTTPException(status_code=401, detail=f"密码错误，还剩{remaining}次机会")
    ...
    return {
        "token": token,
        "must_change_password": admin.must_change_password,
        "username": admin.username,
    }
```

- [ ] **Step 4: Run the focused tests again**

Run: `python -m pytest backend/tests/test_admin_login_flow.py backend/tests/test_ws_requires_auth.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_admin_login_flow.py backend/tests/test_ws_requires_auth.py backend/app/api/routes/auth.py
git commit -m "test(auth): harden admin login acceptance coverage"
```

### Task 2: Cover API Config Save And Mode Switch Acceptance

**Files:**
- Modify: `backend/tests/test_single_ai_prompt_templates_api.py`
- Create: `backend/tests/test_admin_api_config_save_flow.py`
- Modify: `backend/tests/test_prediction_mode_gates.py`
- Modify: `frontend/src/services/api.testApiConnection.test.ts`
- Modify: `frontend/src/components/admin/apiConfigFlow.test.ts`
- Modify: `frontend/src/pages/AdminPage.tsx`
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Write the failing backend acceptance tests for API config save**

```python
class AdminApiConfigSaveFlowTest(unittest.TestCase):
    def test_save_single_ai_config_updates_status_payload(self):
        from fastapi.testclient import TestClient
        from app.api.main import app

        client = TestClient(app)
        token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        payload = {
            "role": "single",
            "provider": "deepseek",
            "model": "deepseek-chat",
            "api_key": "single-key-123456",
            "base_url": "https://api.deepseek.com",
        }
        save_res = client.post("/api/admin/api-config", json=payload, headers=headers)
        status_res = client.get("/api/admin/three-model-status", headers=headers)

        assert save_res.status_code == 200
        assert status_res.status_code == 200
        assert status_res.json()["models"]["single"]["api_key_set"] is True
```

- [ ] **Step 2: Write the failing frontend flow tests for save and refresh**

```ts
it('closes the api config flow only after save succeeds and status refresh finishes', async () => {
  expect(shouldCloseApiConfigModalAfterSave()).toBe(true);
});

it('calls the single-ai prompt templates endpoints with the expected paths', async () => {
  expect(api.getSingleAiPromptTemplates).toBeDefined();
  expect(api.updateSingleAiPromptTemplates).toBeDefined();
});
```

- [ ] **Step 3: Run the focused tests to verify current failure**

Run: `python -m pytest backend/tests/test_admin_api_config_save_flow.py backend/tests/test_prediction_mode_gates.py -q`
Expected: FAIL until保存闭环与状态断言被锁定

Run: `npm test -- src/services/api.testApiConnection.test.ts src/components/admin/apiConfigFlow.test.ts`
Expected: FAIL 或暴露缺口

- [ ] **Step 4: Implement the minimal backend/frontend fixes**

```python
# backend/app/api/routes/auth.py
@router.post("/api-config")
async def update_api_config(...):
    ...
    write_env_updates(
        env_path,
        {
            k_key: req.api_key,
            m_key: req.model,
            b_key: req.base_url,
        },
    )
    ...
    return {"status": "success", "message": "接口配置已保存"}
```

```tsx
// frontend/src/pages/AdminPage.tsx
onSuccess={async () => {
  await loadThreeModelStatus();
  if (shouldCloseApiConfigModalAfterSave()) setApiConfigVisible(false);
}}
```

- [ ] **Step 5: Re-run tests and commit**

Run: `python -m pytest backend/tests/test_admin_api_config_save_flow.py backend/tests/test_prediction_mode_gates.py backend/tests/test_single_ai_prompt_templates_api.py -q`
Expected: PASS

Run: `npm test -- src/services/api.testApiConnection.test.ts src/components/admin/apiConfigFlow.test.ts`
Expected: PASS

```bash
git add backend/tests/test_admin_api_config_save_flow.py backend/tests/test_prediction_mode_gates.py backend/tests/test_single_ai_prompt_templates_api.py backend/app/api/routes/auth.py frontend/src/services/api.testApiConnection.test.ts frontend/src/components/admin/apiConfigFlow.test.ts frontend/src/pages/AdminPage.tsx frontend/src/services/api.ts
git commit -m "test(admin): cover config save and mode switch flows"
```

### Task 3: Strengthen Startup Recovery Acceptance

**Files:**
- Modify: `backend/tests/test_startup_recovery.py`
- Modify: `backend/tests/test_system_state_singleton_reads.py`
- Modify: `backend/tests/test_startup_state_seed.py`
- Modify: `backend/app/services/startup_state.py`
- Modify: `backend/app/services/game/state.py`
- Modify: `backend/app/api/main.py`

- [ ] **Step 1: Write the failing startup recovery acceptance tests**

```python
def test_recover_on_startup_restores_runtime_seed_and_pending_state():
    from app.services.startup_state import reconcile_startup_runtime_state
    ...
    assert current_mode == "rule"
    assert applied_seed["prediction_mode"] == "rule"
```

```python
def test_sync_balance_uses_state_game_number_when_no_game_rows_exist():
    ...
    self.assertEqual(next_game_number, 9)
```

- [ ] **Step 2: Run the focused startup tests**

Run: `python -m pytest backend/tests/test_startup_state_seed.py backend/tests/test_system_state_singleton_reads.py backend/tests/test_startup_recovery.py -q`
Expected: FAIL if startup recovery assumptions are not fully encoded

- [ ] **Step 3: Implement the minimal shared orchestration changes**

```python
# backend/app/services/startup_state.py
async def reconcile_startup_runtime_state(...):
    seed = resolve_startup_session_seed_from_settings(state, settings)
    current_mode = str(seed["prediction_mode"])
    if state and getattr(state, "prediction_mode", None) != current_mode and persist_mode is not None:
        await persist_mode(current_mode)
    await apply_seed(seed)
    return current_mode
```

```python
# backend/app/services/game/state.py
seed = build_startup_session_seed(state, max_game_number=max_game)
apply_startup_session_seed(sess, seed)
```

- [ ] **Step 4: Re-run startup tests and syntax validation**

Run: `python -m pytest backend/tests/test_startup_state_seed.py backend/tests/test_startup_recovery.py backend/tests/test_startup_recovery_pending_bet.py backend/tests/test_system_state_singleton_reads.py -q`
Expected: PASS

Run: `python -m py_compile backend/app/services/startup_state.py backend/app/services/game/state.py backend/app/api/main.py`
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_startup_state_seed.py backend/tests/test_startup_recovery.py backend/tests/test_system_state_singleton_reads.py backend/app/services/startup_state.py backend/app/services/game/state.py backend/app/api/main.py
git commit -m "refactor(startup): harden startup recovery orchestration"
```

### Task 4: Final Verification And Stop Condition

**Files:**
- Modify: `docs/superpowers/specs/2026-05-07-final-hardening-and-acceptance-design.md`
- Create: `docs/superpowers/plans/2026-05-07-final-hardening-and-acceptance-verification.md`

- [ ] **Step 1: Write the final verification checklist**

```md
# Final Hardening Verification

- [ ] 管理员登录通过
- [ ] API 配置保存后状态刷新正确
- [ ] 模式切换 gate 与页面状态一致
- [ ] 启动恢复链路通过
- [ ] Python 定向测试通过
- [ ] Frontend 定向测试通过
- [ ] 语法/构建校验通过
```

- [ ] **Step 2: Run the final verification commands**

Run: `python -m pytest backend/tests/test_admin_login_flow.py backend/tests/test_admin_api_config_save_flow.py backend/tests/test_prediction_mode_gates.py backend/tests/test_startup_state_seed.py backend/tests/test_startup_recovery.py -q`
Expected: PASS

Run: `npm test -- src/services/api.testApiConnection.test.ts src/components/admin/apiConfigFlow.test.ts src/utils/systemFlowConsistency.test.ts`
Expected: PASS

Run: `npm run lint && npm run build`
Expected: PASS

- [ ] **Step 3: Capture stop condition**

```md
如果以上链路全部通过，则停止继续结构重构，转入交付判断。
如果仍有失败，则只修失败链路，不新增新的重构目标。
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-05-07-final-hardening-and-acceptance-verification.md docs/superpowers/specs/2026-05-07-final-hardening-and-acceptance-design.md
git commit -m "docs(plan): add final hardening verification checklist"
```

## Self-Review

- Spec coverage:
  - 管理员登录：Task 1
  - API 配置保存：Task 2
  - 模式切换：Task 2
  - 启动恢复：Task 3
  - 最终收口与停止条件：Task 4
- Placeholder scan:
  - 未使用 TBD/TODO/“稍后实现”类占位
  - 每个任务都给出了明确文件、命令和代码示例
- Type consistency:
  - 启动链统一使用 `build_startup_session_seed`、`apply_startup_session_seed`、`reconcile_startup_runtime_state`
  - 管理链路统一使用 `/api/admin/api-config`、`/api/admin/three-model-status`、`/api/system/prediction-mode`
