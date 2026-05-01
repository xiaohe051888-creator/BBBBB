"""
游戏相关路由
"""
import asyncio
from typing import Optional
from fastapi import APIRouter, Query, HTTPException

from app.core.database import async_session
from app.models.schemas import GameRecord
from sqlalchemy import select, func

from app.api.routes.schemas import UploadRequest, RevealRequest

router = APIRouter(prefix="/api/games", tags=["游戏"])

def _upload_error_to_http_exception(upload_result: dict) -> HTTPException:
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


@router.post("/upload")
async def upload_game_results(req: UploadRequest):
    """
    手动上传批量开奖记录（最多72局）
    上传后自动计算五路走势图，触发AI分析预测下一局
    """
    from app.services.game import upload_games, run_ai_analysis, get_session

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
        try:
            async with async_session() as session:
                res = await run_ai_analysis(
                    db=session,
                    boot_number=upload_result["boot_number"],
                )
                if res and res.get("success"):
                    prediction = res.get("prediction")
                    # 强制每局必下：如果AI返回了“观望”等非庄闲结果，强制回退为默认下注（根据某种简单规则，这里简单退避为“庄”或基于历史的某种默认值）
                    # 为了保证全自动托管系统不中断，必须将异常结果清洗为合法的方向
                    if prediction not in ("庄", "闲"):
                        import logging
                        logging.getLogger(__name__).warning(f"AI 返回了非法的下注方向 '{prediction}'，系统强制接管并兜底下注 '庄'")
                        prediction = "庄"
                        
                    from app.services.game.betting import place_bet
                    await place_bet(
                        db=session,
                        game_number=res["game_number"],
                        direction=prediction,
                        amount=res.get("bet_amount", 100)
                    )
                    await session.commit()
        except Exception as e:
            import logging
            from app.services.game.logging import write_game_log
            from app.services.game.session import broadcast_event
            logging.getLogger("uvicorn.error").error(f"AI分析失败(upload): {e}", exc_info=True)
            try:
                from app.services.game.session import get_session
                from app.services.game.state import get_or_create_state
                sess = get_session()
                sess.status = "错误"
                async with async_session() as log_session:
                    state = await get_or_create_state(log_session)
                    state.status = "错误"
                    await log_session.commit()
                    await write_game_log(
                        log_session, upload_result["boot_number"], 0,
                        "LOG-SYS-ERR", "AI分析报错", "失败",
                        f"上传触发分析时发生系统错误: {str(e)}", priority="P1"
                    )
                await broadcast_event("state_update", {"status": "错误"})
            except Exception as inner_e:
                import logging
                logging.getLogger(__name__).error(f"处理分析错误时发生次生异常: {inner_e}", exc_info=True)
        finally:
            # 无论如何，确保状态机不会死锁在“分析中”
            from app.services.game.session import get_session, broadcast_event
            sess = get_session()
            if sess.status == "分析中":
                sess.status = "等待开奖"
                try:
                    async with async_session() as final_session:
                        from app.services.game.state import get_or_create_state
                        state = await get_or_create_state(final_session)
                        state.status = "等待开奖"
                        await final_session.commit()
                    await broadcast_event("state_update", {"status": "等待开奖"})
                except Exception as final_e:
                    import logging
                    logging.getLogger(__name__).error(f"清理状态机遇错: {final_e}", exc_info=True)

    from app.services.game.session import start_background_task
    start_background_task("analysis", _trigger_analysis())
    
    return {
        "success": True,
        "uploaded": upload_result["uploaded"],
        "boot_number": upload_result["boot_number"],
        "max_game_number": upload_result["max_game_number"],
        "next_game_number": upload_result["next_game_number"],
        "message": f"成功上传{upload_result['uploaded']}局数据，AI分析正在进行中...",
    }


@router.post("/reveal")
async def reveal_game_route(req: RevealRequest):
    """
    开奖 - 输入开奖结果，结算注单，走势图更新，触发下一局AI分析
    """
    from app.services.game import reveal_game as _reveal, run_ai_analysis, get_session
    
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
        try:
            async with async_session() as session:
                res = await run_ai_analysis(
                    db=session,
                    boot_number=boot_number,
                )
                if res and res.get("success"):
                    prediction = res.get("prediction")
                    # 强制每局必下兜底逻辑
                    if prediction not in ("庄", "闲"):
                        import logging
                        logging.getLogger(__name__).warning(f"AI 返回了非法的下注方向 '{prediction}'，系统强制接管并兜底下注 '庄'")
                        prediction = "庄"
                        
                    from app.services.game.betting import place_bet
                    await place_bet(
                        db=session,
                        game_number=res["game_number"],
                        direction=prediction,
                        amount=res.get("bet_amount", 100)
                    )
                    await session.commit()
        except Exception as e:
            import logging
            from app.services.game.logging import write_game_log
            from app.services.game.session import broadcast_event
            logging.getLogger("uvicorn.error").error(f"下一局AI分析失败(reveal): {e}", exc_info=True)
            sess.status = "等待开奖"
            try:
                async with async_session() as log_session:
                    from app.services.game.state import get_or_create_state
                    state = await get_or_create_state(log_session)
                    state.status = "等待开奖"
                    await write_game_log(
                        log_session, boot_number, sess.next_game_number,
                        "LOG-MDL-002", "AI分析异常", "失败",
                        f"触发下一局AI三模型分析失败: {str(e)}",
                        category="系统异常",
                        priority="P1"
                    )
                    await log_session.commit()
                await broadcast_event("state_update", {"status": "等待开奖"})
            except Exception:
                pass
        finally:
            from app.services.game.session import get_session, broadcast_event
            sess = get_session()
            if sess.status == "分析中":
                sess.status = "等待开奖"
                try:
                    async with async_session() as final_session:
                        from app.services.game.state import get_or_create_state
                        state = await get_or_create_state(final_session)
                        state.status = "等待开奖"
                        await final_session.commit()
                    await broadcast_event("state_update", {"status": "等待开奖"})
                except Exception:
                    pass

    from app.services.game.session import start_background_task
    start_background_task("analysis", _trigger_next_analysis())
    
    return {
        **result,
        "message": f"第{req.game_number}局开奖{req.result}，正在分析下一局...",
    }


@router.post("/end-boot")
async def end_current_boot(

):
    """
    结束本靴 - 触发深度学习，完成后才能开始新靴
    """
    from app.services.game import end_boot, get_session

    sess = get_session()
    if sess.prediction_mode not in ("ai", "single_ai"):
        raise HTTPException(400, "规则引擎模式下不需要深度学习")
    
    async with async_session() as session:
        result = await end_boot(
            db=session,
        )
    
    if not result["success"]:
        raise HTTPException(400, result.get("error", "结束本靴失败"))
    
    return result


@router.get("/deep-learning-status")
async def get_deep_learning_status():
    """获取深度学习状态"""
    from app.services.game import get_session
    
    sess = get_session()
    
    return {
        "status": sess.status,
        "deep_learning": sess.deep_learning_status,
        "boot_number": sess.boot_number,
    }


@router.get("/current-state")
async def get_game_current_state():
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
