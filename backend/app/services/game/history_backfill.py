"""
历史展示字段回补服务
"""
from __future__ import annotations

import re
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import BetRecord, GameRecord, SystemLog


PREDICTION_RE = re.compile(r"第(?P<game>\d+)局推理完成：预测【(?P<direction>庄|闲)】")
PROFIT_RE = re.compile(r"盈亏(?P<profit>[+-]?\d+(?:\.\d+)?)")


async def _load_target_games(
    db: AsyncSession,
    *,
    boot_number: int,
    limit_games: int | None = None,
) -> list[GameRecord]:
    stmt = (
        select(GameRecord)
        .where(GameRecord.boot_number == boot_number)
        .order_by(GameRecord.game_number.desc())
    )
    if limit_games and limit_games > 0:
        stmt = stmt.limit(limit_games)
    result = await db.execute(stmt)
    rows = list(result.scalars().all())
    rows.reverse()
    return rows


async def _load_bets_by_game(db: AsyncSession, *, boot_number: int) -> dict[int, BetRecord]:
    result = await db.execute(
        select(BetRecord)
        .where(BetRecord.boot_number == boot_number)
        .order_by(BetRecord.game_number.asc(), BetRecord.bet_seq.desc())
    )
    bets = result.scalars().all()
    by_game: dict[int, BetRecord] = {}
    for bet in bets:
        by_game.setdefault(bet.game_number, bet)
    return by_game


async def _load_logs_by_game(db: AsyncSession, *, boot_number: int) -> dict[int, list[SystemLog]]:
    result = await db.execute(
        select(SystemLog)
        .where(SystemLog.boot_number == boot_number, SystemLog.game_number.is_not(None))
        .order_by(SystemLog.game_number.asc(), SystemLog.log_time.asc(), SystemLog.id.asc())
    )
    rows = result.scalars().all()
    by_game: dict[int, list[SystemLog]] = {}
    for row in rows:
        if row.game_number is None:
            continue
        by_game.setdefault(int(row.game_number), []).append(row)
    return by_game


def _extract_from_logs(logs: list[SystemLog]) -> dict[str, Any]:
    patch: dict[str, Any] = {}
    for log in logs:
        text = log.description or ""
        prediction = PREDICTION_RE.search(text)
        if prediction:
            patch.setdefault("predict_direction", prediction.group("direction"))
        profit = PROFIT_RE.search(text)
        if profit:
            patch.setdefault("profit_loss", Decimal(profit.group("profit")))
        if "规则兜底" in text:
            patch.setdefault("prediction_mode", "rule")
        if "单AI" in text or "AI对第" in text:
            patch.setdefault("prediction_mode", patch.get("prediction_mode") or "single_ai")
        if "已开奖" in text or "注单结算" in text:
            patch.setdefault("settlement_status", "已结算")
    return patch


def _to_decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _build_patch(*, game: GameRecord, bet: BetRecord | None, logs: list[SystemLog]) -> tuple[dict[str, Any], bool]:
    patch: dict[str, Any] = {}
    conflicts = False

    if bet:
        bet_direction = getattr(bet, "bet_direction", None)
        if bet_direction:
            patch["predict_direction"] = bet_direction
        if getattr(bet, "status", None) == "已结算":
            patch["settlement_status"] = "已结算"
        profit_loss = _to_decimal(getattr(bet, "profit_loss", None))
        if profit_loss is not None:
            patch["profit_loss"] = profit_loss
        balance_after = _to_decimal(getattr(bet, "balance_after", None))
        if balance_after is not None:
            patch["balance_after"] = balance_after
        prediction_mode = getattr(bet, "prediction_mode", None)
        if prediction_mode:
            patch["prediction_mode"] = prediction_mode

    log_patch = _extract_from_logs(logs)
    if (
        patch.get("predict_direction")
        and log_patch.get("predict_direction")
        and patch["predict_direction"] != log_patch["predict_direction"]
    ):
        conflicts = True
    else:
        patch.update({k: v for k, v in log_patch.items() if k not in patch})

    predict_direction = patch.get("predict_direction") or getattr(game, "predict_direction", None)
    game_result = getattr(game, "result", None)
    if predict_direction and game_result in ("庄", "闲"):
        patch["predict_correct"] = predict_direction == game_result

    if not patch:
        return {}, conflicts

    final_patch: dict[str, Any] = {}
    for field, value in patch.items():
        current = getattr(game, field, None)
        if field == "profit_loss":
            current = _to_decimal(current)
            value = _to_decimal(value)
            if current in (None, Decimal("0"), Decimal("0.0"), Decimal("0.00")) and value is not None:
                final_patch[field] = value
            continue
        if current is None and value is not None:
            final_patch[field] = value
    return final_patch, conflicts


def _apply_patch(game: GameRecord, patch: dict[str, Any]) -> None:
    for field, value in patch.items():
        setattr(game, field, value)


async def backfill_history_for_boot(
    db: AsyncSession,
    boot_number: int,
    limit_games: int | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    target_games = await _load_target_games(db, boot_number=boot_number, limit_games=limit_games)
    bets = await _load_bets_by_game(db, boot_number=boot_number)
    logs = await _load_logs_by_game(db, boot_number=boot_number)

    updated = 0
    skipped = 0
    conflicts = 0
    updated_game_numbers: list[int] = []

    for game in target_games:
        patch, has_conflict = _build_patch(
            game=game,
            bet=bets.get(game.game_number),
            logs=logs.get(game.game_number, []),
        )
        if has_conflict:
            conflicts += 1
            continue
        if not patch:
            skipped += 1
            continue
        if not dry_run:
            _apply_patch(game, patch)
        updated += 1
        updated_game_numbers.append(game.game_number)

    return {
        "boot_number": boot_number,
        "scanned_games": len(target_games),
        "updated_games": updated,
        "updated_game_numbers": updated_game_numbers,
        "skipped_games": skipped,
        "conflicts": conflicts,
        "dry_run": dry_run,
    }

