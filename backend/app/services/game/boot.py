"""
靴管理模块 - 结束本靴和深度学习
"""
import asyncio
from datetime import datetime
from typing import Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.schemas import GameRecord, MistakeBook, AIMemory
from .session import get_session, get_session_lock, broadcast_event
from .state import get_or_create_state
from .logging import write_game_log
from app.core.database import async_session
from app.core.config import settings
import copy

async def end_boot(
    db: AsyncSession,
) -> Dict[str, Any]:
    """
    结束本靴 - 仅切换到新靴（深度学习仅由管理员手动触发）
    """
    lock = get_session_lock()
    async with lock:
        sess = get_session()
        sess_backup = copy.deepcopy(sess)
        
        try:
            # 检查是否有待开奖注单
            if sess.pending_bet_direction is not None:
                return {
                    "success": False,
                    "error": f"第{sess.pending_game_number}局还有待开奖注单，请先开奖",
                }
            
            current_boot = sess.boot_number
            stmt = select(GameRecord.boot_number).order_by(GameRecord.boot_number.desc()).limit(1)
            result = await db.execute(stmt)
            existing_boot = result.scalar_one_or_none() or 0
            next_boot = max(current_boot, existing_boot) + 1

            await db.execute(delete(MistakeBook))
            await db.execute(delete(AIMemory))

            sess.boot_number = next_boot
            sess.next_game_number = 1
            sess.status = "空闲"
            sess.deep_learning_status = None
            sess.consecutive_errors = 0
            sess.predict_direction = None
            sess.predict_confidence = None
            sess.predict_bet_tier = None
            sess.predict_bet_amount = None
            sess.banker_summary = None
            sess.player_summary = None
            sess.combined_summary = None
            
            # 更新系统状态
            state = await get_or_create_state(db)
            state.status = "空闲"
            state.boot_number = next_boot
            state.game_number = 0
            state.consecutive_errors = 0
            state.predict_direction = None
            state.predict_confidence = None
            state.current_bet_tier = "标准"
            
            await write_game_log(
                db, current_boot, None,
                "LOG-BOOT-001", "结束本靴", "开始新靴",
                f"第{current_boot}靴结束，开始第{next_boot}靴",
                category="系统事件",
                priority="P1",
            )
            
            await db.commit()
        except Exception as e:
            await db.rollback()
            import app.services.game.session as session_module
            session_module._session = sess_backup
            raise e

    await broadcast_event("state_update", {
        "status": "空闲",
        "boot_number": next_boot,
        "game_number": 0,
    })

    return {
        "success": True,
        "boot_number": next_boot,
        "status": "空闲",
        "message": f"已开始第{next_boot}靴",
    }


