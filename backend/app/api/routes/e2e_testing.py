from datetime import datetime
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete

from app.api.routes.utils import get_current_admin
from app.core.database import async_session
from app.models.schemas import BackgroundTask, BetRecord, GameRecord, MistakeBook, SystemLog
from app.services.game.state import get_or_create_state
from app.services.game.upload import upload_games


router = APIRouter(prefix="/api/admin/e2e", tags=["E2E测试"])


def _settings():
    from app.core.config import settings

    return settings


def _require_enabled():
    settings = _settings()
    if (not settings.E2E_TESTING) or (settings.ENVIRONMENT == "production"):
        raise HTTPException(status_code=404, detail="Not Found")


def require_e2e_enabled() -> None:
    _require_enabled()


class ResetReq(BaseModel):
    scope: Literal["all", "games", "bets", "logs", "tasks"] = "all"
    keep_balance: bool = True
    prediction_mode: Literal["rule", "single_ai", "ai"] = "rule"
    boot_number: int = 1


class SeedGamesReq(BaseModel):
    boot_number: int = 1
    count: int = Field(20, ge=1, le=72)
    pattern: Literal["alternate", "all_banker", "all_player", "with_ties"] = "alternate"
    prediction_mode: Literal["rule", "single_ai", "ai"] = "rule"


class SeedBetsReq(BaseModel):
    boot_number: int = 1
    game_number: int = Field(1, ge=1, le=72)
    count: int = Field(5, ge=1, le=20)
    amount: int = Field(100, ge=10, le=10000)
    direction: Literal["庄", "闲"] = "庄"


class SeedLogsReq(BaseModel):
    boot_number: int = 1
    game_number: int = 1
    count: int = Field(200, ge=1, le=5000)
    priority: Literal["P1", "P2", "P3"] = "P3"


class SeedMistakesReq(BaseModel):
    boot_number: int = 1
    count: int = Field(20, ge=1, le=200)
    prediction_mode: Literal["rule", "single_ai", "ai"] = "rule"


@router.post("/reset", dependencies=[Depends(require_e2e_enabled)])
async def e2e_reset(req: ResetReq, _: dict = Depends(get_current_admin)):
    async with async_session() as db:
        if req.scope in ("all", "games"):
            await db.execute(delete(GameRecord))
            await db.execute(delete(MistakeBook))
        if req.scope in ("all", "bets"):
            await db.execute(delete(BetRecord))
        if req.scope in ("all", "logs"):
            await db.execute(delete(SystemLog))
        if req.scope in ("all", "tasks"):
            await db.execute(delete(BackgroundTask))

        state = await get_or_create_state(db)
        state.boot_number = req.boot_number
        state.game_number = 0
        state.status = "空闲"
        state.prediction_mode = req.prediction_mode
        if not req.keep_balance:
            state.balance = _settings().DEFAULT_BALANCE

        await db.commit()
    return {"ok": True}


@router.post("/seed/games", dependencies=[Depends(require_e2e_enabled)])
async def e2e_seed_games(req: SeedGamesReq, _: dict = Depends(get_current_admin)):
    results = []
    for i in range(req.count):
        n = i + 1
        if req.pattern == "all_banker":
            r = "庄"
        elif req.pattern == "all_player":
            r = "闲"
        elif req.pattern == "with_ties" and n % 10 == 0:
            r = "和"
        else:
            r = "庄" if n % 2 == 1 else "闲"
        results.append({"game_number": n, "result": r})

    async with async_session() as db:
        await db.execute(delete(GameRecord).where(GameRecord.boot_number == req.boot_number))
        await db.execute(delete(BetRecord).where(BetRecord.boot_number == req.boot_number))
        await db.execute(delete(SystemLog).where(SystemLog.boot_number == req.boot_number))
        await db.commit()

        res = await upload_games(db, results, mode="reset_current_boot", balance_mode="keep", run_deep_learning=False)
        if not res.get("success", True):
            raise HTTPException(status_code=400, detail=res.get("error") or "seed failed")

        state = await get_or_create_state(db)
        state.prediction_mode = req.prediction_mode
        await db.commit()
    return {"ok": True, "boot_number": req.boot_number, "count": req.count}


@router.post("/seed/bets", dependencies=[Depends(require_e2e_enabled)])
async def e2e_seed_bets(req: SeedBetsReq, _: dict = Depends(get_current_admin)):
    async with async_session() as db:
        state = await get_or_create_state(db)
        balance = Decimal(str(state.balance))
        amount = Decimal(str(req.amount))

        for i in range(req.count):
            before = balance
            after = balance - amount
            r = BetRecord(
                boot_number=req.boot_number,
                game_number=req.game_number,
                bet_seq=i + 1,
                bet_direction=req.direction,
                bet_amount=amount,
                bet_tier="标准",
                status="待开奖",
                balance_before=before,
                balance_after=after,
                bet_time=datetime.now(),
            )
            db.add(r)
            balance = after

        state.balance = float(balance)
        await db.commit()
    return {"ok": True}


@router.post("/seed/logs", dependencies=[Depends(require_e2e_enabled)])
async def e2e_seed_logs(req: SeedLogsReq, _: dict = Depends(get_current_admin)):
    async with async_session() as db:
        now = datetime.now()
        for i in range(req.count):
            db.add(
                SystemLog(
                    log_time=now,
                    boot_number=req.boot_number,
                    game_number=req.game_number,
                    event_code="LOG-E2E-000",
                    event_type="E2E造数",
                    event_result="ok",
                    description=f"seed {i + 1}",
                    category="E2E",
                    priority=req.priority,
                )
            )
        await db.commit()
    return {"ok": True}


@router.post("/seed/mistakes", dependencies=[Depends(require_e2e_enabled)])
async def e2e_seed_mistakes(req: SeedMistakesReq, _: dict = Depends(get_current_admin)):
    async with async_session() as db:
        await db.execute(delete(MistakeBook).where(MistakeBook.boot_number == req.boot_number))
        for i in range(req.count):
            game_number = i + 1
            db.add(
                MistakeBook(
                    boot_number=req.boot_number,
                    game_number=game_number,
                    prediction_mode=req.prediction_mode,
                    error_id=f"E2E-{req.boot_number}-{game_number}",
                    error_type="趋势误判" if game_number % 2 == 1 else "转折误判",
                    predict_direction="庄" if game_number % 2 == 1 else "闲",
                    actual_result="闲" if game_number % 2 == 1 else "庄",
                    confidence=0.8 if game_number % 2 == 1 else 0.62,
                    banker_summary="E2E 庄方向摘要",
                    player_summary="E2E 闲方向摘要",
                    combined_summary="E2E 综合摘要",
                    analysis=f"E2E 复盘原因 {game_number}",
                    correction=f"E2E 改进建议 {game_number}",
                )
            )
        await db.commit()
    return {"ok": True, "boot_number": req.boot_number, "count": req.count}
