"""
游戏相关路由
"""
import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Query, HTTPException, Depends

from app.core.config import settings
from app.core.database import async_session
from app.models.schemas import GameRecord
from sqlalchemy import select, func

from app.api.routes.schemas import UploadRequest, RevealRequest, RetrySingleAiAnalysisRequest
from app.api.routes.utils import get_current_user

router = APIRouter(prefix="/api/games", tags=["游戏"])
logger = logging.getLogger(__name__)


def _clear_runtime_prediction_snapshot(sess, state) -> None:
    sess.predict_direction = None
    sess.predict_confidence = None
    sess.predict_bet_tier = None
    sess.predict_bet_amount = None
    sess.banker_summary = None
    sess.player_summary = None
    sess.combined_summary = None
    sess.combined_reasoning_points = None
    sess.combined_reasoning_detail = None
    sess.analysis_outcome = None
    sess.analysis_engine = None
    sess.analysis_time = None

    state.predict_direction = None
    state.predict_confidence = None
    state.current_bet_tier = "标准"


def _followup_analysis_timeout_seconds(prediction_mode: str | None = None) -> float:
    if prediction_mode == "single_ai":
        return 120.0
    configured = float(getattr(settings, "ANALYSIS_TASK_TIMEOUT_SECONDS", 0) or 0)
    if configured > 0:
        return configured
    return float(max(settings.MODEL_TIMEOUT + 15, 45))


def _sync_analysis_cycle(sess, state, cycle: dict | None) -> None:
    sess.analysis_cycle = cycle
    if cycle is None:
        state.analysis_cycle_status = None
        state.analysis_cycle_stage = None
        state.analysis_cycle_attempt = None
        state.analysis_cycle_started_at = None
        state.analysis_cycle_deadline_at = None
        state.analysis_failure_code = None
        state.analysis_failure_message = None
        state.analysis_retryable = False
        return

    state.analysis_cycle_status = cycle.get("status")
    state.analysis_cycle_stage = cycle.get("stage")
    state.analysis_cycle_attempt = cycle.get("attempt")
    started_at = cycle.get("started_at")
    deadline_at = cycle.get("deadline_at")
    parsed_started = datetime.fromisoformat(started_at) if started_at else None
    parsed_deadline = datetime.fromisoformat(deadline_at) if deadline_at else None
    if parsed_started and parsed_started.tzinfo is not None:
        parsed_started = parsed_started.astimezone(UTC).replace(tzinfo=None)
    if parsed_deadline and parsed_deadline.tzinfo is not None:
        parsed_deadline = parsed_deadline.astimezone(UTC).replace(tzinfo=None)
    state.analysis_cycle_started_at = parsed_started
    state.analysis_cycle_deadline_at = parsed_deadline
    state.analysis_failure_code = cycle.get("failure_code")
    state.analysis_failure_message = cycle.get("failure_message")
    state.analysis_retryable = bool(cycle.get("retryable"))


def _build_single_ai_analysis_cycle(attempt: int, timeout_seconds: float) -> dict:
    started_at = datetime.now(UTC).replace(tzinfo=None)
    deadline_at = started_at + timedelta(seconds=timeout_seconds)
    return {
        "status": "running",
        "stage": "数据归集",
        "attempt": attempt,
        "started_at": started_at.isoformat(),
        "deadline_at": deadline_at.isoformat(),
        "retryable": False,
        "failure_code": None,
        "failure_message": None,
    }


def _single_ai_timeout_user_message(timeout_seconds: float) -> str:
    return "本轮满血分析在 120 秒内没有完成，因此当前还没有形成有效预测结果。"


