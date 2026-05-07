import asyncio
import os
import sys
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.main import app
from app.core.config import settings
from app.core.database import async_session, init_db
from app.models.schemas import GameRecord, SystemState
from app.services.game.session import clear_session, get_session
from app.services.game.state import get_or_create_state


class StartupLifespanRecoveryFlowTest(unittest.TestCase):
    def setUp(self) -> None:
        self._original_single_ai_api_key = getattr(settings, "SINGLE_AI_API_KEY", "")

    def tearDown(self) -> None:
        setattr(settings, "SINGLE_AI_API_KEY", self._original_single_ai_api_key)
        if self._original_single_ai_api_key:
            os.environ["SINGLE_AI_API_KEY"] = self._original_single_ai_api_key
        else:
            os.environ.pop("SINGLE_AI_API_KEY", None)
        clear_session()

    def _run_async(self, coro):
        return asyncio.run(coro)

    async def _seed_startup_state(
        self,
        *,
        boot_number: int,
        game_number: int,
        balance: float,
        prediction_mode: str,
        latest_recorded_game: int | None = None,
    ) -> None:
        await init_db()
        async with async_session() as session:
            await session.execute(delete(GameRecord).where(GameRecord.boot_number == boot_number))
            state = await get_or_create_state(session)
            state.boot_number = boot_number
            state.game_number = game_number
            state.balance = balance
            state.prediction_mode = prediction_mode
            state.consecutive_errors = 2
            if latest_recorded_game is not None:
                session.add(
                    GameRecord(
                        boot_number=boot_number,
                        game_number=latest_recorded_game,
                        result="庄",
                        prediction_mode=prediction_mode,
                    )
                )
            await session.commit()

    async def _get_db_state(self) -> SystemState:
        async with async_session() as session:
            result = await session.execute(
                select(SystemState).where(SystemState.singleton_key == 1)
            )
            return result.scalar_one()

    def test_startup_falls_back_to_rule_when_single_ai_secret_missing(self):
        setattr(settings, "SINGLE_AI_API_KEY", "")
        os.environ.pop("SINGLE_AI_API_KEY", None)
        self._run_async(
            self._seed_startup_state(
                boot_number=91,
                game_number=7,
                balance=12345.0,
                prediction_mode="single_ai",
            )
        )
        clear_session()

        with TestClient(app):
            mem = get_session()
            self.assertEqual(mem.prediction_mode, "rule")
            self.assertEqual(mem.boot_number, 91)
            self.assertEqual(mem.next_game_number, 8)
            self.assertEqual(mem.balance, 12345.0)

        state = self._run_async(self._get_db_state())
        self.assertEqual(state.prediction_mode, "rule")

    def test_startup_uses_latest_recorded_game_number_for_next_round(self):
        setattr(settings, "SINGLE_AI_API_KEY", "sk-startup-1234567890")
        os.environ["SINGLE_AI_API_KEY"] = "sk-startup-1234567890"
        self._run_async(
            self._seed_startup_state(
                boot_number=92,
                game_number=4,
                balance=8888.0,
                prediction_mode="single_ai",
                latest_recorded_game=11,
            )
        )
        clear_session()

        with TestClient(app):
            mem = get_session()
            self.assertEqual(mem.prediction_mode, "single_ai")
            self.assertEqual(mem.boot_number, 92)
            self.assertEqual(mem.next_game_number, 12)
            self.assertEqual(mem.balance, 8888.0)


if __name__ == "__main__":
    unittest.main()
