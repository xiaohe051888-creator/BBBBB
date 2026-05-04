import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class BootChangeClearsMicroLearningTest(unittest.TestCase):
    def test_new_boot_upload_preserves_mistakes_and_memories(self):
        async def _run():
            from datetime import datetime
            from sqlalchemy import select, func
            from app.core.database import init_db, async_session
            from app.models.schemas import GameRecord, MistakeBook, AIMemory
            from app.services.game.upload import upload_games

            await init_db()

            async with async_session() as s:
                seed = await upload_games(
                    db=s,
                    games=[{"game_number": 1, "result": "庄"}, {"game_number": 2, "result": "闲"}, {"game_number": 3, "result": "和"}],
                    mode="reset_current_boot",
                    balance_mode="keep",
                    run_deep_learning=False,
                )
                await s.commit()

            async with async_session() as s:
                s.add(MistakeBook(
                    boot_number=seed["boot_number"],
                    game_number=2,
                    prediction_mode="ai",
                    error_id="ERR-B1G2",
                    error_type="趋势误判",
                    predict_direction="庄",
                    actual_result="闲",
                    analysis="x",
                ))
                s.add(AIMemory(
                    boot_number=seed["boot_number"],
                    game_number=3,
                    version_id="default",
                    prediction_mode="ai",
                    error_type="实时推演策略",
                    prediction="N/A",
                    actual_result="N/A",
                    is_correct=True,
                    confidence=1.0,
                    road_snapshot="{}",
                    self_reflection="x",
                    created_at=datetime.now(),
                ))
                await s.commit()

            async with async_session() as s:
                res = await upload_games(
                    db=s,
                    games=[{"game_number": 1, "result": "庄"}, {"game_number": 2, "result": "庄"}, {"game_number": 3, "result": "闲"}],
                    mode="new_boot",
                    balance_mode="keep",
                    run_deep_learning=False,
                )
                await s.commit()

                mb_cnt = (
                    (await s.execute(select(func.count()).select_from(MistakeBook).where(MistakeBook.boot_number == seed["boot_number"])))
                    .scalar()
                    or 0
                )
                mem_cnt = (
                    (await s.execute(select(func.count()).select_from(AIMemory).where(AIMemory.boot_number == seed["boot_number"])))
                    .scalar()
                    or 0
                )
                gr_cnt_boot1 = (await s.execute(select(func.count()).select_from(GameRecord).where(GameRecord.boot_number == seed["boot_number"]))).scalar() or 0

            return seed["boot_number"], res["boot_number"], mb_cnt, mem_cnt, gr_cnt_boot1

        seed_boot, boot_number, mb_cnt, mem_cnt, gr_cnt_boot1 = asyncio.run(_run())
        self.assertEqual(boot_number, seed_boot + 1)
        self.assertEqual(mb_cnt, 1)
        self.assertEqual(mem_cnt, 1)
        self.assertEqual(gr_cnt_boot1, 3)

    def test_end_boot_preserves_mistakes_and_memories(self):
        async def _run():
            from datetime import datetime
            from sqlalchemy import select, func
            from app.core.database import init_db, async_session
            from app.models.schemas import MistakeBook, AIMemory, GameRecord
            from app.services.game.boot import end_boot
            from app.services.game.session import get_session, get_session_lock

            await init_db()

            async with async_session() as s:
                stmt = select(GameRecord.boot_number).order_by(GameRecord.boot_number.desc()).limit(1)
                res = await s.execute(stmt)
                current_boot = res.scalar_one_or_none() or 1

            lock = get_session_lock()
            async with lock:
                sess = get_session()
                sess.boot_number = current_boot
                sess.next_game_number = 1
                sess.status = "空闲"
                sess.pending_bet_direction = None
                sess.pending_game_number = None

            async with async_session() as s:
                s.add(MistakeBook(
                    boot_number=current_boot,
                    game_number=1,
                    prediction_mode="ai",
                    error_id="ERR-B1G1",
                    error_type="趋势误判",
                    predict_direction="庄",
                    actual_result="闲",
                    analysis="x",
                ))
                s.add(AIMemory(
                    boot_number=current_boot,
                    game_number=1,
                    version_id="default",
                    prediction_mode="ai",
                    error_type="实时推演策略",
                    prediction="N/A",
                    actual_result="N/A",
                    is_correct=True,
                    confidence=1.0,
                    road_snapshot="{}",
                    self_reflection="x",
                    created_at=datetime.now(),
                ))
                await s.commit()

            async with async_session() as s:
                res = await end_boot(s)
                await s.commit()

            async with async_session() as s:
                mb_cnt = (
                    (await s.execute(select(func.count()).select_from(MistakeBook).where(MistakeBook.boot_number == current_boot)))
                    .scalar()
                    or 0
                )
                mem_cnt = (
                    (await s.execute(select(func.count()).select_from(AIMemory).where(AIMemory.boot_number == current_boot)))
                    .scalar()
                    or 0
                )

            return current_boot, res["boot_number"], mb_cnt, mem_cnt

        current_boot, boot_number, mb_cnt, mem_cnt = asyncio.run(_run())
        self.assertEqual(boot_number, current_boot + 1)
        self.assertEqual(mb_cnt, 1)
        self.assertEqual(mem_cnt, 1)


if __name__ == "__main__":
    unittest.main()