def _classify_single_ai_failure(reason: str, timeout_seconds: float) -> tuple[str, str]:
    message = (reason or "").strip()
    lower = message.lower()
    if "缺少必须字段" in message or "不完整" in message:
        return (
            "response_incomplete",
            "这次分析已经返回内容，但结果不完整，系统无法把它当成有效预测结果。",
        )
    if "预测方向无效" in message or "方向无法识别" in message:
        return (
            "invalid_direction",
            "这次分析返回了内容，但没有形成可识别的庄闲方向，因此当前无法生成有效预测结果。",
        )
    if "timeout" in lower or "超时" in message:
        return (
            "timeout",
            _single_ai_timeout_user_message(timeout_seconds),
        )
    if any(token in lower for token in ("connection", "connect", "503", "502", "429", "service unavailable")):
        return (
            "service_unavailable",
            "这次满血分析在请求过程中遇到服务波动，因此当前还没有拿到稳定结果。",
        )
    return ("unknown", "这次满血分析暂时没有拿到稳定结果，因此当前还没有形成有效预测结果。")


async def _mark_single_ai_cycle_failed(
    *,
    boot_number: int,
    failure_description: str,
    diagnostic_message: str,
    failure_code: str,
    user_message: str,
) -> None:
    from app.services.game.logging import write_game_log
    from app.services.game.session import get_session, broadcast_event
    from app.services.game.state import get_or_create_state

    sess = get_session()
    async with async_session() as log_session:
        state = await get_or_create_state(log_session)
        _clear_runtime_prediction_snapshot(sess, state)
        sess.status = "等待开奖"
        state.status = "等待开奖"
        cycle = dict(sess.analysis_cycle or {})
        cycle.update(
            {
                "status": "failed",
                "stage": "结果校验",
                "retryable": True,
                "failure_code": failure_code,
                "failure_message": user_message,
            }
        )
        _sync_analysis_cycle(sess, state, cycle)
        await write_game_log(
            log_session,
            boot_number,
            sess.next_game_number if not failure_description.startswith("上传") else 0,
            "LOG-SYS-ERR" if failure_description.startswith("上传") else "LOG-MDL-004",
            "AI分析报错" if failure_description.startswith("上传") else "单AI满血分析未完成",
            "失败",
            user_message[:500] if not failure_description.startswith("上传") else diagnostic_message[:500],
            category="系统异常" if not failure_description.startswith("上传") else "工作流事件",
            priority="P1",
        )
        await log_session.commit()

    await broadcast_event(
        "state_update",
        {
            "status": "等待开奖",
            "predict_direction": None,
            "predict_confidence": None,
            "current_bet_tier": "标准",
            "pending_bet": None,
            "analysis_cycle": cycle,
        },
    )

def _upload_error_to_http_exception(upload_result: dict) -> HTTPException:
    from app.utils.errors import error_message
    from app.utils.errors import error_message
    if upload_result.get("error") == "illegal_state":
        return HTTPException(409, upload_result.get("message") or "当前状态不允许该操作")
    code = upload_result.get("error")
    return HTTPException(400, upload_result.get("message") or (error_message(code) if code else "上传失败"))


def _reveal_error_to_http_exception(reveal_result: dict) -> HTTPException:
    from app.utils.errors import error_message
    if reveal_result.get("error") == "illegal_state":
        return HTTPException(409, reveal_result.get("message") or "当前状态不允许该操作")
    code = reveal_result.get("error")
    return HTTPException(400, reveal_result.get("message") or (error_message(code) if code else "开奖失败"))


async def _finalize_analysis_cycle(final_status: str = "等待开奖") -> None:
    from app.services.game.session import get_session, broadcast_event

    sess = get_session()
    if sess.status != "分析中":
        return

    sess.status = final_status
    try:
        async with async_session() as final_session:
            from app.services.game.state import get_or_create_state
            state = await get_or_create_state(final_session)
            state.status = final_status
            await final_session.commit()
        await broadcast_event("state_update", {"status": final_status})
    except Exception:
        logger.exception("同步最终状态/广播失败")


