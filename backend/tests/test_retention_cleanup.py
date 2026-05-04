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
            from sqlalchemy import delete, select

            await init_db()
            now = datetime.now()
            old_p3 = now - timedelta(days=10)
            old_p2 = now - timedelta(days=10)
            very_old_p1 = now - timedelta(days=365)

            async with async_session() as s:
                await s.execute(delete(SystemLog).where(SystemLog.event_code == "UT-RET"))
                await s.commit()

            async with async_session() as s:
                s.add(SystemLog(log_time=old_p3, boot_number=1, game_number=1, event_code="UT-RET", event_type="T", event_result="T", description="p3", category="T", priority="P3", retention_tier="hot7", is_pinned=False))
                s.add(SystemLog(log_time=old_p2, boot_number=1, game_number=1, event_code="UT-RET", event_type="T", event_result="T", description="p2", category="T", priority="P2", retention_tier="warm30", is_pinned=False))
                s.add(SystemLog(log_time=old_p3, boot_number=1, game_number=1, event_code="UT-RET", event_type="T", event_result="T", description="p1", category="T", priority="P1", retention_tier="cold_perm", is_pinned=False))
                s.add(SystemLog(log_time=very_old_p1, boot_number=1, game_number=1, event_code="UT-RET", event_type="T", event_result="T", description="p1_old", category="T", priority="P1", retention_tier="cold_perm", is_pinned=False))
                s.add(SystemLog(log_time=old_p3, boot_number=1, game_number=1, event_code="UT-RET", event_type="T", event_result="T", description="pinned", category="T", priority="P3", retention_tier="hot7", is_pinned=True))
                await s.commit()

            async with async_session() as s:
                await cleanup_logs(s, now=now, hot_days=7, warm_days=30)
                await s.commit()

            async with async_session() as s:
                from app.models.schemas import SystemLog
                rows = (await s.execute(select(SystemLog.description).where(SystemLog.event_code == "UT-RET"))).scalars().all()
                return sorted(rows)

        rows = asyncio.run(_run())
        self.assertEqual(rows, ["p1", "p2", "pinned"])


if __name__ == "__main__":
    unittest.main()