async def run_deep_learning(
    boot_number: int,
    prediction_mode: str,
):
    """
    执行深度学习 - 带进度推送
    """
    from app.services.game.session import get_session, get_session_lock
    sess = get_session()
    lock = get_session_lock()
    
    try:
        async with async_session() as db:
            from app.services.ai_learning_service import AILearningService
            
            # 更新进度：数据准备
            async with lock:
                sess.deep_learning_status["status"] = "数据准备"
                sess.deep_learning_status["progress"] = 10
                sess.deep_learning_status["message"] = "正在收集训练数据..."
            
            await broadcast_event("deep_learning_progress", {
                "boot_number": boot_number,
                "status": "数据准备",
                "progress": 10,
                "message": "正在收集训练数据...",
            })
            
            await asyncio.sleep(1)  # 模拟处理时间
            
            # 更新进度：AI分析
            async with lock:
                sess.deep_learning_status["status"] = "AI分析"
                sess.deep_learning_status["progress"] = 30
                sess.deep_learning_status["message"] = "AI正在深度分析错误模式..."
            
            await broadcast_event("deep_learning_progress", {
                "boot_number": boot_number,
                "status": "AI分析",
                "progress": 30,
                "message": "AI正在深度分析错误模式...",
            })
            
            # 执行实际学习
            ai_learning = AILearningService(db)
            
            # 更新进度：AI分析中
            async with lock:
                sess.deep_learning_status["status"] = "AI分析"
                sess.deep_learning_status["progress"] = 40
                sess.deep_learning_status["message"] = "AI正在深度分析错误模式..."
            
            await broadcast_event("deep_learning_progress", {
                "boot_number": boot_number,
                "status": "AI分析",
                "progress": 40,
                "message": "AI正在深度分析错误模式...",
            })
            
            # 调用真正的AI深度学习
            result = await ai_learning.start_learning(boot_number, prediction_mode=prediction_mode)
            
            if not result.success:
                raise Exception(result.error or "深度学习失败")
            
            # 更新进度：生成新版本
            async with lock:
                sess.deep_learning_status["status"] = "生成版本"
                sess.deep_learning_status["progress"] = 80
                sess.deep_learning_status["message"] = f"正在生成新版本 {result.version}..."
            
            await broadcast_event("deep_learning_progress", {
                "boot_number": boot_number,
                "status": "生成版本",
                "progress": 80,
                "message": f"新版本 {result.version} 生成中...",
                "version": result.version,
            })
            
            # 更新进度：完成
            async with lock:
                sess.deep_learning_status["status"] = "完成"
                sess.deep_learning_status["progress"] = 100
                sess.deep_learning_status["message"] = "深度学习完成，新版本已生成"
                
                # 设置状态为等待新靴
                sess.status = "等待新靴"
                
                # 清空预测缓存
                sess.predict_direction = None
                sess.predict_confidence = None
                sess.predict_bet_tier = None
                sess.predict_bet_amount = None
                sess.banker_summary = None
                sess.player_summary = None
                sess.combined_summary = None
            
            await broadcast_event("deep_learning_completed", {
                "boot_number": boot_number,
                "status": "完成",
                "progress": 100,
                "message": "深度学习完成，可以开始新靴了",
            })
            
            await write_game_log(
                db, boot_number, None,
                "LOG-BOOT-002", "深度学习", "完成",
                f"第{boot_number}靴深度学习完成",
                category="AI事件",
                priority="P1",
            )
            
            state = await get_or_create_state(db)
            state.status = "等待新靴"
            state.predict_direction = None
            state.predict_confidence = None
            state.current_bet_tier = "标准"

            pending_upload = None
            async with lock:
                if sess.deep_learning_status:
                    pending_upload = sess.deep_learning_status.get("pending_upload")
                    if pending_upload:
                        sess.deep_learning_status.pop("pending_upload", None)

            if pending_upload:
                from sqlalchemy import delete
                from app.models.schemas import GameRecord, BetRecord, MistakeBook, RoadMap, AIMemory
                next_boot = boot_number + 1

                await db.execute(delete(GameRecord).where(GameRecord.boot_number == next_boot))
                await db.execute(delete(BetRecord).where(BetRecord.boot_number == next_boot))
                await db.execute(delete(MistakeBook).where(MistakeBook.boot_number == next_boot))
                await db.execute(delete(RoadMap).where(RoadMap.boot_number == next_boot))
                await db.execute(delete(AIMemory).where(AIMemory.boot_number == next_boot))

                games = pending_upload.get("games") or []
                uploaded = 0
                for g in games:
                    game_number = g.get("game_number")
                    result_val = g.get("result")
                    if not game_number or result_val not in ("庄", "闲", "和"):
                        continue
                    db.add(GameRecord(
                        boot_number=next_boot,
                        game_number=game_number,
                        result=result_val,
                        result_time=datetime.now(),
                    ))
                    uploaded += 1

                max_game = max((g.get("game_number") or 0) for g in games) if games else 0

                balance_mode = pending_upload.get("balance_mode") or "keep"
                async with lock:
                    sess.boot_number = next_boot
                    sess.next_game_number = max_game + 1
                    sess.status = "分析中"
                    if balance_mode == "reset_default":
                        sess.balance = settings.DEFAULT_BALANCE
                    sess.consecutive_errors = 0
                    sess.predict_direction = None
                    sess.predict_confidence = None
                    sess.predict_bet_tier = None
                    sess.predict_bet_amount = None
                    sess.banker_summary = None
                    sess.player_summary = None
                    sess.combined_summary = None

                state.status = "分析中"
                state.boot_number = next_boot
                state.game_number = max_game
                state.balance = sess.balance
                state.consecutive_errors = 0
                state.predict_direction = None
                state.predict_confidence = None
                state.current_bet_tier = "标准"
            
            # 自动清理历史垃圾数据，防止无限膨胀
            try:
                from sqlalchemy import delete
                from app.models.schemas import AIMemory, SystemLog, GameRecord, BetRecord, MistakeBook, RoadMap
                from datetime import datetime, timedelta
                
                # 1. 换靴才清空微学习：仅保留当前这靴的微学习记忆，彻底删除之前所有靴的记忆
                await db.execute(delete(AIMemory).where(AIMemory.boot_number < boot_number))
                
                # 2. 清理 30 天前的常规日志
                thirty_days_ago = datetime.now() - timedelta(days=30)
                await db.execute(delete(SystemLog).where(SystemLog.log_time < thirty_days_ago))
                
                # 3. 保留最近 10 靴的游戏记录数据，防止超出 AI 1000局学习上限
                keep_boot_threshold = max(1, boot_number - 10)
                await db.execute(delete(GameRecord).where(GameRecord.boot_number < keep_boot_threshold))
                await db.execute(delete(BetRecord).where(BetRecord.boot_number < keep_boot_threshold))
                await db.execute(delete(MistakeBook).where(MistakeBook.boot_number < keep_boot_threshold))
                await db.execute(delete(RoadMap).where(RoadMap.boot_number < keep_boot_threshold))
                
            except Exception as clean_err:
                import logging
                logging.getLogger(__name__).warning(f"数据清理任务失败: {clean_err}")
            
            await db.commit()

            if pending_upload:
                await broadcast_event("state_update", {
                    "status": "分析中",
                    "boot_number": next_boot,
                    "game_number": max_game,
                    "uploaded": uploaded,
                })

                from app.services.game.session import add_background_task
                from app.core.database import async_session as _async_session
                from app.services.game import run_ai_analysis
                from app.services.game.session import broadcast_event as _broadcast_event

                async def _trigger_next_boot_analysis():
                    try:
                        async with _async_session() as session2:
                            res2 = await run_ai_analysis(db=session2, boot_number=next_boot)
                            if res2 and res2.get("success"):
                                prediction = res2.get("prediction")
                                if prediction not in ("庄", "闲"):
                                    prediction = "庄"
                                from app.services.game.betting import place_bet
                                await place_bet(
                                    db=session2,
                                    game_number=res2["game_number"],
                                    direction=prediction,
                                    amount=res2.get("bet_amount", 100),
                                )
                                await session2.commit()
                    except Exception as e2:
                        import logging
                        logging.getLogger("uvicorn.error").error(f"下一靴AI分析失败(auto-upload): {e2}", exc_info=True)
                        try:
                            await _broadcast_event("state_update", {"status": "错误"})
                        except Exception:
                            pass

                from app.services.game.session import start_background_task
                start_background_task("analysis", _trigger_next_boot_analysis())
    except asyncio.CancelledError:
        async def _cleanup_on_cancel() -> None:
            async with lock:
                if sess.deep_learning_status is None:
                    sess.deep_learning_status = {"boot_number": boot_number}
                sess.deep_learning_status["status"] = "已取消"
                sess.deep_learning_status["progress"] = 0
                sess.deep_learning_status["message"] = "深度学习已取消"
                sess.status = "等待新靴"

            try:
                await broadcast_event("deep_learning_cancelled", {
                    "boot_number": boot_number,
                    "status": "已取消",
                    "message": "深度学习已取消，可以手动重新启动或直接开新靴",
                })
            except Exception:
                pass

            async with async_session() as db:
                state = await get_or_create_state(db)
                state.status = "等待新靴"
                await write_game_log(
                    db, boot_number, None,
                    "LOG-BOOT-004", "深度学习", "取消",
                    f"第{boot_number}靴深度学习已取消",
                    category="AI事件",
                    priority="P1",
                )
                await db.commit()

        try:
            await asyncio.shield(_cleanup_on_cancel())
        except Exception:
            pass
        raise
    except Exception as e:
        async with lock:
            sess.deep_learning_status["status"] = "失败"
            sess.deep_learning_status["message"] = f"深度学习失败: {str(e)}"
            sess.status = "空闲"
        
        await broadcast_event("deep_learning_failed", {
            "boot_number": boot_number,
            "status": "失败",
            "error": str(e),
        })
        
        async with async_session() as db:
            state = await get_or_create_state(db)
            state.status = "空闲"
            await write_game_log(
                db, boot_number, None,
                "LOG-BOOT-003", "深度学习", "失败",
                f"第{boot_number}靴深度学习失败: {str(e)}",
                category="AI事件",
                priority="P0",
            )
            await db.commit()