async def _run_single_ai_rule_fallback(
    boot_number: int,
    diagnostic_message: str,
) -> bool:
    from app.services.game.analysis import run_ai_analysis as run_rule_analysis
    from app.services.game.betting import place_bet
    from app.services.game.logging import write_game_log
    from app.services.game.session import get_session

    sess = get_session()
    if sess.prediction_mode != "single_ai":
        return False

    original_mode = sess.prediction_mode
    try:
        sess.prediction_mode = "rule"
        async with async_session() as session:
            res = await run_rule_analysis(
                db=session,
                boot_number=boot_number,
            )
            if not res or not res.get("success"):
                raise RuntimeError((res or {}).get("error") or "rule fallback failed")

            prediction = res.get("prediction")
            if prediction not in ("庄", "闲"):
                logger.warning(
                    "规则兜底返回了非法方向 '%s'，系统强制使用默认方向 '庄'",
                    prediction,
                )
                prediction = "庄"

            analysis_outcome = res.get("analysis_outcome") or {}
            technical_diagnostic = analysis_outcome.get("technical_diagnostic") or {}
            analysis_outcome["technical_diagnostic"] = {
                "code": technical_diagnostic.get("code"),
                "message": diagnostic_message[:200],
            }
            analysis_outcome["fallback_reason"] = (
                analysis_outcome.get("fallback_reason")
                or "本局单AI没有返回稳定结果，系统改用规则判断继续下注。"
            )
            res["analysis_outcome"] = analysis_outcome
            sess.analysis_outcome = analysis_outcome

            sess.prediction_mode = original_mode

            bet_result = await place_bet(
                db=session,
                game_number=res["game_number"],
                direction=prediction,
                amount=res.get("bet_amount", 100),
            )
            if not bet_result.get("success"):
                raise RuntimeError(
                    bet_result.get("message")
                    or bet_result.get("error")
                    or "rule fallback bet failed"
                )

            await write_game_log(
                session,
                boot_number,
                res["game_number"],
                "LOG-MDL-003",
                "规则兜底接管",
                "成功",
                f"单AI失败后已切换规则兜底继续下注：{diagnostic_message[:200]}",
                category="工作流事件",
                priority="P1",
            )
            await session.commit()
            return True
    finally:
        sess.prediction_mode = original_mode


