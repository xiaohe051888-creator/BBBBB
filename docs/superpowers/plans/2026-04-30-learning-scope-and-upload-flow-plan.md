# 学习触发语义修正（结束本靴不学习 + 管理员全库学习）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正学习触发语义：结束本靴不再触发学习；管理员后台“启动深度学习”改为基于全库历史数据学习并生成版本；同时保持上传新靴流程不再依赖 end_boot 学习。

**Architecture:** 后端将 AI 学习拆为“管理员手动学习（全库）”与“结束本靴（不学习）”两条路径：上传新靴只做数据写入与触发分析，不再启动深度学习；管理员学习服务在 `boot_number=0` 时自动取全库（最多1000局）作为训练集并创建新版本。前端同步移除上传确认弹窗中的“结束本靴学习”开关，避免误导，并在管理员页说明“全库学习”。

**Tech Stack:** FastAPI + SQLAlchemy Async + SQLite；React + TypeScript + Ant Design + Axios；unittest（后端回归脚本）。

---

## Files to Touch

**Backend**
- Modify: [schemas.py](file:///workspace/backend/app/api/routes/schemas.py)
- Modify: [analysis.py](file:///workspace/backend/app/api/routes/analysis.py)
- Modify: [ai_learning_service.py](file:///workspace/backend/app/services/ai_learning_service.py)
- Modify: [game.py](file:///workspace/backend/app/api/routes/game.py)
- Modify: [upload.py](file:///workspace/backend/app/services/game/upload.py)
- Test: [test_upload_modes.py](file:///workspace/backend/tests/test_upload_modes.py)（更新/扩展）
- Create: `backend/tests/test_admin_ai_learning_global.py`

**Frontend**
- Modify: [UploadConfirmModal.tsx](file:///workspace/frontend/src/components/upload/UploadConfirmModal.tsx)
- Modify: [UploadDataPage.tsx](file:///workspace/frontend/src/pages/UploadDataPage.tsx)
- Modify: [api.ts](file:///workspace/frontend/src/services/api.ts)
- Modify: [AdminPage.tsx](file:///workspace/frontend/src/pages/AdminPage.tsx)

---

## Task 1: 统一“最大局数”校验（后端 Pydantic 与业务一致）

**Files:**
- Modify: [schemas.py](file:///workspace/backend/app/api/routes/schemas.py)

- [ ] **Step 1: 写一个失败用例（可选，快检）**

在 `backend/tests/test_upload_modes.py` 新增一条断言：上传 `game_number=73` 应返回 400。

- [ ] **Step 2: 修改 Pydantic 上限到 72**

将 `GameUploadItem.game_number` 的 `le=80` 改为 `le=72`，与 `settings.MAX_UPLOAD_GAMES=72` 对齐。

- [ ] **Step 3: 运行后端测试**

Run:
```bash
python -m unittest backend/tests/test_upload_modes.py -v
```
Expected: PASS

---

## Task 2: 上传新靴不再触发 end_boot 学习（保持参数兼容但不执行学习）

**Files:**
- Modify: [game.py](file:///workspace/backend/app/api/routes/game.py)
- Modify: [upload.py](file:///workspace/backend/app/services/game/upload.py)

- [ ] **Step 1: 调整 `/api/games/upload` 的行为**

在路由层移除这段逻辑（或将其改为永远不触发）：
```py
if effective_mode == "new_boot" and effective_run_deep_learning and sess.status != "深度学习中":
    result = await end_boot(db=session)
```

目标行为：
- `mode=new_boot`：只执行写入新靴数据（boot_number+1）并触发分析
- `run_deep_learning` 字段若仍被前端传入：后端忽略，不应改变行为

- [ ] **Step 2: 清理 upload service 中“深度学习中排队上传”分支**

在 `upload_games` 中移除/禁用：
- `if effective_mode == "new_boot" and sess.status == "深度学习中": ... pending_upload ...`

目标行为：
- 深度学习状态不再影响上传（因为上传链路不再触发深度学习）
- 保持 `mode` / `balance_mode` 的语义不变

- [ ] **Step 3: 运行上传模式回归脚本**

Run:
```bash
python -m unittest backend/tests/test_upload_modes.py -v
```
Expected: PASS

---

## Task 3: 管理员“启动深度学习”改为全库学习（boot_number=0 自动全库）

**Files:**
- Modify: [analysis.py](file:///workspace/backend/app/api/routes/analysis.py)
- Modify: [ai_learning_service.py](file:///workspace/backend/app/services/ai_learning_service.py)
- Create: `backend/tests/test_admin_ai_learning_global.py`

- [ ] **Step 1: 设计全库训练集收集函数**

在 `AILearningService` 增加一个新方法：
```py
async def _collect_global_training_data(self) -> Dict[str, Any]:
    ...
```

建议策略（最小可用）：
- 只取 `GameRecord.predict_correct is not None` 的“有效结算局”
- 取最近 `<= 1000` 局（按 `id` 或 `(boot_number, game_number)` 排序）
- 同时聚合 MistakeBook（最近 N 条即可，例如 200 条）

返回结构与 `_collect_training_data` 保持同型（records/mistakes/stats），便于复用后续流程。

- [ ] **Step 2: 让 `start_learning(boot_number)` 支持全库模式**

当 `boot_number == 0` 时：
- `check_preconditions` 基于全库样本数判断（200~1000）
- `start_learning` 使用 `_collect_global_training_data()` 而不是 `_collect_training_data(boot_number)`
- 生成的新版本 `training_range` 写为例如 `"global_last_1000"`（或类似可读字符串）

当 `boot_number > 0` 时：
- 保持现有“指定靴号”学习逻辑不变（用于调试或未来扩展）

- [ ] **Step 3: 调整管理员路由提示文案**

`/api/admin/ai-learning/start` 返回 message 从：
`"正在分析第{boot_number}靴数据..."`
改为：
- `boot_number==0`：`"AI学习已启动，正在分析全库历史数据（最多1000局）..."`
- `boot_number>0`：仍保留原文案

- [ ] **Step 4: 新增回归测试（含登录拿 token）**

新增 `backend/tests/test_admin_ai_learning_global.py`，核心验证：
- 先通过 `/api/admin/login` 拿到 token
- 通过 `/api/admin/ai-learning/start?boot_number=0` 能成功启动（返回 200）

测试脚本示例：
```python
import json
import os
import time
import unittest
import urllib.request

BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8001")

def _post_json(url: str, payload: dict | None, headers: dict | None = None):
    body = b"" if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read().decode("utf-8")
        return resp.status, json.loads(data)

class AdminLearningGlobalTest(unittest.TestCase):
    def test_start_global_learning(self):
        status, login = _post_json(f"{BASE_URL}/api/admin/login", {"password": "8888"})
        self.assertEqual(status, 200, login)
        token = login["token"]

        status2, body2 = _post_json(
            f"{BASE_URL}/api/admin/ai-learning/start?boot_number=0",
            None,
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(status2, 200, body2)
        self.assertIn("message", body2)

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 5: 运行新测试**

Run:
```bash
python -m unittest backend/tests/test_admin_ai_learning_global.py -v
```
Expected: PASS（如果后端已启动）

---

## Task 4: 前端移除上传确认中的“结束本靴学习”开关，并对齐提交参数

**Files:**
- Modify: [UploadConfirmModal.tsx](file:///workspace/frontend/src/components/upload/UploadConfirmModal.tsx)
- Modify: [UploadDataPage.tsx](file:///workspace/frontend/src/pages/UploadDataPage.tsx)

- [ ] **Step 1: 简化 UploadConfirmValues**

将：
```ts
runDeepLearning: boolean;
```
从 `UploadConfirmValues` 中移除，并删掉相关 Switch UI。

- [ ] **Step 2: UploadDataPage 提交时不再发送 run_deep_learning**

将：
```ts
run_deep_learning: values.action === 'new_boot' ? values.runDeepLearning : undefined,
```
移除，避免误导。

- [ ] **Step 3: 手工验证**

在前端：
- 进入 `/upload` → 打开确认弹窗
- 看不到“执行深度学习（end_boot）”开关
- 仍可选择 “重置本靴 / 开启新靴” + 余额处理，并成功上传

---

## Task 5: 管理员页文案对齐（全库学习）

**Files:**
- Modify: [AdminPage.tsx](file:///workspace/frontend/src/pages/AdminPage.tsx)
- Modify: [api.ts](file:///workspace/frontend/src/services/api.ts)（如需）

- [ ] **Step 1: 更新 AI 学习卡片文案**

把 “学习范围/分靴学习/逐靴完成数据库” 改为 “全库学习/最多1000局”等与后端一致的描述。

- [ ] **Step 2: 保持启动参数为 0**

前端继续传 `startAiLearning(0)`，语义变为“全库学习自动选取数据”。

---

## Task 6: 端到端回归

- [ ] **Step 1: 启动服务**

Run:
```bash
./start-all.sh
```

- [ ] **Step 2: 上传新靴流程**

在 `/upload` 录入 1/2/3 数据 → 选择“结束本靴（开启新靴）” → 提交：
- 上传成功
- 回到 Dashboard
- 后端没有进入“深度学习中”，状态进入“分析中/分析完成/等待开奖”

- [ ] **Step 3: 管理员全库学习**

进入管理员后台 → “启动深度学习”：
- 后端返回“分析全库历史数据（最多1000局）”
- 学习状态变为学习中（可从 `/api/admin/ai-learning/status` 或 UI 观察）
