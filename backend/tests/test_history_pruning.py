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
            from app.models.schemas import AIMemory, BetRecord, GameRecord, MistakeBook, RoadMap
            from app.services.game.retention import prune_history
            from sqlalchemy import select, func, delete

            await init_db()
            keep = 10
            base = 1_000_000_000

            async with async_session() as s:
                await s.execute(delete(GameRecord).where(GameRecord.boot_number >= base))
                await s.execute(delete(BetRecord).where(BetRecord.boot_number >= base))
                await s.execute(delete(RoadMap).where(RoadMap.boot_number >= base))
                await s.execute(delete(MistakeBook).where(MistakeBook.boot_number >= base))
                await s.execute(delete(AIMemory).where(AIMemory.boot_number >= base))
                await s.commit()

            async with async_session() as s:
                for i in range(1, 26):
                    boot_number = base + i
                    s.add(GameRecord(boot_number=boot_number, game_number=1, result="UT-PRUNE", result_time=datetime.now()))
                    s.add(BetRecord(boot_number=boot_number, game_number=1, bet_seq=1, bet_direction="庄", bet_amount=10, bet_tier="标准", status="已结算", balance_before=1000, balance_after=1000, created_at=datetime(2100, 1, 1, 0, 0, i)))
                    s.add(RoadMap(boot_number=boot_number, game_number=1, road_type="大路", position_x=0, position_y=0, value="庄", is_new_column=True))
                    s.add(MistakeBook(boot_number=boot_number, game_number=1, prediction_mode="ai", error_id="UT", error_type="UT", predict_direction="庄", actual_result="闲"))
                    s.add(AIMemory(boot_number=boot_number, game_number=1, version_id="UT", prediction_mode="ai"))
                await s.commit()

            async with async_session() as s:
                await prune_history(s, keep=keep)
                await s.commit()

            async with async_session() as s:
                g = (await s.execute(select(func.count()).select_from(GameRecord).where(GameRecord.boot_number >= base))).scalar() or 0
                b = (await s.execute(select(func.count()).select_from(BetRecord).where(BetRecord.boot_number >= base))).scalar() or 0
                r = (await s.execute(select(func.count()).select_from(RoadMap).where(RoadMap.boot_number >= base))).scalar() or 0
                m = (await s.execute(select(func.count()).select_from(MistakeBook).where(MistakeBook.boot_number >= base))).scalar() or 0
                a = (await s.execute(select(func.count()).select_from(AIMemory).where(AIMemory.boot_number >= base))).scalar() or 0
                return g, b, r, m, a

        g, b, r, m, a = asyncio.run(_run())
        self.assertEqual(g, 10)
        self.assertEqual(b, 10)
        self.assertEqual(r, 10)
        self.assertEqual(m, 10)
        self.assertEqual(a, 10)


if __name__ == "__main__":
    unittest.main()
