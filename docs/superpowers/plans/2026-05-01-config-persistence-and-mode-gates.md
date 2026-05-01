# 配置持久化一致性 + 模式门禁统一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 API Key 配置“保存/读取路径不一致”导致重启后丢配置的问题，并统一管理员页与系统诊断对 3AI/单AI/规则的门禁口径。

**Architecture:** 后端在启动时将历史错误位置 `backend/app/.env` 的关键键合并到正确位置 `backend/.env`（不覆盖已存在值、不打印密钥）；后台保存配置统一写入 `backend/.env`；前端管理员页切换模式时使用与系统诊断一致的严格门禁（3AI 三项齐全）。

**Tech Stack:** FastAPI + python-dotenv；React + Ant Design。

---

## Files To Touch

**Backend**
- Create: `/workspace/backend/app/core/env_migration.py`
- Modify: [main.py](file:///workspace/backend/app/api/main.py)
- Modify: [auth.py](file:///workspace/backend/app/api/routes/auth.py)
- Test: `/workspace/backend/tests/test_env_migration_paths.py`

**Frontend**
- Modify: [AdminPage.tsx](file:///workspace/frontend/src/pages/AdminPage.tsx)

---

### Task 1: 后端 env 路径与迁移（TDD）

**Files:**
- Create: `/workspace/backend/app/core/env_migration.py`
- Create: `/workspace/backend/tests/test_env_migration_paths.py`
- Modify: [main.py](file:///workspace/backend/app/api/main.py)

- [ ] **Step 1: Write failing test**

```python
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class EnvMigrationPathsTest(unittest.TestCase):
    def test_env_paths_point_to_backend_dotenv(self):
        from app.core.env_migration import get_env_paths

        env_path, legacy_path = get_env_paths()
        self.assertTrue(env_path.endswith("/backend/.env"))
        self.assertTrue(legacy_path.endswith("/backend/app/.env"))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m unittest backend/tests/test_env_migration_paths.py -v
```

Expected: FAIL（模块不存在）

- [ ] **Step 3: Implement env_migration module**

创建 `/workspace/backend/app/core/env_migration.py`，提供：

- `get_env_paths() -> tuple[str, str]`：返回 `backend/.env` 与 `backend/app/.env`
- `merge_legacy_env(legacy_path: str, env_path: str) -> dict`：将白名单键从 legacy 合并到 env
  - 不覆盖 env 已有键
  - 仅合并白名单键
  - 不打印密钥值，仅返回统计信息（merged_keys / skipped / reason）

- [ ] **Step 4: Wire into app/api/main.py**

在 `load_dotenv` 之前调用：

```python
from app.core.env_migration import get_env_paths, merge_legacy_env
env_path, legacy_path = get_env_paths()
merge_legacy_env(legacy_path, env_path)
```

然后再执行 `load_dotenv(env_path, override=True)`（保留原逻辑）。

- [ ] **Step 5: Run test to verify it passes**

```bash
python -m unittest backend/tests/test_env_migration_paths.py -v
```

Expected: PASS

---

### Task 2: 后端保存配置写入同一路径

**Files:**
- Modify: [auth.py](file:///workspace/backend/app/api/routes/auth.py#L178-L235)

- [ ] **Step 1: 将 env_path 改为 get_env_paths() 返回的 env_path**

在 `update_api_config` 内：

- 使用 `from app.core.env_migration import get_env_paths`
- `env_path, _ = get_env_paths()`
- 保持“运行时 settings + os.environ”更新逻辑不变

- [ ] **Step 2: 快速回归**

```bash
python -m unittest backend/tests/test_system_diagnostics_mode_aware.py -v
```

Expected: PASS

---

### Task 3: 管理员页切换模式门禁口径统一

**Files:**
- Modify: [AdminPage.tsx](file:///workspace/frontend/src/pages/AdminPage.tsx#L141-L173)

- [ ] **Step 1: 3AI 门禁改为三项齐全**

将：

```ts
const isConfigured = banker || player || combined
```

改为：

```ts
const isConfigured = banker && player && combined
```

并调整提示文案为“3AI 需要三项均配置”。

- [ ] **Step 2: 前端构建回归**

```bash
cd /workspace/frontend && npm run build
```

Expected: PASS

---

### Task 4: 全量回归与重启验证

- [ ] **Step 1: Backend tests**

```bash
mkdir -p /workspace/data
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```

- [ ] **Step 2: Frontend build + sync static**

```bash
cd /workspace/frontend && npm run build
rm -rf /workspace/backend/static && mkdir -p /workspace/backend/static && cp -r /workspace/frontend/dist/* /workspace/backend/static/
```

- [ ] **Step 3: Restart**

```bash
PYTHONPATH=/workspace/backend python -m uvicorn app.api.main:app --host 0.0.0.0 --port 8001
```

---

## Plan Self-Review

- 覆盖 spec：统一 env 路径、启动迁移、管理员门禁口径统一、验证与回归命令齐全。
- 无 TBD/TODO。

