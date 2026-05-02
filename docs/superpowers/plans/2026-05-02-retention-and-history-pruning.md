# 自动清理（日志保留 + 历史数据裁剪）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按优先级自动清理系统日志与历史数据，避免长期运行导致数据库膨胀，同时不影响主流程。

**Architecture:** 新增 `retention` 服务函数；`write_game_log` 负责标记 tier；Watchdog 每小时触发一次清理（节流 + 失败兜底写日志）。

**Tech Stack:** FastAPI + SQLAlchemy Async + unittest。

---

### Task 1: 新增 Retention 清理服务（先写测试）

**Files:**
- Create: `/workspace/backend/app/services/game/retention.py`
- Create: `/workspace/backend/tests/test_retention_cleanup.py`

- [ ] **Step 1: 写失败用例（P2/P3 会被清理，P1/pinned 不清理）**

Create `backend/tests/test_retention_cleanup.py`:

```python
import asyncio
import os
import sys
import unittest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class RetentionCleanupTest(unittest.TestCase):
    def test_log_retention_respects_priority_and_pinned(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.models.schemas import SystemLog
            from app.services.game.retention import cleanup_logs

            await init_db()
            now = datetime.now()
            old_p3 = now - timedelta(days=10)
            old_p2 = now - timedelta(days=40)

            async with async_session() as s:
                s.add(SystemLog(log_time=old_p3, boot_number=1, game_number=1, event_code="T", event_type="T", event_result="T", description="p3", category="T", priority="P3", is_pinned=False))
                s.add(SystemLog(log_time=old_p2, boot_number=1, game_number=1, event_code="T", event_type="T", event_result="T", description="p2", category="T", priority="P2", is_pinned=False))
                s.add(SystemLog(log_time=old_p3, boot_number=1, game_number=1, event_code="T", event_type="T", event_result="T", description="p1", category="T", priority="P1", is_pinned=False))
                s.add(SystemLog(log_time=old_p3, boot_number=1, game_number=1, event_code="T", event_type="T", event_result="T", description="pinned", category="T", priority="P3", is_pinned=True))
                await s.commit()

            async with async_session() as s:
                res = await cleanup_logs(s, now=now, hot_days=7, warm_days=30)
                await s.commit()

            async with async_session() as s:
                from sqlalchemy import select, func
                from app.models.schemas import SystemLog
                total = (await s.execute(select(func.count()).select_from(SystemLog))).scalar() or 0
                pinned = (await s.execute(select(func.count()).select_from(SystemLog).where(SystemLog.is_pinned == True))).scalar() or 0
                p1 = (await s.execute(select(func.count()).select_from(SystemLog).where(SystemLog.priority == "P1"))).scalar() or 0
                return res, total, pinned, p1

        res, total, pinned, p1 = asyncio.run(_run())
        self.assertEqual(res["deleted_p3"], 1)
        self.assertEqual(res["deleted_p2"], 1)
        self.assertEqual(pinned, 1)
        self.assertEqual(p1, 1)
        self.assertEqual(total, 2)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 写最小实现（让测试通过）**

Create `backend/app/services/game/retention.py`:

```python
from datetime import datetime, timedelta
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import SystemLog


async def cleanup_logs(
    session: AsyncSession,
    now: datetime | None = None,
    hot_days: int = 7,
    warm_days: int = 30,
) -> dict:
    now = now or datetime.now()
    hot_cutoff = now - timedelta(days=int(hot_days))
    warm_cutoff = now - timedelta(days=int(warm_days))

    p3 = await session.execute(
        delete(SystemLog).where(
            SystemLog.is_pinned == False,
            SystemLog.priority == "P3",
            SystemLog.log_time < hot_cutoff,
        )
    )
    p2 = await session.execute(
        delete(SystemLog).where(
            SystemLog.is_pinned == False,
            SystemLog.priority == "P2",
            SystemLog.log_time < warm_cutoff,
        )
    )

    return {"deleted_p3": int(p3.rowcount or 0), "deleted_p2": int(p2.rowcount or 0)}
