import asyncio
import os
import sys
import unittest
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class HistoryBackfillTest(unittest.TestCase):
    def test_system_backfill_history_endpoint_requires_auth(self):
        from fastapi.testclient import TestClient

        from app.api.main import app

        with TestClient(app) as client:
            response = client.post("/api/system/backfill-history", json={"boot_number": 1, "dry_run": True})

        self.assertEqual(response.status_code, 401)

    def test_backfill_history_from_bet_record(self):
        async def _run():
            from sqlalchemy import delete, select

            from app.core.database import async_session, init_db
            from app.models.schemas import BetRecord, GameRecord
            from app.services.game.history_backfill import backfill_history_for_boot

            os.makedirs(os.path.join(os.getcwd(), "data"), exist_ok=True)
            await init_db()
            async with async_session() as db:
                await db.execute(delete(GameRecord).where(GameRecord.boot_number == 88))
                await db.execute(delete(BetRecord).where(BetRecord.boot_number == 88))
                db.add(
                    GameRecord(
                        boot_number=88,
                        game_number=5,
                        result="庄",
                        predict_direction=None,
                        predict_correct=None,
                        profit_loss=0,
                    )
                )
                db.add(
                    BetRecord(
                        boot_number=88,
                        game_number=5,
                        bet_direction="庄",
                        bet_amount=10,
                        bet_tier="标准",
                        status="已结算",
                        settlement_amount=19.5,
                        profit_loss=9.5,
                        balance_before=1000.0,
                        balance_after=1009.5,
                    )
                )
                await db.commit()

                summary = await backfill_history_for_boot(db, boot_number=88, dry_run=False)
                await db.commit()

                row = (
                    await db.execute(
                        select(GameRecord).where(GameRecord.boot_number == 88, GameRecord.game_number == 5)
                    )
                ).scalar_one()
                return summary, row

        summary, row = asyncio.run(_run())
        self.assertEqual(summary["updated_games"], 1)
        self.assertEqual(row.predict_direction, "庄")
        self.assertTrue(row.predict_correct)
        self.assertEqual(float(row.profit_loss), 9.5)
        self.assertEqual(row.settlement_status, "已结算")

    def test_backfill_history_dry_run_from_logs_only(self):
        async def _run():
            from sqlalchemy import delete, select

            from app.core.database import async_session, init_db
            from app.models.schemas import GameRecord, SystemLog
            from app.services.game.history_backfill import backfill_history_for_boot

            os.makedirs(os.path.join(os.getcwd(), "data"), exist_ok=True)
            await init_db()
            async with async_session() as db:
                await db.execute(delete(GameRecord).where(GameRecord.boot_number == 89))
                await db.execute(delete(SystemLog).where(SystemLog.boot_number == 89))
                db.add(
                    GameRecord(
                        boot_number=89,
                        game_number=7,
                        result="闲",
                        predict_direction=None,
                        predict_correct=None,
                        profit_loss=0,
                    )
                )
                db.add(
                    SystemLog(
                        log_time=datetime(2026, 5, 10, 0, 0, 0),
                        boot_number=89,
                        game_number=7,
                        event_code="LOG-MDL-001",
                        event_type="AI分析",
                        event_result="成功",
                        description="🧠 AI对第7局推理完成：预测【闲】 (置信度: 55%)",
                        category="工作流事件",
                        priority="P3",
                    )
                )
                await db.commit()

                summary = await backfill_history_for_boot(db, boot_number=89, dry_run=True)
                row = (
                    await db.execute(
                        select(GameRecord).where(GameRecord.boot_number == 89, GameRecord.game_number == 7)
                    )
                ).scalar_one()
                return summary, row

        summary, row = asyncio.run(_run())
        self.assertEqual(summary["updated_games"], 1)
        self.assertTrue(summary["dry_run"])
        self.assertIsNone(row.predict_direction)
