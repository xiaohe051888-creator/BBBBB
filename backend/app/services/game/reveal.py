"""
开奖模块 - 处理开奖、结算、错题记录
"""
from datetime import datetime
from typing import Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import copy

from app.models.schemas import GameRecord, BetRecord, MistakeBook
from .session import get_session, get_session_lock, broadcast_event
from .state import get_or_create_state
from .logging import write_game_log


async def reveal_game(
    db: AsyncSession,
    game_number: int,
    result: str,
) -> Dict[str, Any]:
    """
    开奖 - 输入结果，结算注单，更新走势，触发下一局分析
    """
    lock = get_session_lock()
    async with lock:
        sess = get_session()
        sess_backup = copy.deepcopy(sess)
        
        try:
            if game_number > 72:
                return {"success": False, "error": "单靴最多支持 72 局，本靴已结束，请新开一靴"}

            if result not in ("庄", "闲", "和"):
                await write_game_log(
                    db, sess.boot_number, game_number,
                    "LOG-VAL-002", "参数校验", "失败",
                    f"开奖失败：无效的结果'{result}'，只能是庄、闲、和",
                    priority="P2",
                )
                await db.commit()
                return {"success": False, "error": "开奖结果只能是：庄、闲、和"}
            
            # 写入或更新开奖记录
            # 加 with_for_update 防止并发修改同一条记录
            stmt = select(GameRecord).where(
                GameRecord.boot_number == sess.boot_number,
                GameRecord.game_number == game_number,
            ).with_for_update()
            db_result = await db.execute(stmt)
            game_record = db_result.scalar_one_or_none()
            
            if not game_record:
                game_record = GameRecord(
                    boot_number=sess.boot_number,
                    game_number=game_number,
                    result=result,
                    result_time=datetime.now(),
                )
                db.add(game_record)
            else:
                game_record.result = result
                game_record.result_time = datetime.now()
            
            # 预测是否正确
            predict_correct = None
            if sess.predict_direction:
                if result == "和":
                    predict_correct = None  # 和局不算
                else:
                    predict_correct = (sess.predict_direction == result)
            
            game_record.predict_direction = sess.predict_direction
            game_record.predict_correct = predict_correct
            
            # 结算注单
            settlement_info = await _settle_bet(db, game_number, result, sess)
            
            # 更新下一局号
            sess.next_game_number = game_number + 1
            sess.status = "分析中"
            
            # 更新系统状态
            state = await get_or_create_state(db)
            state.status = "分析中"
            state.game_number = game_number
            state.current_game_result = result
            state.balance = sess.balance
            state.consecutive_errors = sess.consecutive_errors
            
            # UX增强：详细日志
            pred_msg = f"，AI曾预测: {sess.predict_direction}" if sess.predict_direction else "，AI无预测"
            correct_msg = " (正确)✅" if predict_correct is True else (" (错误)❌" if predict_correct is False else "")
            
            await write_game_log(
                db, sess.boot_number, game_number,
                "LOG-MNL-002", "开奖", "成功",
                f"第{game_number}局已开奖：【{result}】{pred_msg}{correct_msg}",
                priority="P2",
            )
            
            await db.commit()
            
        except Exception as e:
            await db.rollback()
            # 回滚内存状态
            import app.services.game.session as session_module
            session_module._session = sess_backup
            raise e
        
    # 准备五路数据
    from app.services.road_engine import UnifiedRoadEngine
    road_engine = UnifiedRoadEngine()
    roads_result = await road_engine.get_all_roads(sess.boot_number)
    
    # 序列化路牌数据为JSON可传输格式
    def road_to_dict(road):
        return {
            "display_name": road.display_name,
            "max_columns": road.max_columns,
            "max_rows": road.max_rows,
            "points": [
                {
                    "game_number": p.game_number,
                    "column": p.column,
                    "row": p.row,
                    "value": p.value,
                    "is_new_column": p.is_new_column,
                    "error_id": str(p.error_id) if p.error_id is not None else None,
                    "has_tie": getattr(p, 'has_tie', False),
                    "is_tie": getattr(p, 'is_tie', False),
                }
                for p in road.points
            ],
        }
    
    roads_data = {
        "大路": road_to_dict(roads_result["big_road"]),
        "珠盘路": road_to_dict(roads_result["bead_road"]),
        "大眼仔路": road_to_dict(roads_result["big_eye"]),
        "小路": road_to_dict(roads_result["small_road"]),
        "螳螂路": road_to_dict(roads_result["cockroach_road"]),
    }
    
    # 广播开奖结果
    await broadcast_event("game_revealed", {
        "game_number": game_number,
        "result": result,
        "predict_direction": sess.predict_direction,
        "predict_correct": predict_correct,
        "settlement": settlement_info,
        "balance": sess.balance,
        "next_game_number": sess.next_game_number,
        "roads": roads_data,
    })
    
    return {
        "success": True,
        "game_number": game_number,
        "result": result,
        "predict_direction": sess.predict_direction,
        "predict_correct": predict_correct,
        "settlement": settlement_info,
        "balance": sess.balance,
        "next_game_number": sess.next_game_number,
    }


