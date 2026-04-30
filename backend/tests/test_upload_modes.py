import asyncio
import os
import sys
import unittest

from pydantic import ValidationError

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class UploadModesTest(unittest.TestCase):
    def test_reset_current_boot_keep_balance(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.services.game.upload import upload_games

            await init_db()

            async with async_session() as s:
                res1 = await upload_games(
                    db=s,
                    games=[{"game_number": 1, "result": "庄"}, {"game_number": 2, "result": "闲"}, {"game_number": 3, "result": "和"}],
                    mode="reset_current_boot",
                    balance_mode="keep",
                    run_deep_learning=False,
                )
                await s.commit()

            async with async_session() as s:
                res2 = await upload_games(
                    db=s,
                    games=[{"game_number": 1, "result": "庄"}, {"game_number": 2, "result": "闲"}, {"game_number": 3, "result": "和"}],
                    mode="reset_current_boot",
                    balance_mode="keep",
                    run_deep_learning=False,
                )
                await s.commit()

            return res1, res2

        res1, res2 = asyncio.run(_run())
        self.assertTrue(res1["success"])
        self.assertTrue(res2["success"])
        self.assertEqual(res2["boot_number"], res1["boot_number"])

    def test_new_boot_skip_deep_learning(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.services.game.upload import upload_games
            from app.services.game.state import get_or_create_state

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
                res = await upload_games(
                    db=s,
                    games=[{"game_number": 1, "result": "庄"}, {"game_number": 2, "result": "闲"}, {"game_number": 3, "result": "和"}],
                    mode="new_boot",
                    balance_mode="keep",
                    run_deep_learning=False,
                )
                await s.commit()
                state = await get_or_create_state(s)

            return seed, res, state.status

        seed, res, status = asyncio.run(_run())
        self.assertTrue(seed["success"])
        self.assertTrue(res["success"])
        self.assertEqual(res["boot_number"], seed["boot_number"] + 1)
        self.assertNotEqual(status, "深度学习中")

    def test_game_number_over_72_rejected_by_validation(self):
        from app.api.routes.schemas import UploadRequest

        with self.assertRaises(ValidationError):
            UploadRequest.model_validate({
                "games": [{"game_number": 73, "result": "庄"}],
                "mode": "reset_current_boot",
                "balance_mode": "keep",
            })

    def test_new_boot_default_no_learning(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.services.game.upload import upload_games
            from app.services.game.state import get_or_create_state

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
                res = await upload_games(
                    db=s,
                    games=[{"game_number": 1, "result": "庄"}, {"game_number": 2, "result": "闲"}, {"game_number": 3, "result": "和"}],
                    mode="new_boot",
                    balance_mode="keep",
                )
                await s.commit()
                state = await get_or_create_state(s)

            return seed, res, state.status

        seed, res, status = asyncio.run(_run())
        self.assertTrue(seed["success"])
        self.assertTrue(res["success"])
        self.assertEqual(res["boot_number"], seed["boot_number"] + 1)
        self.assertNotEqual(status, "深度学习中")


if __name__ == "__main__":
    unittest.main()
