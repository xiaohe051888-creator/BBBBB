# 单AI模式“五路全靴特征预处理”增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保持“全靴完整五路全量点位输入”的前提下，为单AI增加确定性 `road_features` 特征预处理，并把 `{{ROAD_FEATURES}}` 注入提示词模板，强制五路逐路解读与投票汇总，提升预测输出稳定性。

**Architecture:** 后端新增纯计算模块 `road_features.py`（从 `game_history + road_data` 提取全靴统计与逐路特征、冲突度、中断风险），在 `run_ai_analysis` 中计算并传给 `SingleModelService`，并扩展模板渲染支持 `{{ROAD_FEATURES}}`；前端管理员页占位符说明补充 `{{ROAD_FEATURES}}`。

**Tech Stack:** FastAPI + SQLAlchemy(async) + SQLite, pytest, React + antd + vitest.

---

## Files to touch

**Backend**
- Create: `backend/app/services/game/road_features.py`
- Modify: [analysis.py](file:///workspace/backend/app/services/game/analysis.py)
- Modify: [single_model_service.py](file:///workspace/backend/app/services/single_model_service.py)
- Modify: `backend/tests/test_single_ai_prompt_templates_api.py`（补覆盖）
- Create: `backend/tests/test_road_features.py`

**Frontend**
- Modify: [AdminPage.tsx](file:///workspace/frontend/src/pages/AdminPage.tsx)
- (Optional) Modify: [api.ts](file:///workspace/frontend/src/services/api.ts)（无需改接口，仅说明占位符）

---

### Task 1: 先写 road_features 单测（固定输入 → 固定输出）

**Files:**
- Create: `backend/tests/test_road_features.py`

- [ ] **Step 1: 写失败用例（最小可控数据）**

创建 `backend/tests/test_road_features.py`：

```python
import unittest


class RoadFeaturesTest(unittest.TestCase):
    def test_extracts_per_road_and_ensemble(self):
        from app.services.game.road_features import build_road_features

        game_history = [
            {"game_number": 1, "result": "庄"},
            {"game_number": 2, "result": "闲"},
            {"game_number": 3, "result": "庄"},
            {"game_number": 4, "result": "庄"},
            {"game_number": 5, "result": "闲"},
        ]
        road_data = {
            "big_road": {"display_name": "大路", "points": [{"game_number": 1, "value": "庄"}, {"game_number": 2, "value": "闲"}]},
            "bead_road": {"display_name": "珠盘路", "points": [{"game_number": 1, "value": "庄"}, {"game_number": 2, "value": "闲"}]},
            "big_eye": {"display_name": "大眼仔路", "points": [{"game_number": 3, "value": "红"}, {"game_number": 4, "value": "红"}]},
            "small_road": {"display_name": "小路", "points": [{"game_number": 3, "value": "蓝"}]},
            "cockroach_road": {"display_name": "螳螂路", "points": [{"game_number": 3, "value": "红"}]},
        }

        feat = build_road_features(boot_number=1, game_number=6, game_history=game_history, road_data=road_data)

        self.assertEqual(feat["boot_number"], 1)
        self.assertEqual(feat["game_number"], 6)
        self.assertCountEqual(
            feat["roads_present"],
            ["big_road", "bead_road", "big_eye", "small_road", "cockroach_road"],
        )

        per = feat["per_road"]
        self.assertIn("big_road", per)
        self.assertIn("big_eye", per)
        self.assertIn("ensemble", feat)
        self.assertIn("score", feat["ensemble"])
        self.assertIn("conflict_score", feat["ensemble"])
```

- [ ] **Step 2: 跑测试确认失败**

Run:
```bash
pytest -q backend/tests/test_road_features.py
```

Expected: FAIL（模块未实现）。

---

### Task 2: 实现 road_features 纯计算模块（全靴全量 + 不漏五路）

**Files:**
- Create: `backend/app/services/game/road_features.py`
- Test: `backend/tests/test_road_features.py`

- [ ] **Step 1: 最小实现（满足单测字段）**

实现 `build_road_features(...)`：

```python
from __future__ import annotations

from typing import Any


def build_road_features(
    boot_number: int,
    game_number: int,
    game_history: list[dict[str, Any]],
    road_data: dict[str, Any],
) -> dict[str, Any]:
    roads_present = ["big_road", "bead_road", "big_eye", "small_road", "cockroach_road"]

    per_road: dict[str, Any] = {}
    for k in roads_present:
        rd = road_data.get(k) or {}
        points = rd.get("points") or []
        last = None
        if points:
            last = points[-1].get("value")
        per_road[k] = {
            "display_name": rd.get("display_name") or k,
            "points_count": len(points),
            "last_value": last,
        }

    score = 0
    conflict_score = 0.0

    return {
        "boot_number": int(boot_number),
        "game_number": int(game_number),
        "roads_present": roads_present,
        "history_stats": {
            "total": len(game_history),
        },
        "per_road": per_road,
        "ensemble": {"score": score, "conflict_score": conflict_score},
    }
```

- [ ] **Step 2: 跑测试**

Run:
```bash
pytest -q backend/tests/test_road_features.py
```
Expected: PASS

- [ ] **Step 3: 增强实现（稳定、确定性）**

逐步扩展 `per_road[k]`：
- `values`：按 `game_number` 升序的 value 序列（从 points 提取）
- `run_length`：末段连续长度（对 values 的尾部相同值计数）
- `switches_last_12`：近 12 个 values 的切换次数
- 对红蓝路：`red_ratio_last_24`（近 24 的红比例）
- `signal_strength`：0~1（基于 run_length、switches 等确定性映射）
- `break_risk`：low/medium/high（确定性阈值）

并给出 `ensemble`：
- `vote_detail`：每路投票（+1/-1/0），规则：
  - 大路/珠盘路：基于近 12 非和局庄闲差得到方向
  - 红蓝路：近 24 红蓝差
  - 差小于阈值（例如 1 个）=> 0
- `score`：vote 和
- `conflict_score`：`1 - abs(score)/5`（0=一致，接近1=分裂）

- [ ] **Step 4: 补充单测断言（确保增强字段存在）**

在 `test_road_features.py` 里补：
```python
self.assertIn("vote_detail", feat["ensemble"])
for k in feat["roads_present"]:
    self.assertIn("run_length", feat["per_road"][k])
```

- [ ] **Step 5: 跑测试**

Run:
```bash
pytest -q backend/tests/test_road_features.py
```
Expected: PASS

---

### Task 3: 注入 ROAD_FEATURES 到单AI提示词（模板与默认 prompt）

**Files:**
- Modify: [single_model_service.py](file:///workspace/backend/app/services/single_model_service.py)
- Modify: [analysis.py](file:///workspace/backend/app/services/game/analysis.py)
- Test: `backend/tests/test_single_ai_prompt_templates_api.py`（可选补覆盖）

- [ ] **Step 1: 扩展 SingleModelService.analyze 入参**

把 `analyze(..., road_features: dict[str, Any] | None = None, ...)` 加到签名中，并在 `_build_prompt`/`_build_prompt_with_template` 渲染：
- 新占位符：`{{ROAD_FEATURES}}`
- 若模板不含该占位符，不额外拼接也不报错

示例渲染片段：
```python
rf = jsonable_encoder(road_features) if road_features else None
rendered = rendered.replace("{{ROAD_FEATURES}}", json.dumps(rf, ensure_ascii=False) if rf else "")
```

- [ ] **Step 2: run_ai_analysis 计算并传入 road_features**

在 [analysis.py](file:///workspace/backend/app/services/game/analysis.py) 调用单AI前：

```python
from app.services.game.road_features import build_road_features
road_features = build_road_features(boot_number=boot_number, game_number=next_game_number, game_history=game_history, road_data=road_data)
```

并传入：
```python
road_features=road_features,
```

- [ ] **Step 3: 更新默认 prompt（强调先读 ROAD_FEATURES 再逐路核对五路）**

在 [single_model_service.py](file:///workspace/backend/app/services/single_model_service.py) 的 `_build_prompt` 增加：
- `五路特征摘要: <ROAD_FEATURES JSON>`
- 强制模型逐路输出“投票 + 理由 + 冲突降级”

- [ ] **Step 4: 跑后端全量测试**

Run:
```bash
pytest -q backend/tests
```
Expected: PASS

---

### Task 4: 前端占位符说明补充 {{ROAD_FEATURES}}

**Files:**
- Modify: [AdminPage.tsx](file:///workspace/frontend/src/pages/AdminPage.tsx)

- [ ] **Step 1: 更新“下一局预测提示词模板”的 placeholder 提示**

将 placeholder 文案补充 `{{ROAD_FEATURES}}`：

```tsx
placeholder="支持占位符：... {{ROAD_FEATURES}}"
```

- [ ] **Step 2: 前端回归**

Run:
```bash
cd frontend
npm run lint && npm test && npm run build
```
Expected: PASS

---

### Task 5: 端到端回归

- [ ] **Step 1: 后端**

Run:
```bash
cd backend
pytest -q
```

- [ ] **Step 2: 前端**

Run:
```bash
cd frontend
npm run lint && npm test && npm run build
```

---

## Plan Self‑Review (done)

- Spec coverage：满足“全靴完整五路输入不变 + 新增 road_features + 模板占位符 + 逐路/投票/冲突降级约束”
- Placeholder scan：无 TBD/TODO
- Type consistency：新增占位符名固定为 `ROAD_FEATURES`

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-04-single-ai-road-features-enhancement-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks
2. **Inline Execution** - Execute tasks in this session using executing-plans with checkpoints

Which approach?