async def _settle_bet(
    db: AsyncSession,
    game_number: int,
    result: str,
    sess,
) -> Dict[str, Any]:
    """结算注单"""
    settlement_info = {}
    
    if sess.pending_bet_direction is not None and sess.pending_game_number == game_number:
        from app.services.betting_service import BettingService
        
        betting_svc = BettingService()
        betting_svc.set_balance(sess.balance)
        
        settle = betting_svc.settle_bet(
            bet_direction=sess.pending_bet_direction,
            bet_amount=sess.pending_bet_amount,
            game_result=result,
        )
        
        sess.balance = betting_svc.get_balance()
        
        # 更新下注记录
        stmt2 = select(BetRecord).where(
            BetRecord.boot_number == sess.boot_number,
            BetRecord.game_number == game_number,
            BetRecord.status == "待开奖",
        ).order_by(BetRecord.id.desc()).limit(1).with_for_update()
        bet_result_db = await db.execute(stmt2)
        bet_record = bet_result_db.scalar_one_or_none()
        
        if bet_record:
            bet_record.status = settle["status"]
            bet_record.game_result = result
            bet_record.settlement_amount = settle["settlement_amount"]
            bet_record.profit_loss = settle["profit_loss"]
            bet_record.balance_after = sess.balance
            bet_record.settle_time = datetime.now()
        
        # 更新游戏记录
        stmt = select(GameRecord).where(
            GameRecord.boot_number == sess.boot_number,
            GameRecord.game_number == game_number,
        )
        db_result = await db.execute(stmt)
        game_record = db_result.scalar_one_or_none()
        if game_record:
            game_record.settlement_status = settle["status"]
            game_record.profit_loss = settle["profit_loss"]
            game_record.balance_after = sess.balance
        
        settlement_info = settle
        
        # 更新连续错误计数和错题本
        if result != "和":
            if sess.predict_direction and sess.predict_direction == result:
                sess.consecutive_errors = 0
            else:
                sess.consecutive_errors += 1
                # 错题本记录
                if sess.consecutive_errors >= 1:
                    mistake = MistakeBook(
                        boot_number=sess.boot_number,
                        game_number=game_number,
                        error_id=f"ERR-B{sess.boot_number}G{game_number}",
                        error_type="趋势误判",
                        predict_direction=sess.predict_direction or "",
                        actual_result=result,
                        banker_summary=sess.banker_summary,
                        player_summary=sess.player_summary,
                        combined_summary=sess.combined_summary,
                        confidence=sess.predict_confidence,
                        analysis=f"预测{sess.predict_direction}，实际开{result}，连续失准{sess.consecutive_errors}次",
                    )
                    db.add(mistake)
        
        await write_game_log(
            db, sess.boot_number, game_number,
            "LOG-STL-001", "结算", settle["status"],
            f"第{game_number}局开{result}，注单结算：{settle['reason']}，盈亏{settle['profit_loss']:+.0f}，余额{sess.balance:.0f}",
            category="资金事件",
            priority="P2" if (sess.predict_direction and sess.predict_direction == result) else "P1",
        )
        
        # 清除待开奖信息
        sess.pending_bet_direction = None
        sess.pending_bet_amount = None
        sess.pending_bet_tier = None
        sess.pending_bet_time = None
        sess.pending_game_number = None
    
    return settlement_info
