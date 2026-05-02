# 系统全面完善（稳定性 + 可观测性 + Postgres 化）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将系统提升到“可长期运行 + 可上线部署 + 关键功能补齐”的交付标准，并迁移到 Postgres 作为长期运行数据库。

**Architecture:** 后端以“服务层统一错误结构 + 状态机集中化 + 幂等/并发边界测试锁定”的方式加固；数据层引入 Postgres（由 DATABASE_URL 驱动），并提供 SQLite→Postgres 迁移脚本；前端统一错误呈现与可观测性页面（日志页补齐）并清除用户可见英文错误码。

**Tech Stack:** FastAPI + SQLAlchemy Async + Postgres（asyncpg）/SQLite（aiosqlite，用于开发可选）；React + Vite + Ant Design + TanStack Query；Docker Compose；Render。

---

## 文件结构（本计划涉及）

**后端**
- 修改：
  - `/workspace/backend/app/core/database.py`（数据库 URL/引擎选择、关闭生命周期、PG 支持）
  - `/workspace/backend/app/core/config.py`（DATABASE_URL 配置项）
  - `/workspace/backend/app/api/main.py`（启动/关闭事件，关闭引擎）
  - `/workspace/backend/app/services/game/session.py`（会话状态定义集中化：状态常量/允许流转）
  - `/workspace/backend/app/services/game/reveal.py`、`/workspace/backend/app/services/game/betting.py`、`/workspace/backend/app/services/game/analysis.py`、`/workspace/backend/app/services/game/upload.py`（按状态机与幂等统一）
  - `/workspace/backend/app/api/routes/game.py`（HTTP 错误映射继续收敛）
- 新增：
  - `/workspace/backend/app/services/game/state_machine.py`（状态机规则集中定义）
  - `/workspace/backend/app/utils/errors.py`（统一错误码与中文 message 工具）
  - `/workspace/backend/scripts/migrate_sqlite_to_postgres.py`（一次性迁移脚本）
  - `/workspace/backend/tests/test_postgres_smoke.py`（可选：在有 PG 时跑的冒烟测试）

**前端**
- 修改：
  - `/workspace/frontend/src/services/api.ts`（错误消息统一）
  - `/workspace/frontend/src/utils/errorMessage.ts`（错误码映射补齐）
  - `/workspace/frontend/src/pages/LogsPage.tsx`（补齐筛选/详情/统计）
  - `/workspace/frontend/src/components/ui/SystemStatusPanel.tsx`（可观测性一致）
- 新增：
  - `/workspace/frontend/src/pages/LogsPage.impl.tsx`（可选：若 LogsPage 太大，拆出可复用子组件）

**部署**
- 修改：
  - `/workspace/docker-compose.yml`（增加 postgres service，并让 backend 使用 DATABASE_URL）
  - `/workspace/docker-compose.prod.yml`（生产环境变量补齐）
  - `/workspace/README.md`（全中文运行说明、迁移说明）

---

## Task 1：后端数据库层支持 Postgres（DATABASE_URL 驱动）

**Files:**
- Modify: `/workspace/backend/app/core/config.py`
- Modify: `/workspace/backend/app/core/database.py`
- Modify: `/workspace/backend/app/api/main.py`
- Test: `/workspace/backend/tests/test_database_url_parsing.py` (new)

- [ ] **Step 1: 写失败测试（DATABASE_URL 生效）**

Create `/workspace/backend/tests/test_database_url_parsing.py`：

```python
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class DatabaseUrlParsingTest(unittest.TestCase):
    def test_database_url_prefers_env(self):
        os.environ["DATABASE_URL"] = "postgresql+asyncpg://user:pass@localhost:5432/db"
        from app.core.config import settings
        self.assertIn("postgresql+asyncpg://", settings.DATABASE_URL)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python -m unittest backend/tests/test_database_url_parsing.py -v`  
Expected: FAIL（settings 无 DATABASE_URL 或不读取 env）

- [ ] **Step 3: 最小实现（config + database 引擎选择）**

在 `/workspace/backend/app/core/config.py` 增加 `DATABASE_URL` 配置项，默认仍可回退到 SQLite 文件（建议使用绝对路径以避免工作目录变化造成读错库）：

```python
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///<ABS_BACKEND_DIR>/data/baccarat.db")
```

在 `/workspace/backend/app/core/database.py` 中使用 `settings.DATABASE_URL` 创建 async engine，并保留 `init_db()`，同时新增 `close_db()`：

```python
async def close_db() -> None:
    await engine.dispose()
```

在 `/workspace/backend/app/api/main.py` 增加 shutdown hook 调用 `close_db()`。

- [ ] **Step 4: 运行测试确认通过**