async def _run_followup_analysis(
    boot_number: int,
    failure_description: str,
    single_ai_attempt: int | None = None,
) -> None:
    from app.services.game import run_ai_analysis
    from app.services.game.session import get_session

    sess = get_session()
    prediction_mode = sess.prediction_mode
    if prediction_mode == "single_ai":
        from app.services.game.state import get_or_create_state

        timeout_seconds = _followup_analysis_timeout_seconds(prediction_mode)
        if single_ai_attempt is not None:
            attempt = single_ai_attempt
        else:
            previous_cycle = dict(sess.analysis_cycle or {})
            if previous_cycle.get("status") == "running" and previous_cycle.get("attempt"):
                attempt = int(previous_cycle.get("attempt") or 0)
            elif previous_cycle.get("status") == "failed" and previous_cycle.get("retryable"):
                attempt = int(previous_cycle.get("attempt") or 0) + 1
            else:
                attempt = 1
        cycle = _build_single_ai_analysis_cycle(attempt, timeout_seconds)
        async with async_session() as cycle_session:
            state = await get_or_create_state(cycle_session)
            _sync_analysis_cycle(sess, state, cycle)
            await cycle_session.commit()

    try:
        async def _run_cycle() -> None:
            async with async_session() as session:
                if prediction_mode == "single_ai":
                    from app.services.game.state import get_or_create_state

                    state = await get_or_create_state(session)
                    running_cycle = dict(sess.analysis_cycle or {})
                    running_cycle["stage"] = "满血研判"
                    _sync_analysis_cycle(sess, state, running_cycle)
                res = await run_ai_analysis(
                    db=session,
                    boot_number=boot_number,
                )
                if not res or not res.get("success"):
                    raise RuntimeError((res or {}).get("reason") or (res or {}).get("error") or "analysis returned no result")

                prediction = res.get("prediction")
                if prediction not in ("庄", "闲"):
                    logging.getLogger(__name__).warning(
                        "AI 返回了非法的下注方向 '%s'，系统强制接管并兜底下注 '庄'",
                        prediction,
                    )
                    prediction = "庄"

                from app.services.game.betting import place_bet
                await place_bet(
                    db=session,
                    game_number=res["game_number"],
                    direction=prediction,
                    amount=res.get("bet_amount", 100),
                )
                if prediction_mode == "single_ai":
                    from app.services.game.state import get_or_create_state

                    state = await get_or_create_state(session)
                    succeeded_cycle = dict(sess.analysis_cycle or {})
                    succeeded_cycle.update(
                        {
                            "status": "succeeded",
                            "stage": "结论整理",
                            "retryable": False,
                            "failure_code": None,
                            "failure_message": None,
                        }
                    )
                    _sync_analysis_cycle(sess, state, succeeded_cycle)
                await session.commit()

        await asyncio.wait_for(_run_cycle(), timeout=_followup_analysis_timeout_seconds(prediction_mode))
    except asyncio.TimeoutError:
        timeout_seconds = _followup_analysis_timeout_seconds(prediction_mode)
        logging.getLogger("uvicorn.error").error(
            "%s: analysis timed out after %.2fs",
            failure_description,
            timeout_seconds,
        )
        diagnostic_message = f"{failure_description}: analysis timeout after {timeout_seconds:.2f}s"
        if prediction_mode == "single_ai":
            await _mark_single_ai_cycle_failed(
                boot_number=boot_number,
                failure_description=failure_description,
                diagnostic_message=diagnostic_message,
                failure_code="timeout",
                user_message=_single_ai_timeout_user_message(timeout_seconds),
            )
            return
        from app.services.game.logging import write_game_log
        from app.services.game.session import get_session, broadcast_event
        fallback_status = "错误" if failure_description.startswith("上传") else "空闲"
        try:
            async with async_session() as log_session:
                from app.services.game.state import get_or_create_state

                state = await get_or_create_state(log_session)
                _clear_runtime_prediction_snapshot(sess, state)
                sess.status = fallback_status
                state.status = fallback_status
                await write_game_log(
                    log_session,
                    boot_number,
                    sess.next_game_number if not failure_description.startswith("上传") else 0,
                    "LOG-SYS-ERR" if failure_description.startswith("上传") else "LOG-MDL-002",
                    "AI分析超时" if not failure_description.startswith("上传") else "AI分析报错",
                    "失败",
                    diagnostic_message,
                    category="系统异常" if not failure_description.startswith("上传") else "工作流事件",
                    priority="P1",
                )
                await log_session.commit()
            await broadcast_event(
                "state_update",
                {
                    "status": fallback_status,
                    "predict_direction": None,
                    "predict_confidence": None,
                    "current_bet_tier": "标准",
                    "pending_bet": None,
                },
            )
        except Exception:
            logger.exception("写入 AI 分析超时日志/广播失败")
    except Exception as e:
        logging.getLogger("uvicorn.error").error("%s: %s", failure_description, e, exc_info=True)
        diagnostic_message = f"{failure_description}: {str(e)}"
        if prediction_mode == "single_ai":
            timeout_seconds = _followup_analysis_timeout_seconds(prediction_mode)
            failure_code, user_message = _classify_single_ai_failure(str(e), timeout_seconds)
            await _mark_single_ai_cycle_failed(
                boot_number=boot_number,
                failure_description=failure_description,
                diagnostic_message=diagnostic_message,
                failure_code=failure_code,
                user_message=user_message,
            )
            return
        from app.services.game.logging import write_game_log
        from app.services.game.session import get_session, broadcast_event
        fallback_status = "错误" if failure_description.startswith("上传") else "空闲"
        try:
            async with async_session() as log_session:
                from app.services.game.state import get_or_create_state

                state = await get_or_create_state(log_session)
                _clear_runtime_prediction_snapshot(sess, state)
                sess.status = fallback_status
                state.status = fallback_status
                await write_game_log(
                    log_session,
                    boot_number,
                    sess.next_game_number if not failure_description.startswith("上传") else 0,
                    "LOG-SYS-ERR" if failure_description.startswith("上传") else "LOG-MDL-002",
                    "AI分析报错" if failure_description.startswith("上传") else "AI分析异常",
                    "失败",
                    diagnostic_message,
                    category="系统异常" if not failure_description.startswith("上传") else "工作流事件",
                    priority="P1",
                )
                await log_session.commit()
            await broadcast_event(
                "state_update",
                {
                    "status": fallback_status,
                    "predict_direction": None,
                    "predict_confidence": None,
                    "current_bet_tier": "标准",
                    "pending_bet": None,
                },
            )
        except Exception:
            logger.exception("写入 AI 分析异常日志/广播失败")
    finally:
        await _finalize_analysis_cycle("等待开奖")


