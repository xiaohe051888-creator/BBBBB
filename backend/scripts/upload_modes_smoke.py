import asyncio
import os
from pathlib import Path


async def main() -> None:
    db_path = Path("/tmp/baccarat_upload_modes_test.db")
    if db_path.exists():
        db_path.unlink()

    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path}"
    os.environ["DEBUG"] = "false"

    from app.core.database import init_db, async_session
    from app.services.game.session import clear_session, get_session
    from app.services.game.upload import upload_games
    from sqlalchemy import select
    from app.models.schemas import GameRecord

    await init_db()

    clear_session()
    sess = get_session()
    if sess.boot_number != 1:
        raise RuntimeError("session boot_number init mismatch")

    async with async_session() as db:
        r1 = await upload_games(
            db=db,
            games=[
                {"game_number": 1, "result": "庄"},
                {"game_number": 2, "result": "闲"},
                {"game_number": 3, "result": "和"},
            ],
            mode="reset_current_boot",
            balance_mode="keep",
        )
        if not r1.get("success"):
            raise RuntimeError(f"reset_current_boot failed: {r1}")
        if r1.get("boot_number") != 1:
            raise RuntimeError(f"reset_current_boot boot_number mismatch: {r1}")

    async with async_session() as db:
        rows = (await db.execute(select(GameRecord).where(GameRecord.boot_number == 1))).scalars().all()
        if len(rows) != 3:
            raise RuntimeError(f"expected 3 records for boot=1, got {len(rows)}")

    async with async_session() as db:
        r2 = await upload_games(
            db=db,
            games=[
                {"game_number": 1, "result": "庄"},
                {"game_number": 2, "result": "庄"},
            ],
            mode="new_boot",
            balance_mode="reset_default",
            run_deep_learning=False,
        )
        if not r2.get("success"):
            raise RuntimeError(f"new_boot failed: {r2}")
        if r2.get("boot_number") != 2:
            raise RuntimeError(f"new_boot boot_number mismatch: {r2}")

    clear_session()
    sess = get_session()
    sess.status = "深度学习中"
    sess.deep_learning_status = {"boot_number": 2, "status": "AI分析", "progress": 40}

    async with async_session() as db:
        r3 = await upload_games(
            db=db,
            games=[
                {"game_number": 1, "result": "闲"},
                {"game_number": 2, "result": "闲"},
            ],
            mode="new_boot",
            balance_mode="keep",
            run_deep_learning=True,
        )
        if not r3.get("success"):
            raise RuntimeError(f"queue new_boot during deep learning failed: {r3}")
        if "队列" not in (r3.get("message") or ""):
            raise RuntimeError(f"expected queue message, got: {r3}")

    if not sess.deep_learning_status.get("pending_upload"):
        raise RuntimeError("pending_upload not set on session")

    print("OK")


if __name__ == "__main__":
    asyncio.run(main())