```

- [ ] **Step 3: 运行用例验证**

Run:
```bash
mkdir -p /workspace/data
python -m unittest backend/tests/test_retention_cleanup.py -v
```
Expected: PASS.

---

### Task 2: 历史数据裁剪（GameRecord / BetRecord）

**Files:**
- Modify: `/workspace/backend/app/services/game/retention.py`
- Create: `/workspace/backend/tests/test_history_pruning.py`

- [ ] **Step 1: 写失败用例（插入超过 N 条后裁剪到 N）**

Create `backend/tests/test_history_pruning.py`:

```python
import asyncio
import os
import sys
import unittest
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class HistoryPruningTest(unittest.TestCase):
    def test_prune_history_keeps_latest_n(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.models.schemas import GameRecord, BetRecord
            from app.services.game.retention import prune_history
            from sqlalchemy import select, func

            await init_db()
            keep = 10
            async with async_session() as s:
                for i in range(1, 26):
                    s.add(GameRecord(boot_number=i, game_number=1, result="庄", result_time=datetime.now()))
                    s.add(BetRecord(boot_number=i, game_number=1, bet_seq=1, bet_direction="庄", bet_amount=10, bet_tier="标准", status="已结算", balance_before=1000, balance_after=1000))
                await s.commit()

            async with async_session() as s:
                res = await prune_history(s, keep=keep)
                await s.commit()

            async with async_session() as s:
                g = (await s.execute(select(func.count()).select_from(GameRecord))).scalar() or 0
                b = (await s.execute(select(func.count()).select_from(BetRecord))).scalar() or 0
                return res, g, b

        res, g, b = asyncio.run(_run())
        self.assertEqual(g, 10)
        self.assertEqual(b, 10)
        self.assertTrue(res["deleted_game_records"] >= 15)
        self.assertTrue(res["deleted_bet_records"] >= 15)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 实现 prune_history**

Append in `backend/app/services/game/retention.py`:

```python
from sqlalchemy import select
from app.models.schemas import GameRecord, BetRecord


async def prune_history(session: AsyncSession, keep: int = 1000) -> dict:
    keep = int(keep)
    if keep <= 0:
        return {"deleted_game_records": 0, "deleted_bet_records": 0}

    game_ids = (await session.execute(
        select(GameRecord.id).order_by(GameRecord.boot_number.desc(), GameRecord.game_number.desc()).offset(keep)
    )).scalars().all()
    bet_ids = (await session.execute(
        select(BetRecord.id).order_by(BetRecord.created_at.desc()).offset(keep)
    )).scalars().all()

    deleted_game = 0
    deleted_bet = 0
    if game_ids:
        r = await session.execute(delete(GameRecord).where(GameRecord.id.in_(game_ids)))
        deleted_game = int(r.rowcount or 0)
    if bet_ids:
        r = await session.execute(delete(BetRecord).where(BetRecord.id.in_(bet_ids)))
        deleted_bet = int(r.rowcount or 0)

    return {"deleted_game_records": deleted_game, "deleted_bet_records": deleted_bet}
```

- [ ] **Step 3: 运行用例验证**

Run:
```bash
python -m unittest backend/tests/test_history_pruning.py -v
```
Expected: PASS.

---

### Task 3: Watchdog 集成（每小时执行一次 + 失败兜底写 P1 日志）

**Files:**
- Modify: `/workspace/backend/app/services/game/watchdog.py`
- Modify: `/workspace/backend/app/core/config.py`
- Modify: `/workspace/backend/app/services/game/logging.py`

- [ ] **Step 1: 增加配置项**

在 `Settings` 中增加：
- `RETENTION_ENABLED`（默认 true）
- `RETENTION_INTERVAL_SECONDS`（默认 3600）

- [ ] **Step 2: write_game_log 设置 retention_tier**

在 `write_game_log` 中按 `priority/is_pinned` 设置 `retention_tier` 值（cold_perm / warm30 / hot7）。

- [ ] **Step 3: Watchdog 调用 cleanup + prune**

在 `Watchdog.check_once` 增加节流字段 `_last_retention_ts`，满足间隔时执行：
- `cleanup_logs(session, hot_days=settings.LOG_RETENTION_HOT, warm_days=settings.LOG_RETENTION_WARM)`
- `prune_history(session, keep=settings.MAX_HISTORY_RECORDS)`

异常：捕获并写入一条 `LOG-WDG-RET` 的 P1 日志提示（不抛出）。

- [ ] **Step 4: 后端全量单测**

Run:
```bash
mkdir -p /workspace/data
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```
Expected: PASS.

