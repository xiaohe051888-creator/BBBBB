"""
游戏上传模块 - 处理批量开奖记录上传
"""
from datetime import datetime
from typing import Dict, Any, Optional, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.config import settings
from app.models.schemas import GameRecord, BetRecord, MistakeBook, RoadMap, AIMemory
from .session import get_session, get_session_lock, broadcast_event
from .state import get_or_create_state
from .logging import write_game_log
from .state_machine import can_reset_current_boot
import copy

async def _reset_table_data(db: AsyncSession, boot_number: Optional[int] = None) -> None:
    """
    重置数据
    如果是新靴（boot_number is None），不删除历史数据，只开启新靴
    如果是覆盖当前靴（传入 boot_number），删除该靴的所有记录
    """
    if boot_number is not None:
        # 删除当前靴的游戏记录
        await db.execute(
            delete(GameRecord).where(GameRecord.boot_number == boot_number)
        )
        # 删除当前靴的下注记录
        await db.execute(
            delete(BetRecord).where(BetRecord.boot_number == boot_number)
        )
        # 删除当前靴的错题记录，避免幽灵血迹
        await db.execute(
            delete(MistakeBook).where(MistakeBook.boot_number == boot_number)
        )
        # 删除当前靴的五路图缓存
        await db.execute(
            delete(RoadMap).where(RoadMap.boot_number == boot_number)
        )
        # 删除当前靴的微学习记忆
        await db.execute(
            delete(AIMemory).where(AIMemory.boot_number == boot_number)
        )
        await db.flush()


async def _reset_session_state(keep_balance: bool = True) -> None:
    """
    重置会话状态 - 清理内存中的工作流状态，强制清场
    """
    lock = get_session_lock()
    if not lock.locked():
        raise RuntimeError("reset_session_state requires session_lock")
    sess = get_session()
    
    # 重置所有状态
    sess.status = "空闲"
    sess.predict_direction = None
    sess.predict_confidence = None
    sess.predict_bet_tier = None
    sess.predict_bet_amount = None
    
    # 清理待处理的下注
    sess.pending_bet_direction = None
    sess.pending_bet_amount = None
    sess.pending_bet_tier = None
    sess.pending_bet_time = None
    sess.pending_game_number = None
    
    # 重置统计
    if not keep_balance:
        sess.balance = settings.DEFAULT_BALANCE
    sess.consecutive_errors = 0
    
    # 清理AI分析缓存
    sess.banker_summary = None
    sess.player_summary = None
    sess.combined_summary = None
    sess.analysis_time = None
    sess.deep_learning_status = None