@router.post("/analysis/retry")
async def retry_single_ai_analysis(
    req: RetrySingleAiAnalysisRequest,
    _: dict = Depends(get_current_user),
):
    from app.services.game.session import get_session, start_background_task
    from app.services.game.state import get_or_create_state
    from app.services.game.logging import write_game_log

    sess = get_session()
    if sess.prediction_mode != "single_ai":
        raise HTTPException(409, "当前不是单AI模式，不能重新分析")
    if sess.boot_number != req.boot_number:
        raise HTTPException(409, "当前靴号已变化，请刷新后重试")
    if sess.next_game_number != req.game_number:
        raise HTTPException(409, "当前局号已变化，请刷新后重试")

    current_cycle = dict(sess.analysis_cycle or {})
    if current_cycle.get("status") == "running":
        raise HTTPException(409, "当前已经有一轮满血分析正在进行中")
    if current_cycle.get("status") != "failed" or not current_cycle.get("retryable"):
        raise HTTPException(409, "当前这局还不能重新分析")

    timeout_seconds = _followup_analysis_timeout_seconds("single_ai")
    retry_cycle = _build_single_ai_analysis_cycle(
        attempt=int(current_cycle.get("attempt") or 0) + 1,
        timeout_seconds=timeout_seconds,
    )
    async with async_session() as session:
        state = await get_or_create_state(session)
        _sync_analysis_cycle(sess, state, retry_cycle)
        await write_game_log(
            session,
            req.boot_number,
            req.game_number,
            "LOG-MDL-005",
            "用户手动重新发起单AI分析",
            "开始",
            "用户点击“重新分析”后，系统已开始新一轮 120 秒满血分析。",
            category="工作流事件",
            priority="P2",
        )
        await session.commit()

    async def _trigger_retry_analysis():
        await _run_followup_analysis(
            req.boot_number,
            "用户手动重新发起单AI分析",
            single_ai_attempt=int(retry_cycle.get("attempt") or 1),
        )

    start_background_task(
        "analysis",
        _trigger_retry_analysis(),
        boot_number=req.boot_number,
        dedupe_key=f"analysis:{req.boot_number}:retry:{req.game_number}",
    )
    return {
        "success": True,
        "message": "已开始新一轮满血分析",
    }


@router.post("/upload")
async def upload_game_results(req: UploadRequest, _: dict = Depends(get_current_user)):
    """
    手动上传批量开奖记录（最多72局）
    上传后自动计算五路走势图，触发AI分析预测下一局
    """
    from app.services.game import upload_games, get_session

    effective_mode = req.mode
    if effective_mode is None:
        effective_mode = "reset_current_boot"

    sess = get_session()
    if sess.status == "深度学习中":
        raise HTTPException(403, f"第{sess.deep_learning_status.get('boot_number', '?')}靴深度学习进行中，请等待完成后再上传")

    async with async_session() as session:
        upload_result = await upload_games(
            db=session,
            games=[g.dict() for g in req.games],
            mode=effective_mode,
            balance_mode=req.balance_mode,
            run_deep_learning=False,
        )
    
    if not upload_result["success"]:
        raise _upload_error_to_http_exception(upload_result)
    
    # 异步触发AI分析（不阻塞上传响应）
    async def _trigger_analysis():
        await _run_followup_analysis(
            upload_result["boot_number"],
            "上传触发分析时发生系统错误",
        )

    from app.services.game.session import start_background_task
    start_background_task(
        "analysis",
        _trigger_analysis(),
        boot_number=upload_result["boot_number"],
        dedupe_key=f"analysis:{upload_result['boot_number']}",
    )
    
    return {
        "success": True,
        "uploaded": upload_result["uploaded"],
        "boot_number": upload_result["boot_number"],
        "max_game_number": upload_result["max_game_number"],
        "next_game_number": upload_result["next_game_number"],
        "message": f"成功上传{upload_result['uploaded']}局数据，AI分析正在进行中...",
    }


