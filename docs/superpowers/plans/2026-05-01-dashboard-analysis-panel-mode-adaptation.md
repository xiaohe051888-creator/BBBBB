# 首页“智能分析”按模式适配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 首页“智能分析”板块按 `3AI / 单AI / 规则` 模式分别展示，并支持“推理要点 + 可展开推理详情”，且不混用文案/结构。

**Architecture:** 后端在 `/api/analysis/latest` 返回中补充 `prediction_mode` 与推理字段（points/detail/engine），分析服务在生成结果时产出这些字段；前端 `AnalysisPanel` 根据 `systemState.prediction_mode` 渲染对应 UI，并在单AI/规则下使用单卡片结构，3AI 保留三卡片但只在综合卡展示推理模块。

**Tech Stack:** FastAPI + SQLAlchemy(Async)；React + Ant Design；React Query；Vite.

---

## Files To Touch

**Backend**
- Modify: [analysis.py](file:///workspace/backend/app/api/routes/analysis.py)
- Modify: [analysis.py](file:///workspace/backend/app/services/game/analysis.py)
- Modify: [single_model_service.py](file:///workspace/backend/app/services/single_model_service.py)
- Modify: [three_model_service.py](file:///workspace/backend/app/services/three_model_service.py)
- Modify: [rule_engine.py](file:///workspace/backend/app/services/game/rule_engine.py)（如不存在推理要点生成入口，则新增小函数）
- Test: `backend/tests/test_latest_analysis_includes_mode_and_reasoning.py`（新增）

**Frontend**
- Modify: [AnalysisPanel.tsx](file:///workspace/frontend/src/components/dashboard/AnalysisPanel.tsx)
- Modify: [api.ts](file:///workspace/frontend/src/services/api.ts)
- Modify: [useQueries.ts](file:///workspace/frontend/src/hooks/useQueries.ts)
- Test (optional): `frontend/src/components/dashboard/AnalysisPanel.test.tsx`（如果项目已有测试框架；若无则跳过）

---

### Task 1: 设计后端 LatestAnalysis 数据结构扩展（TDD）

**Files:**
- Create: `/workspace/backend/tests/test_latest_analysis_includes_mode_and_reasoning.py`
- Modify: [analysis.py](file:///workspace/backend/app/api/routes/analysis.py)

- [ ] **Step 1: Write failing test**

```python
import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class LatestAnalysisIncludesModeAndReasoningTest(unittest.TestCase):
    def test_latest_analysis_contains_prediction_mode_and_reasoning_fields(self):
        async def _run():
            from app.api.routes.analysis import get_latest_analysis
            from app.services.game.session import get_session, get_session_lock
            from app.services.game.state import _state

            lock = get_session_lock()
            async with lock:
                sess = get_session()
                sess.prediction_mode = "single_ai"
                _state["analysis"] = {
                    "time": "2026-05-01T00:00:00",
                    "banker_summary": "",
                    "player_summary": "",
                    "combined_summary": "x",
                    "combined_reasoning_points": ["p1", "p2"],
                    "combined_reasoning_detail": "detail",
                    "engine": {"provider": "deepseek", "model": "deepseek-v4-pro"},
                }
                _state["predict_confidence"] = 0.66
                _state["predict_bet_tier"] = "标准"
                _state["predict_direction"] = "庄"

            res = await get_latest_analysis()
            return res

        res = asyncio.run(_run())
        self.assertTrue(res["has_data"])
        self.assertEqual(res["prediction_mode"], "single_ai")
        self.assertIn("engine", res)
        self.assertIn("reasoning_points", res["combined_model"])
        self.assertIn("reasoning_detail", res["combined_model"])
        self.assertEqual(res["combined_model"]["reasoning_points"], ["p1", "p2"])
        self.assertEqual(res["combined_model"]["reasoning_detail"], "detail")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
python -m unittest backend/tests/test_latest_analysis_includes_mode_and_reasoning.py -v
```

Expected: FAIL（缺少 prediction_mode/engine/reasoning 字段）

- [ ] **Step 3: Implement minimal API extension**

在 `/api/analysis/latest` 返回中增加字段：
- 顶层：`prediction_mode`
- 顶层：`engine`（可选对象）
- `combined_model`：`reasoning_points`/`reasoning_detail`

伪代码（按现有 `mem["analysis"]` 结构读取）：

```python
return {
  ...,
  "prediction_mode": mem.get("prediction_mode", mem.get("analysis", {}).get("prediction_mode", "ai")),
  "engine": mem.get("analysis", {}).get("engine"),
  "combined_model": {
     ...,
     "reasoning_points": analysis.get("combined_reasoning_points") or [],
     "reasoning_detail": analysis.get("combined_reasoning_detail"),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m unittest backend/tests/test_latest_analysis_includes_mode_and_reasoning.py -v
```

Expected: PASS

- [ ] **Step 5: Run full backend test suite**

```bash
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```

Expected: PASS

---

### Task 2: 在分析执行链路写入“推理要点/详情/引擎信息”

**Files:**
- Modify: [analysis.py](file:///workspace/backend/app/services/game/analysis.py)
- Modify: [single_model_service.py](file:///workspace/backend/app/services/single_model_service.py)
- Modify: [three_model_service.py](file:///workspace/backend/app/services/three_model_service.py)
- Modify: [rule_engine.py](file:///workspace/backend/app/services/game/rule_engine.py)

- [ ] **Step 1: 单AI输出 schema 扩展**

修改单AI prompt JSON schema，新增：
- `reasoning_points`: string[]（3-6条，短句）
- `reasoning_detail`: string（200-600字，可读解释版推理）

示例（更新 `_build_prompt*` 输出约束）：

```text
输出必须是严格 JSON（不要任何额外文字），字段如下：
{
 "final_prediction":"庄或闲",
 "confidence":0-1,
 "bet_tier":"保守/标准/激进",
 "summary":"一句话摘要",
 "reasoning_points":["要点1","要点2"],
 "reasoning_detail":"更详细的解释版推理"
}
```

在 `analyze()` 的解析后，写回：
- `combined_model.reasoning_points`
- `combined_model.reasoning_detail`

- [ ] **Step 2: 3AI 综合模型输出扩展**

只在综合模型 prompt/解析结果中新增上述字段（banker/player 不要求）。

- [ ] **Step 3: 规则引擎推理要点/详情生成**

从规则引擎分析结果中补齐：
- `reasoning_points`: 3-6条（例如：当前形态、共振点、风险提示、结论原因）
- `reasoning_detail`: 200-400字（解释版推理）

若规则引擎目前只返回 summary，则在规则引擎实现内新增函数把已有判定信息拼成 points/detail。

- [ ] **Step 4: 将推理字段写入内存态 mem_state**

在 `run_ai_analysis` 更新内存态时，确保 `_state["analysis"]` 写入：
- `combined_reasoning_points`
- `combined_reasoning_detail`
- `engine`（例如：`{"provider":"deepseek","model":"deepseek-v4-pro"}`）
- `prediction_mode`（可选冗余，顶层也可来自 session/state）

- [ ] **Step 5: Run backend tests**

```bash
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```

Expected: PASS

---

### Task 3: 前端 API 类型与 query 适配（预测模式 + 推理字段）

**Files:**
- Modify: [api.ts](file:///workspace/frontend/src/services/api.ts)
- Modify: [useQueries.ts](file:///workspace/frontend/src/hooks/useQueries.ts)
- Modify: `frontend/src/types/models.ts`（若 `AnalysisData` 定义在此处）

- [ ] **Step 1: 扩展 LatestAnalysis 接口类型**

把 `/analysis/latest` 返回类型扩展：
- `prediction_mode?: 'ai'|'single_ai'|'rule'`
- `engine?: { provider?: string; model?: string } | null`
- `combined_model.reasoning_points?: string[]`
- `combined_model.reasoning_detail?: string | null`

- [ ] **Step 2: 扩展 useAnalysisQuery 映射**

在 `useAnalysisQuery` 返回的 `AnalysisData` 中增加：
- `prediction_mode`
- `engine`
- `reasoning_points`
- `reasoning_detail`

- [ ] **Step 3: Typecheck**

```bash
npm run build
```

Expected: PASS

---

### Task 4: AnalysisPanel 按模式重构 UI（单AI单卡 + 3AI综合推理 + 规则单卡）

**Files:**
- Modify: [AnalysisPanel.tsx](file:///workspace/frontend/src/components/dashboard/AnalysisPanel.tsx)

- [ ] **Step 1: 抽出 mode/engine**

从 `systemState.prediction_mode` 读取当前模式；若后端 analysis 里也带了 prediction_mode，优先一致性校验（不一致时以 systemState 为准并在 UI 里不显示冲突信息）。

- [ ] **Step 2: 分析中状态按模式渲染**

- 3AI：保留现有“三模型进度”。
- 单AI：显示单模型进度块（DeepSeek V4 Pro），并把“并行调用三模型服务”替换为“调用单模型推理服务”。
- 规则：保持规则模式文案。

- [ ] **Step 3: 结果态渲染**

**单AI**
- 仅显示 1 块“单AI（DeepSeek V4 Pro）”
- 展示：summary、reasoning_points（列表）、“查看推理详情”按钮（Drawer/Modal）、reasoning_detail（详情里）

**3AI**
- 继续显示：庄模型、闲模型、综合模型三块
- 仅在综合模型块中增加推理模块（points + detail）

**规则**
- 仅显示 1 块“规则引擎”
- 展示：summary、reasoning_points、detail（同上）

- [ ] **Step 4: 前端构建验证**

```bash
npm run build
rm -rf /workspace/backend/static && mkdir -p /workspace/backend/static && cp -r /workspace/frontend/dist/* /workspace/backend/static/
```

Expected: build PASS

---

### Task 5: 手工验收脚本（本地）

**Goal:** 确保 UI 文案/结构不混用，且详情可展开。

- [ ] **Step 1: 启动后端**

```bash
PYTHONPATH=/workspace/backend uvicorn app.api.main:app --host 0.0.0.0 --port 8001
```

- [ ] **Step 2: 在管理员页切换模式并观察首页智能分析**

Checklist：
- 单AI：不出现“庄模型/闲模型/三模型”字样；有推理要点；可展开详情
- 3AI：三卡片存在；仅综合卡出现推理要点/详情
- 规则：单卡片；规则推理要点/详情

---

## Plan Self-Review

- 覆盖需求：按模式适配智能分析、显示推理要点、可展开详细推理、3AI 只展示综合推理、单AI 单卡片、避免文案混用。
- 无 TBD/TODO/占位描述；每个任务包含明确文件路径、代码/命令与预期结果。

