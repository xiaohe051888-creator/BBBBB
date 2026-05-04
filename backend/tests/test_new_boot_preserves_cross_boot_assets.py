import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class NewBootPreservesCrossBootAssetsTest(unittest.TestCase):
    def test_new_boot_does_not_delete_mistake_or_memory_history(self):
        async def _run():
            from sqlalchemy import select, func

            from app.core.database import init_db, async_session
            from app.models.schemas import MistakeBook, AIMemory
            from app.services.game.upload import upload_games

            await init_db()

            async with async_session() as s:
                seed = await upload_games(
                    db=s,
                    games=[{"game_number": 1, "result": "庄"}],
                    mode="reset_current_boot",
                    balance_mode="keep",
                    run_deep_learning=False,
                )
                await s.commit()

            async with async_session() as s:
                s.add(
                    MistakeBook(
                        boot_number=seed["boot_number"],
                        game_number=1,
                        prediction_mode="ai",
                        error_id=f"ERR-B{seed['boot_number']}G1",
                        error_type="趋势误判",
                        predict_direction="闲",
                        actual_result="庄",
                        confidence=0.55,
                    )
                )
                s.add(
                    AIMemory(
                        boot_number=seed["boot_number"],
                        game_number=1,
                        prediction_mode="ai",
                        error_type="实时推演策略",
                        prediction="闲",
                        actual_result="庄",
                        is_correct=False,
                        confidence=0.55,
                    )
                )
                await s.commit()

            async with async_session() as s:
                res = await upload_games(
                    db=s,
                    games=[{"game_number": 1, "result": "闲"}],
                    mode="new_boot",
                    balance_mode="keep",
                    run_deep_learning=False,
                )
                await s.commit()

            async with async_session() as s:
                mistake_count = (
                    await s.execute(
                        select(func.count()).select_from(MistakeBook).where(MistakeBook.boot_number == seed["boot_number"])
                    )
                ).scalar_one()
                memory_count = (
                    await s.execute(
                        select(func.count()).select_from(AIMemory).where(AIMemory.boot_number == seed["boot_number"])
                    )
                ).scalar_one()

            return seed, res, mistake_count, memory_count

        seed, res, mistake_count, memory_count = asyncio.run(_run())
        self.assertTrue(seed["success"])
        self.assertTrue(res["success"])
        self.assertEqual(res["boot_number"], seed["boot_number"] + 1)
        self.assertEqual(mistake_count, 1)
        self.assertEqual(memory_count, 1)


if __name__ == "__main__":
    unittest.main()

