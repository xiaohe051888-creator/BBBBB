import asyncio
import json
import os
import sys
import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class MicroLearningUsesFullRoadsTest(unittest.TestCase):
    def test_micro_learning_road_snapshot_is_full_summary(self):
        async def _run():
            from sqlalchemy import select
            from app.core.database import init_db, async_session
            from app.models.schemas import AIMemory, GameRecord
            from app.services.game.learning import micro_learning_current_trend

            await init_db()

            boot = int(uuid4().int % 1_000_000_000) + 1000
            async with async_session() as s:
                for i in range(1, 21):
                    s.add(GameRecord(boot_number=boot, game_number=i, result="庄"))
                await s.commit()

            mock_roads = {
                "big_road": {"points": [{"game_number": i} for i in range(1, 51)]},
                "bead_road": {"points": [{"game_number": i} for i in range(1, 31)]},
                "big_eye": {"points": [{"game_number": i} for i in range(1, 21)]},
                "small_road": {"points": [{"game_number": i} for i in range(1, 11)]},
                "cockroach_road": {"points": [{"game_number": i} for i in range(1, 6)]},
            }

            with patch("app.services.road_engine.UnifiedRoadEngine.get_all_roads", new=AsyncMock(return_value=mock_roads)):
                with patch("app.services.three_model_service.ThreeModelService.realtime_strategy_learning", new=AsyncMock(return_value="ok")):
                    async with async_session() as s:
                        await micro_learning_current_trend(s, boot_number=boot, current_game_number=21)

            async with async_session() as s:
                mem = (await s.execute(
                    select(AIMemory).where(AIMemory.boot_number == boot).order_by(AIMemory.id.desc()).limit(1)
                )).scalars().first()

            self.assertIsNotNone(mem)
            payload = json.loads(mem.road_snapshot)
            roads = payload["roads"]
            return roads

        roads = asyncio.run(_run())
        self.assertEqual(roads["big_road"]["point_count"], 50)
        self.assertEqual(roads["bead_road"]["point_count"], 30)
        self.assertEqual(roads["big_eye"]["point_count"], 20)
        self.assertEqual(roads["small_road"]["point_count"], 10)
        self.assertEqual(roads["cockroach_road"]["point_count"], 5)


if __name__ == "__main__":
    unittest.main()