Run: `python -m unittest backend/tests/test_database_url_parsing.py -v`  
Expected: PASS

- [ ] **Step 5: 跑全量后端测试**

Run: `python -m unittest discover -s backend/tests -p 'test_*.py' -v`  
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add backend/app/core/config.py backend/app/core/database.py backend/app/api/main.py backend/tests/test_database_url_parsing.py
git commit -m "feat(backend): add DATABASE_URL postgres support and graceful shutdown"
```

---

## Task 2：后端状态机集中化（消除散落字符串判断）

**Files:**
- Create: `/workspace/backend/app/services/game/state_machine.py`
- Modify: `/workspace/backend/app/services/game/betting.py`
- Modify: `/workspace/backend/app/services/game/reveal.py`
- Modify: `/workspace/backend/app/services/game/upload.py`
- Test: `/workspace/backend/tests/test_state_machine_rules.py` (new)

- [ ] **Step 1: 写失败测试（规则表存在且可复用）**

Create `/workspace/backend/tests/test_state_machine_rules.py`：

```python
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class StateMachineRulesTest(unittest.TestCase):
    def test_rules_expose_allowed_actions(self):
        from app.services.game.state_machine import can_place_bet, can_reveal, can_reset_current_boot
        self.assertTrue(can_place_bet("等待下注"))
        self.assertFalse(can_place_bet("等待开奖"))
        self.assertTrue(can_reveal("等待开奖"))
        self.assertFalse(can_reveal("分析中"))
        self.assertTrue(can_reset_current_boot("空闲"))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python -m unittest backend/tests/test_state_machine_rules.py -v`  
Expected: FAIL（模块不存在）

- [ ] **Step 3: 最小实现 state_machine.py**

Create `/workspace/backend/app/services/game/state_machine.py`：

```python
from typing import Tuple


def can_place_bet(status: str) -> bool:
    return status in ("等待下注", "分析完成")


def can_reveal(status: str) -> bool:
    return status == "等待开奖"


def can_reset_current_boot(status: str) -> Tuple[bool, str]:
    if status in ("深度学习中",):
        return False, "深度学习进行中，暂不允许覆盖本靴数据"
    return True, ""
```

- [ ] **Step 4: 修改 betting/reveal/upload 使用规则**

将 `betting.py` 的 `if sess.status not in (...)` 改为 `can_place_bet(sess.status)`；  
将 `reveal.py` 的 `if sess.status != "等待开奖"` 逻辑保持现有幂等特判，但“非法状态”返回统一 `error=illegal_state`；  
将 `upload.py` 中的深度学习中拦截改为 `can_reset_current_boot` 的返回。

- [ ] **Step 5: 运行规则测试与全量测试**

Run: `python -m unittest backend/tests/test_state_machine_rules.py -v`  
Expected: PASS

Run: `python -m unittest discover -s backend/tests -p 'test_*.py' -v`  
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add backend/app/services/game/state_machine.py backend/app/services/game/betting.py backend/app/services/game/reveal.py backend/app/services/game/upload.py backend/tests/test_state_machine_rules.py
git commit -m "refactor(backend): centralize game state machine checks"
```

---

## Task 3：统一错误结构与中文 detail（后端对外不暴露英文错误码）

**Files:**
- Create: `/workspace/backend/app/utils/errors.py`
- Modify: `/workspace/backend/app/api/routes/game.py`
- Test: `/workspace/backend/tests/test_error_messages_are_chinese.py` (new)

- [ ] **Step 1: 写失败测试（illegal_state 不返回英文码）**

Create `/workspace/backend/tests/test_error_messages_are_chinese.py`：

```python
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class ErrorMessagesChineseTest(unittest.TestCase):
    def test_http_exception_detail_should_not_be_raw_code(self):
        from app.api.routes.game import _upload_error_to_http_exception
        exc = _upload_error_to_http_exception({"success": False, "error": "illegal_state"})
        self.assertNotEqual(exc.detail, "illegal_state")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python -m unittest backend/tests/test_error_messages_are_chinese.py -v`  
Expected: FAIL（detail 可能是 raw code）

- [ ] **Step 3: 实现 errors.py 并接入路由映射**

Create `/workspace/backend/app/utils/errors.py`：

```python
def error_message(code: str) -> str:
    mapping = {
        "illegal_state": "当前状态不允许该操作，请刷新后重试",
        "stale_boot": "系统状态已变化，请刷新后重试",
    }
    return mapping.get(code, "请求失败，请稍后重试")
```

在 `_upload_error_to_http_exception/_reveal_error_to_http_exception` 中，当缺少 message 时用 `error_message(error)` 填充。

- [ ] **Step 4: 测试通过 + 全量测试**