async def upload_games(
    db: AsyncSession,
    games: List[Dict[str, Any]],
    mode: Optional[str] = None,
    balance_mode: Optional[str] = None,
    run_deep_learning: Optional[bool] = None,
) -> Dict[str, Any]:
    """
    上传批量开奖记录
    """
    if len(games) > 72:
        return {"success": False, "error": "单次最多支持录入 72 局"}

    # 防满局校验：如果有任何一局的局号超过 72 局，直接拦截
    if any(g.get("game_number", 0) > 72 for g in games):
        return {"success": False, "error": "单靴最多支持 72 局，本靴已满，请新开一靴"}

    lock = get_session_lock()
    async with lock:
        sess = get_session()
        sess_backup = copy.deepcopy(sess)
        
        try:
            if not games:
                await write_game_log(
                    db, 0, None,
                    "LOG-VAL-001", "参数校验", "失败",
                    "批量上传失败：上传数据为空",
                    priority="P2",
                )
                await db.commit()
                return {"success": False, "error": "上传数据为空"}

            # 防跳局校验：上传的数据局号必须连续，且不能有空档
            sorted_games = sorted(games, key=lambda x: x["game_number"])
            
            # 校验传入的数组本身是否连续 (例如不能传 [1, 2, 4])
            for i in range(1, len(sorted_games)):
                if sorted_games[i]["game_number"] != sorted_games[i-1]["game_number"] + 1:
                    return {"success": False, "error": f"上传数据不连续，存在跳局（从局号 {sorted_games[i-1]['game_number']} 直接跳到了 {sorted_games[i]['game_number']}）"}
            
            # 校验是否与当前系统状态无缝衔接
            first_game_number = sorted_games[0]["game_number"]
            # 如果是新靴，或者重置本靴，都必须从第 1 局开始传
            if first_game_number != 1:
                return {"success": False, "error": f"上传数据必须从第 1 局开始，不能从第 {first_game_number} 局开始"}

            effective_mode = mode
            if effective_mode is None:
                effective_mode = "reset_current_boot"

            if effective_mode not in ("reset_current_boot", "new_boot"):
                return {"success": False, "error": f"非法 mode: {effective_mode}"}

            effective_balance_mode = balance_mode or "keep"
            if effective_balance_mode not in ("keep", "reset_default"):
                return {"success": False, "error": f"非法 balance_mode: {effective_balance_mode}"}

            ok, msg = can_reset_current_boot(sess.status)
            if not ok:
                return {"success": False, "error": "illegal_state", "message": msg}

            # 记录重置前的状态（用于日志）
            old_status = sess.status
            
            # 推断靴号：取现有最大靴号
            stmt = select(GameRecord.boot_number).order_by(GameRecord.boot_number.desc()).limit(1)
            result = await db.execute(stmt)
            existing_boot = result.scalar_one_or_none() or 0

            if effective_mode == "new_boot":
                boot_number = existing_boot + 1
                # 开启新靴，不需要清理上靴数据
                await _reset_table_data(db, boot_number=None)
            else:
                # 覆盖当前靴
                boot_number = existing_boot if existing_boot > 0 else 1
                # 清理当前靴数据，以便覆盖
                await _reset_table_data(db, boot_number=boot_number)
            
            # ========== 强力清场：重置会话状态 ==========
            # 清理内存中的工作流状态，终止所有进行中的操作
            await _reset_session_state(keep_balance=(effective_balance_mode == "keep"))
            
            sess.boot_number = boot_number
            
            uploaded = 0
            for g in games:
                game_number = g["game_number"]
                result_val = g.get("result", "")
                
                # 防御脏数据：拦截非法开奖结果
                if result_val not in ("庄", "闲", "和"):
                    return {"success": False, "error": f"第 {game_number} 局存在非法开奖结果 '{result_val}'，只能是庄、闲、和"}
                
                # 检查是否已存在（避免重复）
                stmt = select(GameRecord).where(
                    GameRecord.boot_number == boot_number,
                    GameRecord.game_number == game_number,
                )
                check = await db.execute(stmt)
                existing = check.scalar_one_or_none()
                
                if existing:
                    # 更新结果
                    existing.result = result_val
                    existing.result_time = datetime.now()
                else:
                    record = GameRecord(
                        boot_number=boot_number,
                        game_number=game_number,
                        result=result_val,
                        result_time=datetime.now(),
                    )
                    db.add(record)
                uploaded += 1
            
            await db.flush()
            
            # 计算下一局号
            max_game = max(g["game_number"] for g in games)
            sess.next_game_number = max_game + 1
            sess.status = "分析中"
            
            # 更新系统状态
            state = await get_or_create_state(db)
            state.status = "分析中"
            state.boot_number = boot_number
            state.game_number = max_game
            state.balance = sess.balance
            state.consecutive_errors = 0
            state.predict_direction = None
            state.predict_confidence = None
            state.current_bet_tier = "标准"
            
            # 记录重置日志
            action_type = "开启新靴" if effective_mode == "new_boot" else "覆盖本靴"
            if old_status != "空闲":
                await write_game_log(
                    db, boot_number, 0,
                    "LOG-SYS-003", "系统重置", "成功",
                    f"上传数据触发强力清场：原状态[{old_status}]已终止，执行[{action_type}]",
                    priority="P2",
                )
            
            await write_game_log(
                db, boot_number, None,
                "LOG-SYS-001", "数据上传", "成功",
                f"📥 成功同步 {len(games)} 局历史开奖记录",
                priority="P3",
            )
            
            await db.commit()
            
        except Exception as e:
            await db.rollback()
            import app.services.game.session as session_module
            session_module._session = sess_backup
            raise e
        
    # 广播状态更新
    await broadcast_event("state_update", {
        "status": "分析中",
        "boot_number": boot_number,
        "game_number": max_game,
        "uploaded": uploaded,
    })
    
    return {
        "success": True,
        "uploaded": uploaded,
        "boot_number": boot_number,
        "max_game_number": max_game,
        "next_game_number": sess.next_game_number,
    }
