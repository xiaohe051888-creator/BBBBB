import asyncio
import os
import sys
import unittest
from datetime import datetime

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.main import app


class StartupRecoveryPendingBetTest(unittest.TestCase):
    def test_recover_on_startup_restores_pending_bet(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.models.schemas import BetRecord
            from app.services.game.state import get_or_create_state
            from app.services.game.recovery import recover_on_startup
            from app.services.game.session import get_session, get_session_lock

            await init_db()

            async with async_session() as s:
                state = await get_or_create_state(s)
                state.boot_number = 1
                state.game_number = 3
                state.status = "空闲"
                await s.commit()

            lock = get_session_lock()
            async with lock:
                mem = get_session()
                mem.boot_number = 1
                mem.next_game_number = 4
                mem.status = "空闲"
                mem.pending_bet_direction = None
                mem.pending_bet_amount = None
                mem.pending_bet_tier = None
                mem.pending_bet_time = None
                mem.pending_game_number = None

            async with async_session() as s:
                s.add(
                    BetRecord(
                        boot_number=1,
                        game_number=4,
                        bet_seq=1,
                        bet_direction="庄",
                        bet_amount=10.0,
                        bet_tier="标准",
                        status="待开奖",
                        balance_before=20000.0,
                        balance_after=19990.0,
                        bet_time=datetime.now(),
                    )
                )
                await s.commit()

            async with async_session() as s:
                await recover_on_startup(s)

            async with async_session() as s:
                state2 = await get_or_create_state(s)
                status2 = state2.status

            async with lock:
                mem2 = get_session()
                return (
                    status2,
                    mem2.status,
                    mem2.pending_bet_direction,
                    mem2.pending_game_number,
                )

        status2, mem_status2, pending_dir, pending_game = asyncio.run(_run())
        self.assertEqual(status2, "等待开奖")
        self.assertEqual(mem_status2, "等待开奖")
        self.assertEqual(pending_dir, "庄")
        self.assertEqual(pending_game, 4)

    def test_reveal_route_after_startup_recovery_records_mistake_book(self):
        async def _seed():
            from app.core.database import init_db, async_session
            from app.models.schemas import BetRecord, MistakeBook
            from app.services.game.analysis import run_ai_analysis
            from app.services.game.betting import place_bet
            from app.services.game.recovery import recover_on_startup
            from app.services.game.session import clear_session, get_session
            from app.services.game.state import get_or_create_state, sync_balance_from_db
            from app.services.game.upload import upload_games
            from sqlalchemy import delete

            await init_db()

            async with async_session() as s:
                await s.execute(delete(MistakeBook))
                await s.execute(delete(BetRecord))
                state = await get_or_create_state(s)
                state.boot_number = 1
                state.game_number = 0
                state.status = "等待下注"
                state.balance = 1000
                state.consecutive_errors = 0
                state.prediction_mode = "rule"
                await s.commit()

            sess = get_session()
            sess.boot_number = 1
            sess.next_game_number = 1
            sess.status = "等待下注"
            sess.balance = 1000
            sess.prediction_mode = "rule"
            sess.consecutive_errors = 0
            sess.predict_direction = None
            sess.predict_confidence = None
            sess.pending_bet_direction = None
            sess.pending_game_number = None

            async with async_session() as s:
                upload_res = await upload_games(
                    db=s,
                    games=[{"game_number": 1, "result": "庄"}],
                    mode="new_boot",
                    balance_mode="keep",
                    run_deep_learning=False,
                )
                await s.commit()

            actual_boot = upload_res["boot_number"]

            async with async_session() as s:
                analysis_res = await run_ai_analysis(db=s, boot_number=actual_boot)
                await s.commit()
                prediction = analysis_res["prediction"]

                bet_res = await place_bet(
                    s,
                    game_number=analysis_res["game_number"],
                    direction=prediction,
                    amount=analysis_res["bet_amount"],
                )
                await s.commit()
                self.assertTrue(bet_res["success"])

            clear_session()

            async with async_session() as s:
                await sync_balance_from_db(s)
                await recover_on_startup(s)

        asyncio.run(_seed())

        with TestClient(app) as client:
            os.environ["ADMIN_DEFAULT_PASSWORD"] = "8888"
            login = client.post("/api/admin/login", json={"password": "8888"})
            self.assertEqual(login.status_code, 200)
            headers = {"Authorization": f"Bearer {login.json()['token']}"}

            current_state = client.get("/api/games/current-state", headers=headers)
            self.assertEqual(current_state.status_code, 200)
            state_payload = current_state.json()
            self.assertEqual(state_payload["status"], "等待开奖")
            self.assertEqual(state_payload["prediction_mode"], "rule")
            self.assertIsNone(state_payload["predict_direction"])
            self.assertEqual(state_payload["pending_bet"]["game_number"], 2)
            pending_direction = state_payload["pending_bet"]["direction"]
            reveal_result = "闲" if pending_direction == "庄" else "庄"

            reveal = client.post(
                "/api/games/reveal",
                json={"game_number": 2, "result": reveal_result},
                headers=headers,
            )
            self.assertEqual(reveal.status_code, 200)
            reveal_payload = reveal.json()
            self.assertTrue(reveal_payload["success"])
            self.assertFalse(reveal_payload["predict_correct"])

            records = client.get(
                "/api/admin/database-records",
                params={"table_name": "mistake_book", "page": 1, "page_size": 20},
                headers=headers,
            )
            self.assertEqual(records.status_code, 200)
            payload = records.json()
            self.assertEqual(payload["table"], "mistake_book")
            self.assertEqual(payload["total"], 1)
            self.assertEqual(len(payload["data"]), 1)
            self.assertEqual(payload["data"][0]["game_number"], 2)


if __name__ == "__main__":
    unittest.main()