@router.post("/reveal")
async def reveal_game_route(req: RevealRequest, _: dict = Depends(get_current_user)):
    """
    开奖 - 输入开奖结果，结算注单，走势图更新，触发下一局AI分析
    """
    from app.services.game import reveal_game as _reveal, get_session
    
    async with async_session() as session:
        result = await _reveal(
            db=session,
            game_number=req.game_number,
            result=req.result,
        )
    
    if not result["success"]:
        raise _reveal_error_to_http_exception(result)
    
    # 获取当前靴号，触发下一局AI分析
    sess = get_session()
    boot_number = sess.boot_number
    
    async def _trigger_next_analysis():
        await _run_followup_analysis(
            boot_number,
            "下一局AI分析失败(reveal)",
        )

    from app.services.game.session import start_background_task
    start_background_task(
        "analysis",
        _trigger_next_analysis(),
        boot_number=boot_number,
        dedupe_key=f"analysis:{boot_number}",
    )
    
    return {
        **result,
        "message": f"第{req.game_number}局开奖{req.result}，正在分析下一局...",
    }


@router.post("/end-boot")
async def end_current_boot(
    _: dict = Depends(get_current_user),
):
    """
    结束本靴 - 开始新靴（深度学习仅由管理员手动触发）
    """
    from app.services.game import end_boot

    async with async_session() as session:
        result = await end_boot(
            db=session,
        )
    
    if not result["success"]:
        raise HTTPException(400, result.get("error", "结束本靴失败"))
    
    return result


@router.get("/deep-learning-status")
async def get_deep_learning_status(_: dict = Depends(get_current_user)):
    """获取深度学习状态"""
    from app.services.game import get_session
    
    sess = get_session()
    
    return {
        "status": sess.status,
        "deep_learning": sess.deep_learning_status,
        "boot_number": sess.boot_number,
    }


@router.get("/current-state")
async def get_game_current_state(_: dict = Depends(get_current_user)):
    """获取当前游戏内存状态（等待开奖、预测结果等）"""
    from app.services.game import get_current_state
    return await get_current_state()


@router.get("")
async def get_game_records(
    boot_number: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("game_number", pattern="^(game_number|profit_loss|bet_amount)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    _: dict = Depends(get_current_user),
):
    """获取开奖记录（分页）"""
    async with async_session() as session:
        from app.services.game.state import get_session
        if boot_number is None:
            boot_number = get_session().boot_number

        query = select(GameRecord).where(GameRecord.boot_number == boot_number)

        order_col = getattr(GameRecord, sort_by, GameRecord.game_number)
        query = query.order_by(order_col.desc() if sort_order == "desc" else order_col.asc())
        
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await session.execute(count_query)
        total = total_result.scalar() or 0
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await session.execute(query)
        records = result.scalars().all()
        
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "data": [
                {
                    "game_number": r.game_number,
                    "result": r.result,
                    "result_time": r.result_time.isoformat() if r.result_time else None,
                    "predict_direction": r.predict_direction,
                    "predict_correct": r.predict_correct,
                    "error_id": r.error_id,
                    "settlement_status": r.settlement_status,
                    "profit_loss": r.profit_loss,
                    "balance_after": r.balance_after,
                }
                for r in records
            ],
        }
