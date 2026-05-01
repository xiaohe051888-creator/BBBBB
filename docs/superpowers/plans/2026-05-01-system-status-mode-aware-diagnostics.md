# 实时系统状态按模式适配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** “实时系统状态/诊断/健康灯”全链路按 `ai / single_ai / rule` 当前模式计算与展示，其他模式就绪度仅提示不影响当前健康灯。

**Architecture:** 后端 `/api/system/diagnostics` 提供“模式感知”的统一模型列表、当前模式就绪度、分层 issues；`/api/system/health` AI 部分按当前模式评分并给出其它模式提示。前端 `useSystemDiagnostics` 消费新字段并将 current-mode issues 影响 overallHealth，`SystemStatusPanel` 改为“AI配置（当前模式）”并可折叠查看其它模式就绪度。

**Tech Stack:** FastAPI + SQLAlchemy(Async)；React + Ant Design；React hooks.

---

## Files To Touch

**Backend**
- Modify: [system.py](file:///workspace/backend/app/api/routes/system.py)
- Modify: [session.py](file:///workspace/backend/app/services/game/session.py)（如需补充当前模式来源则不改；优先从 get_current_state 读取）
- Test: `/workspace/backend/tests/test_system_diagnostics_mode_aware.py`（新增）
- Test: `/workspace/backend/tests/test_system_health_mode_aware.py`（新增）

**Frontend**
- Modify: [useSystemDiagnostics.ts](file:///workspace/frontend/src/hooks/useSystemDiagnostics.ts)
- Modify: [SystemStatusPanel.tsx](file:///workspace/frontend/src/components/ui/SystemStatusPanel.tsx)
- Modify: [api.ts](file:///workspace/frontend/src/services/api.ts)（若需扩展 diagnostics 类型）

---

### Task 1: 后端 diagnostics 输出“模式感知”结构（TDD）

**Files:**
- Create: `/workspace/backend/tests/test_system_diagnostics_mode_aware.py`
- Modify: [system.py](file:///workspace/backend/app/api/routes/system.py#L206-L326)

- [ ] **Step 1: Write failing test**

```python
import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class SystemDiagnosticsModeAwareTest(unittest.TestCase):
    def test_diagnostics_contains_current_mode_and_mode_readiness(self):
        async def _run():
            from app.api.routes.system import get_system_diagnostics
            from app.services.game.session import get_session, get_session_lock

            lock = get_session_lock()
            async with lock:
                sess = get_session()
                sess.prediction_mode = "rule"

            res = await get_system_diagnostics()
            return res

        res = asyncio.run(_run())
        self.assertIn("current_mode", res)
        self.assertIn("mode_readiness", res)
        self.assertIn("models", res)
        self.assertIn("issues_current_mode", res)
        self.assertIn("issues_other_modes", res)
        self.assertIn("overall_status_current_mode", res)
        self.assertEqual(res["current_mode"], "rule")
        self.assertEqual(res["mode_readiness"]["rule"]["status"], "ok")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m unittest backend/tests/test_system_diagnostics_mode_aware.py -v
```

Expected: FAIL（缺字段）

- [ ] **Step 3: Implement minimal diagnostics extension**

在 `get_system_diagnostics` 中：

1. 从 `get_current_state()` 获取 `prediction_mode` → `current_mode`
2. 计算四个 key 的 enabled：
   - openai/anthropic/gemini（现有）
   - single_ai（新增：基于 settings.SINGLE_AI_API_KEY）
3. 构造 `models` 统一列表：

```python
models = [
  {"key":"openai","label":"庄模型","provider":"openai","model":..., "enabled":openai_enabled, "required_in_modes":["ai"]},
  {"key":"anthropic","label":"闲模型","provider":"anthropic","model":..., "enabled":anthropic_enabled, "required_in_modes":["ai"]},
  {"key":"gemini","label":"综合模型","provider":"gemini","model":..., "enabled":gemini_enabled, "required_in_modes":["ai"]},
  {"key":"single_ai","label":"单AI","provider":"deepseek","model":settings.SINGLE_AI_MODEL, "enabled":single_ai_enabled, "required_in_modes":["single_ai"]},
]
```

并为每个 model 增加 `required_in_current_mode` 布尔值（由 current_mode 决定）。

4. 构造 `mode_readiness`：
   - ai required = ["openai","anthropic","gemini"]（缺任一 => critical）
   - single_ai required = ["single_ai"]（缺 => critical）
   - rule required = []（永远 ok）

5. issues 分层：
   - `issues_current_mode`：仅当前模式 missing 导致的 critical
   - `issues_other_modes`：其他模式 missing 的 info（不影响健康灯）

6. `overall_status_current_mode`：仅由当前模式 readiness 与 db_ok 决定（db_ok false => critical）

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m unittest backend/tests/test_system_diagnostics_mode_aware.py -v
```

Expected: PASS

---

### Task 2: 后端 health AI 评分按模式适配（TDD）

**Files:**
- Create: `/workspace/backend/tests/test_system_health_mode_aware.py`
- Modify: [system.py](file:///workspace/backend/app/api/routes/system.py#L66-L204)

- [ ] **Step 1: Write failing test**

```python
import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class SystemHealthModeAwareTest(unittest.TestCase):
    def test_rule_mode_does_not_penalize_ai_keys(self):
        async def _run():
            from app.api.routes.system import get_health_score
            from app.services.game.session import get_session, get_session_lock

            lock = get_session_lock()
            async with lock:
                sess = get_session()
                sess.prediction_mode = "rule"

            res = await get_health_score()
            return res

        res = asyncio.run(_run())
        self.assertIn("details", res)
        self.assertIn("ai_models", res["details"])
        self.assertGreaterEqual(res["details"]["ai_models"]["score"], 30)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m unittest backend/tests/test_system_health_mode_aware.py -v
```

Expected: FAIL（rule 模式仍因 3AI 缺 key 扣分）

- [ ] **Step 3: Implement mode-aware scoring**

在 `get_health_score()`：

1. 读取当前模式（从 `get_current_state()` 或 session）
2. `details.ai_models` 改为“当前模式 AI”：
   - ai：原三项逻辑（缺项扣分）
   - single_ai：仅检查 SINGLE_AI_API_KEY，若配置则 ai_models.score=40 否则 0
   - rule：ai_models.score=40 且 issues 为空
3. 新增 `details.ai_by_mode`（可选但推荐）：
   - current_mode
   - other_modes_issues（用于提示）

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m unittest backend/tests/test_system_health_mode_aware.py -v
```

Expected: PASS

---

### Task 3: 前端 useSystemDiagnostics 消费新 diagnostics 字段并分层告警

**Files:**
- Modify: [useSystemDiagnostics.ts](file:///workspace/frontend/src/hooks/useSystemDiagnostics.ts)
- Modify: [api.ts](file:///workspace/frontend/src/services/api.ts)（扩展 diagnostics 类型）

- [ ] **Step 1: 扩展 diagnostics API 类型**

在前端新增 diagnostics 类型（或扩展现有）支持：
- `current_mode`
- `models`（包含 single_ai）
- `mode_readiness`
- `issues_current_mode` / `issues_other_modes`
- `overall_status_current_mode`

- [ ] **Step 2: AI模型列表动态生成**

替换写死的三模型 `aiModels`：
- 以 `models` 字段为准渲染
- 仅 `required_in_current_mode` 的缺失触发 warning/critical
- `issues_other_modes` 只生成 info，不影响 overallHealth

- [ ] **Step 3: overallHealth 改造**

overallHealth 规则：
- offline/ws critical/后台任务卡死/DB critical 仍保持
- AI 仅由 `issues_current_mode` 影响（warning/critical）

---

### Task 4: 前端 SystemStatusPanel UI 文案与结构按模式适配

**Files:**
- Modify: [SystemStatusPanel.tsx](file:///workspace/frontend/src/components/ui/SystemStatusPanel.tsx)

- [ ] **Step 1: 标题与 tooltip 文案修正**

- “AI三模型” → “AI配置（当前模式）”
- tooltip 标题保持“实时系统状态”，但 AI 行显示当前模式与就绪状态

- [ ] **Step 2: Tag 分层展示**

- current required tags：高亮展示（✓/✗）
- other modes tags：折叠/次要展示（例如用灰色 Tag）

- [ ] **Step 3: build 验证**

```bash
npm run build
rm -rf /workspace/backend/static && mkdir -p /workspace/backend/static && cp -r /workspace/frontend/dist/* /workspace/backend/static/
```

Expected: PASS

---

### Task 5: 全量回归

- [ ] **Step 1: Backend tests**

```bash
mkdir -p /workspace/data
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```

- [ ] **Step 2: Frontend build**

```bash
cd /workspace/frontend && npm run build
```

---

## Plan Self-Review

- 覆盖 spec：diagnostics/health 按模式；分层 issues；前端面板按模式展示且不混用；3AI 严格三项齐全。
- 无 TBD/TODO；每步含具体文件与命令。