Run: `python -m unittest backend/tests/test_error_messages_are_chinese.py -v`  
Expected: PASS

Run: `python -m unittest discover -s backend/tests -p 'test_*.py' -v`  
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add backend/app/utils/errors.py backend/app/api/routes/game.py backend/tests/test_error_messages_are_chinese.py
git commit -m "feat(backend): unify error messages and avoid raw error codes"
```

---

## Task 4：SQLite → Postgres 迁移脚本

**Files:**
- Create: `/workspace/backend/scripts/migrate_sqlite_to_postgres.py`
- Docs: `/workspace/README.md`

- [ ] **Step 1: 创建迁移脚本（读 SQLite 写 Postgres）**

Create `/workspace/backend/scripts/migrate_sqlite_to_postgres.py`（最小可用，按表逐个搬运；要求：不记录/打印密钥）：

```python
import asyncio
import os


async def main() -> None:
    sqlite_url = os.environ["SQLITE_URL"]
    postgres_url = os.environ["POSTGRES_URL"]

    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from sqlalchemy import select

    from app.models.schemas import GameRecord, BetRecord, MistakeBook, RoadMap, AIMemory, SystemLog, ModelVersion

    src_engine = create_async_engine(sqlite_url)
    dst_engine = create_async_engine(postgres_url)
    Src = async_sessionmaker(src_engine, expire_on_commit=False)
    Dst = async_sessionmaker(dst_engine, expire_on_commit=False)

    async with Src() as s, Dst() as d:
        for Model in (GameRecord, BetRecord, MistakeBook, RoadMap, AIMemory, SystemLog, ModelVersion):
            rows = (await s.execute(select(Model))).scalars().all()
            for r in rows:
                data = {c.name: getattr(r, c.name) for c in Model.__table__.columns if c.name != "id"}
                d.add(Model(**data))
            await d.commit()

    await src_engine.dispose()
    await dst_engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: README 增加迁移说明**

在 `/workspace/README.md` 增加“迁移到 Postgres”章节，写明：
- 配置 DATABASE_URL
- 启动 Postgres（docker compose）
- 运行迁移脚本（SQLITE_URL/POSTGRES_URL）

- [ ] **Step 3: 提交**

```bash
git add backend/scripts/migrate_sqlite_to_postgres.py README.md
git commit -m "feat(backend): add sqlite to postgres migration script and docs"
```

---

## Task 5：Docker Compose 增加 Postgres 并默认走 DATABASE_URL

**Files:**
- Modify: `/workspace/docker-compose.yml`
- Modify: `/workspace/docker-compose.prod.yml`

- [ ] **Step 1: 修改 docker-compose.yml 增加 postgres service**

新增 `postgres` 服务与 volume，并在 baccarat-app 增加 `DATABASE_URL`：

```yaml
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_USER=baccarat
      - POSTGRES_PASSWORD=baccarat
      - POSTGRES_DB=baccarat
    ports:
      - "5432:5432"
    volumes:
      - baccarat-pg:/var/lib/postgresql/data

  baccarat-app:
    environment:
      - DATABASE_URL=postgresql+asyncpg://baccarat:baccarat@postgres:5432/baccarat
    depends_on:
      - postgres

volumes:
  baccarat-pg:
```

- [ ] **Step 2: 修改 docker-compose.prod.yml 明确 DATABASE_URL 必填**

在生产 compose 中加入：

```yaml
      - DATABASE_URL=${DATABASE_URL}
```

- [ ] **Step 3: 提交**

```bash
git add docker-compose.yml docker-compose.prod.yml
git commit -m "feat(deploy): add postgres service and DATABASE_URL wiring"
```

---

## Task 6：日志页功能补齐（筛选 + 详情 + 统计）

**Files:**
- Modify: `/workspace/frontend/src/pages/LogsPage.tsx`

- [ ] **Step 1: 替换占位组件为可用实现**

在 LogsPage 内实现：
- 过滤栏：分类/优先级/关键词
- 详情弹窗：展示完整字段、复制
- 统计：按分类/优先级计数（复用现有 stats 结构）

- [ ] **Step 2: 运行前端校验**

Run: `npm run lint`  
Expected: PASS

Run: `npm run build`  
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add frontend/src/pages/LogsPage.tsx
git commit -m "feat(frontend): complete logs page filters and detail modal"
```

---

## Plan 自检

- 覆盖检查：设计稿的 Postgres 化、状态机集中化、错误口径统一、日志页补齐均有对应任务。
- 占位扫描：本计划未包含 TBD/TODO；每个任务包含明确文件与命令。
- 类型一致性：后端测试均使用 unittest；前端构建与 lint 作为验收。
