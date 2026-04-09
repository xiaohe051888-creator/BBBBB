"""
手动游戏管理服务 - 百家乐分析预测系统
替代原WorkflowEngine，管理手动上传→AI预测→下注→开奖→结算的完整流程
"""
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any, Callable, List
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.config import settings
from app.models.schemas import (
    GameRecord, BetRecord, SystemState, SystemLog, MistakeBook
)


@dataclass
class ManualSession:
    """手动游戏会话 - 内存态，每桌一个实例"""
    table_id: str
    boot_number: int = 1
    next_game_number: int = 1           # 下一局的局号（等待开奖的局号）
    status: str = "空闲"               # 空闲/分析中/等待开奖/等待下注
    
    # 预测结果
    predict_direction: Optional[str] = None
    predict_confidence: Optional[float] = None
    predict_bet_tier: Optional[str] = None
    predict_bet_amount: Optional[float] = None
    
    # 待开奖的下注信息
    pending_bet_direction: Optional[str] = None
    pending_bet_amount: Optional[float] = None
    pending_bet_tier: Optional[str] = None
    pending_bet_time: Optional[datetime] = None
    pending_game_number: Optional[int] = None   # 等待开奖的局号
    
    # 统计
    balance: float = field(default_factory=lambda: settings.DEFAULT_BALANCE)
    consecutive_errors: int = 0
    
    # AI分析结果缓存
    banker_summary: Optional[str] = None
    player_summary: Optional[str] = None
    combined_summary: Optional[str] = None
    analysis_time: Optional[datetime] = None
    

# 全局会话管理器
_sessions: Dict[str, ManualSession] = {}
# WebSocket广播函数（由main.py注入）
_broadcast_func: Optional[Callable] = None


def get_session(table_id: str) -> ManualSession:
    """获取或创建桌子的会话"""
    if table_id not in _sessions:
        _sessions[table_id] = ManualSession(table_id=table_id)
    return _sessions[table_id]


def set_broadcast_func(func: Callable):
    """注入WebSocket广播函数"""
    global _broadcast_func
    _broadcast_func = func


async def _broadcast(table_id: str, event_type: str, data: Dict):
    """广播事件到WebSocket"""
    if _broadcast_func:
        await _broadcast_func(table_id, event_type, data)


async def _write_log(
    session: AsyncSession,
    table_id: str,
    boot_number: int,
    game_number: Optional[int],
    event_code: str,
    event_type: str,
    event_result: str,
    description: str,
    category: str = "工作流事件",
    priority: str = "P3",
    source_module: str = "ManualGameService",
) -> SystemLog:
    """写入系统日志并广播到WebSocket"""
    log = SystemLog(
        log_time=datetime.now(),
        table_id=table_id,
        boot_number=boot_number,
        game_number=game_number,
        event_code=event_code,
        event_type=event_type,
        event_result=event_result,
        description=description,
        category=category,
        priority=priority,
        source_module=source_module,
    )
    session.add(log)
    
    # 立即刷新以获取ID
    await session.flush()
    
    # 广播日志到WebSocket（实时推送）
    await _broadcast(table_id, "log", {
        "id": log.id,
        "log_time": log.log_time.isoformat() if log.log_time else None,
        "game_number": log.game_number,
        "event_code": log.event_code,
        "event_type": log.event_type,
        "event_result": log.event_result,
        "description": log.description,
        "category": log.category,
        "priority": log.priority,
        "is_pinned": log.is_pinned,
    })
    
    return log


async def _get_or_create_state(db: AsyncSession, table_id: str) -> SystemState:
    """获取或创建系统状态记录"""
    stmt = select(SystemState).where(SystemState.table_id == table_id)
    result = await db.execute(stmt)
    state = result.scalar_one_or_none()
    
    if not state:
        state = SystemState(
            table_id=table_id,
            status="手动模式",
            balance=settings.DEFAULT_BALANCE,
            boot_number=1,
            game_number=0,
        )
        db.add(state)
        await db.flush()
    
    return state


async def upload_games(
    db: AsyncSession,
    table_id: str,
    games: List[Dict[str, Any]],
    boot_number: Optional[int] = None,
) -> Dict[str, Any]:
    """
    上传批量开奖记录
    
    Args:
        games: [{game_number: int, result: "庄"/"闲"/"和"}, ...]
        boot_number: 靴号，None则自动推断
    
    Returns:
        {"success": True, "uploaded": N, "boot_number": X, "next_game_number": Y}
    """
    sess = get_session(table_id)
    
    if not games:
        return {"success": False, "error": "上传数据为空"}
    
    # 推断靴号：取现有最大靴号，或使用传入值
    if boot_number is None:
        stmt = select(GameRecord.boot_number).where(
            GameRecord.table_id == table_id
        ).order_by(GameRecord.boot_number.desc()).limit(1)
        result = await db.execute(stmt)
        existing_boot = result.scalar_one_or_none()
        boot_number = (existing_boot or 0) + 1
    
    sess.boot_number = boot_number
    
    uploaded = 0
    for g in games:
        game_number = g["game_number"]
        result_val = g["result"]
        
        # 检查是否已存在（避免重复）
        stmt = select(GameRecord).where(
            GameRecord.table_id == table_id,
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
                table_id=table_id,
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
    state = await _get_or_create_state(db, table_id)
    state.status = "分析中"
    state.boot_number = boot_number
    state.game_number = max_game
    state.balance = sess.balance
    
    await _write_log(
        db, table_id, boot_number, max_game,
        "LOG-MNL-001", "批量上传", "成功",
        f"上传第{games[0]['game_number']}~{max_game}局共{uploaded}条记录，靴号{boot_number}",
        priority="P2",
    )
    
    await db.commit()
    
    # 广播状态更新
    await _broadcast(table_id, "state_update", {
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


async def run_ai_analysis(
    db: AsyncSession,
    table_id: str,
    boot_number: int,
) -> Dict[str, Any]:
    """
    触发AI三模型分析预测下一局
    
    Returns:
        {"success": True, "predict": "庄"/"闲", "confidence": 0.72, "bet_amount": 100, "tier": "标准"}
    """
    from app.services.three_model_service import ThreeModelService
    from app.services.road_engine import UnifiedRoadEngine
    
    sess = get_session(table_id)
    sess.status = "分析中"
    
    # 获取该靴的所有历史记录
    stmt = select(GameRecord).where(
        GameRecord.table_id == table_id,
        GameRecord.boot_number == boot_number,
    ).order_by(GameRecord.game_number)
    result = await db.execute(stmt)
    records = result.scalars().all()
    
    if not records:
        return {"success": False, "error": "无历史数据可供分析"}
    
    # 构建五路走势供AI参考
    engine = UnifiedRoadEngine()
    for r in records:
        if r.result in ("庄", "闲"):
            engine.process_game(r.game_number, r.result)
    five_roads = engine.calculate_all_roads()
    
    # 构建历史序列文本
    history_text = "".join(r.result for r in records)
    total_banker = history_text.count("庄")
    total_player = history_text.count("闲")
    total_tie = history_text.count("和")
    
    road_summary = (
        f"共{len(records)}局：庄{total_banker}次，闲{total_player}次，和{total_tie}次。\n"
        f"最近10局：{''.join(r.result for r in records[-10:])}\n"
        f"大路走势（前20点）：{str(five_roads.big_road.points[:20])}"
    )
    
    # 获取错题本
    stmt2 = select(MistakeBook).where(
        MistakeBook.table_id == table_id,
        MistakeBook.boot_number == boot_number,
    ).order_by(MistakeBook.game_number.desc()).limit(5)
    mb_result = await db.execute(stmt2)
    mistakes = mb_result.scalars().all()
    mistake_text = "\n".join(
        f"第{m.game_number}局预测{m.predict_direction}实际{m.actual_result}，错因：{m.analysis or '未分析'}"
        for m in mistakes
    ) or "暂无错题记录"
    
    # 获取当前模型版本信息
    from app.models.schemas import ModelVersion
    stmt3 = select(ModelVersion).where(ModelVersion.is_active == True).limit(1)
    mv_result = await db.execute(stmt3)
    model_version = mv_result.scalar_one_or_none()
    version_stability = model_version.stability_score if model_version else 0.7
    
    # 调用AI三模型
    try:
        svc = ThreeModelService()
        ai_result = await svc.analyze(
            history_text=history_text,
            road_summary=road_summary,
            mistake_book=mistake_text,
            game_number=sess.next_game_number,
        )
        
        predict_direction = ai_result.get("prediction", "庄")
        confidence = ai_result.get("confidence", 0.6)
        banker_summary = ai_result.get("banker_summary", "")
        player_summary = ai_result.get("player_summary", "")
        combined_summary = ai_result.get("combined_summary", "")
        
    except Exception as e:
        # AI失败时记录错误但不降级
        await _write_log(
            db, table_id, boot_number, sess.next_game_number,
            "LOG-AI-ERR", "AI分析异常", f"失败：{str(e)[:80]}",
            f"AI三模型分析失败，错误：{str(e)[:200]}",
            priority="P1",
        )
        await db.commit()
        return {"success": False, "error": f"AI分析失败：{str(e)[:100]}"}
    
    # 计算自适应下注
    from app.services.betting_service import BettingService
    betting_svc = BettingService()
    betting_svc.set_balance(sess.balance)
    
    bet_result = betting_svc.calculate_adaptive_bet(
        confidence=confidence,
        consecutive_correct=0,
        consecutive_errors=sess.consecutive_errors,
        current_drawdown=max(0, (settings.DEFAULT_BALANCE - sess.balance) / settings.DEFAULT_BALANCE),
        version_stability=version_stability or 0.7,
    )
    
    # 缓存预测结果
    sess.predict_direction = predict_direction
    sess.predict_confidence = confidence
    sess.predict_bet_tier = bet_result.bet_tier
    sess.predict_bet_amount = bet_result.bet_amount
    sess.banker_summary = banker_summary
    sess.player_summary = player_summary
    sess.combined_summary = combined_summary
    sess.analysis_time = datetime.now()
    sess.status = "等待下注"
    
    # 更新系统状态
    state = await _get_or_create_state(db, table_id)
    state.status = "等待下注"
    state.predict_direction = predict_direction
    state.predict_confidence = confidence
    state.current_bet_tier = bet_result.bet_tier
    
    # 写入AI分析日志
    await _write_log(
        db, table_id, boot_number, sess.next_game_number,
        "LOG-MDL-001", "庄模型分析", "完成",
        banker_summary or "庄向证据已分析",
    )
    await _write_log(
        db, table_id, boot_number, sess.next_game_number,
        "LOG-MDL-002", "闲模型分析", "完成",
        player_summary or "闲向证据已分析",
    )
    await _write_log(
        db, table_id, boot_number, sess.next_game_number,
        "LOG-MDL-003", "综合预测", f"预测{predict_direction}，置信度{confidence:.0%}",
        combined_summary or f"综合模型预测第{sess.next_game_number}局为{predict_direction}，置信度{confidence:.0%}，建议{bet_result.bet_tier}档下注{bet_result.bet_amount:.0f}元",
        priority="P2",
    )
    
    await db.commit()
    
    # 广播分析完成
    await _broadcast(table_id, "analysis", {
        "predict_direction": predict_direction,
        "confidence": confidence,
        "bet_tier": bet_result.bet_tier,
        "bet_amount": bet_result.bet_amount,
        "banker_summary": banker_summary,
        "player_summary": player_summary,
        "combined_summary": combined_summary,
        "game_number": sess.next_game_number,
    })
    
    return {
        "success": True,
        "predict_direction": predict_direction,
        "confidence": confidence,
        "bet_tier": bet_result.bet_tier,
        "bet_amount": bet_result.bet_amount,
        "game_number": sess.next_game_number,
        "banker_summary": banker_summary,
        "player_summary": player_summary,
        "combined_summary": combined_summary,
    }


async def place_bet(
    db: AsyncSession,
    table_id: str,
    game_number: int,
    direction: str,
    amount: float,
) -> Dict[str, Any]:
    """
    下注
    
    Args:
        game_number: 下注局号
        direction: "庄" 或 "闲"
        amount: 下注金额
    """
    sess = get_session(table_id)
    
    if sess.pending_bet_direction is not None:
        return {"success": False, "error": f"第{sess.pending_game_number}局已有待开奖注单"}
    
    if direction not in ("庄", "闲"):
        return {"success": False, "error": "下注方向只能是庄或闲"}
    
    amount = float(amount)
    amount = max(settings.MIN_BET, min(settings.MAX_BET, int(amount / settings.BET_STEP) * settings.BET_STEP))
    
    if amount > sess.balance:
        return {"success": False, "error": f"余额不足，当前余额{sess.balance:.0f}，下注{amount:.0f}"}
    
    # 扣款
    balance_before = sess.balance
    sess.balance -= amount
    balance_after = sess.balance
    
    tier = sess.predict_bet_tier or "标准"
    
    # 写入下注记录
    bet = BetRecord(
        table_id=table_id,
        boot_number=sess.boot_number,
        game_number=game_number,
        bet_direction=direction,
        bet_amount=amount,
        bet_tier=tier,
        status="待开奖",
        balance_before=balance_before,
        balance_after=balance_after,
        bet_time=datetime.now(),
        adapt_summary=f"AI预测{sess.predict_direction}，置信{sess.predict_confidence or 0:.0%}，{tier}档",
    )
    db.add(bet)
    
    # 记录待开奖信息到会话
    sess.pending_bet_direction = direction
    sess.pending_bet_amount = amount
    sess.pending_bet_tier = tier
    sess.pending_bet_time = datetime.now()
    sess.pending_game_number = game_number
    sess.status = "等待开奖"
    
    # 更新系统状态
    state = await _get_or_create_state(db, table_id)
    state.status = "等待开奖"
    state.balance = balance_after
    
    await _write_log(
        db, table_id, sess.boot_number, game_number,
        "LOG-BET-001", "下注", f"已下注{direction}{amount:.0f}元",
        f"第{game_number}局下注{direction}{amount:.0f}元（{tier}档），余额{balance_before:.0f}→{balance_after:.0f}",
        category="资金事件",
        priority="P2",
    )
    
    await db.commit()
    
    await _broadcast(table_id, "bet_placed", {
        "game_number": game_number,
        "direction": direction,
        "amount": amount,
        "tier": tier,
        "balance_after": balance_after,
        "status": "等待开奖",
    })
    
    return {
        "success": True,
        "game_number": game_number,
        "direction": direction,
        "amount": amount,
        "tier": tier,
        "balance_before": balance_before,
        "balance_after": balance_after,
    }


async def reveal_game(
    db: AsyncSession,
    table_id: str,
    game_number: int,
    result: str,
) -> Dict[str, Any]:
    """
    开奖 - 输入结果，结算注单，更新走势，触发下一局分析
    
    Args:
        game_number: 开奖局号
        result: "庄"/"闲"/"和"
    """
    sess = get_session(table_id)
    
    if result not in ("庄", "闲", "和"):
        return {"success": False, "error": "开奖结果只能是：庄、闲、和"}
    
    # 写入或更新开奖记录
    stmt = select(GameRecord).where(
        GameRecord.table_id == table_id,
        GameRecord.boot_number == sess.boot_number,
        GameRecord.game_number == game_number,
    )
    db_result = await db.execute(stmt)
    game_record = db_result.scalar_one_or_none()
    
    if not game_record:
        game_record = GameRecord(
            table_id=table_id,
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
            BetRecord.table_id == table_id,
            BetRecord.boot_number == sess.boot_number,
            BetRecord.game_number == game_number,
            BetRecord.status == "待开奖",
        ).order_by(BetRecord.id.desc()).limit(1)
        bet_result_db = await db.execute(stmt2)
        bet_record = bet_result_db.scalar_one_or_none()
        
        if bet_record:
            bet_record.status = settle["status"]
            bet_record.game_result = result
            bet_record.settlement_amount = settle["settlement_amount"]
            bet_record.profit_loss = settle["profit_loss"]
            bet_record.balance_after = sess.balance
            bet_record.settle_time = datetime.now()
        
        game_record.settlement_status = settle["status"]
        game_record.profit_loss = settle["profit_loss"]
        game_record.balance_after = sess.balance
        
        settlement_info = settle
        
        # 更新连续错误计数
        if result != "和":
            if predict_correct:
                sess.consecutive_errors = 0
            else:
                sess.consecutive_errors += 1
                # 错题本记录
                if sess.consecutive_errors >= 1:
                    mistake = MistakeBook(
                        table_id=table_id,
                        boot_number=sess.boot_number,
                        game_number=game_number,
                        error_id=f"ERR-{table_id}-B{sess.boot_number}G{game_number}",
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
        
        await _write_log(
            db, table_id, sess.boot_number, game_number,
            "LOG-STL-001", "结算", settle["status"],
            f"第{game_number}局开{result}，注单结算：{settle['reason']}，盈亏{settle['profit_loss']:+.0f}，余额{sess.balance:.0f}",
            category="资金事件",
            priority="P2" if predict_correct else "P1",
        )
        
        # 清除待开奖信息
        sess.pending_bet_direction = None
        sess.pending_bet_amount = None
        sess.pending_bet_tier = None
        sess.pending_bet_time = None
        sess.pending_game_number = None
    
    # 更新下一局号
    sess.next_game_number = game_number + 1
    sess.status = "分析中"
    
    # 更新系统状态
    state = await _get_or_create_state(db, table_id)
    state.status = "分析中"
    state.game_number = game_number
    state.current_game_result = result
    state.balance = sess.balance
    state.consecutive_errors = sess.consecutive_errors
    
    await _write_log(
        db, table_id, sess.boot_number, game_number,
        "LOG-MNL-002", "开奖", f"第{game_number}局开{result}",
        f"第{game_number}局开奖结果：{result}，预测{'正确✓' if predict_correct else '错误✗' if predict_correct is False else '和局'}",
        priority="P2",
    )
    
    await db.commit()
    
    await _broadcast(table_id, "game_revealed", {
        "game_number": game_number,
        "result": result,
        "predict_direction": sess.predict_direction,
        "predict_correct": predict_correct,
        "settlement": settlement_info,
        "balance": sess.balance,
        "next_game_number": sess.next_game_number,
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


async def get_current_state(table_id: str) -> Dict[str, Any]:
    """获取当前手动游戏状态（内存态）"""
    sess = get_session(table_id)
    return {
        "table_id": table_id,
        "status": sess.status,
        "boot_number": sess.boot_number,
        "next_game_number": sess.next_game_number,
        "predict_direction": sess.predict_direction,
        "predict_confidence": sess.predict_confidence,
        "predict_bet_tier": sess.predict_bet_tier,
        "predict_bet_amount": sess.predict_bet_amount,
        "pending_bet": {
            "direction": sess.pending_bet_direction,
            "amount": sess.pending_bet_amount,
            "tier": sess.pending_bet_tier,
            "game_number": sess.pending_game_number,
            "time": sess.pending_bet_time.isoformat() if sess.pending_bet_time else None,
        } if sess.pending_bet_direction else None,
        "balance": sess.balance,
        "consecutive_errors": sess.consecutive_errors,
        "analysis": {
            "banker_summary": sess.banker_summary,
            "player_summary": sess.player_summary,
            "combined_summary": sess.combined_summary,
            "time": sess.analysis_time.isoformat() if sess.analysis_time else None,
        } if sess.banker_summary else None,
    }


async def sync_balance_from_db(db: AsyncSession, table_id: str):
    """从数据库同步余额到内存会话（重启后恢复）"""
    stmt = select(SystemState).where(SystemState.table_id == table_id)
    result = await db.execute(stmt)
    state = result.scalar_one_or_none()
    
    if state:
        sess = get_session(table_id)
        sess.balance = state.balance
        sess.boot_number = state.boot_number or 1
        sess.consecutive_errors = state.consecutive_errors or 0
        
        # 恢复下一局号
        stmt2 = select(GameRecord.game_number).where(
            GameRecord.table_id == table_id,
            GameRecord.boot_number == sess.boot_number,
        ).order_by(GameRecord.game_number.desc()).limit(1)
        r2 = await db.execute(stmt2)
        max_game = r2.scalar_one_or_none()
        if max_game:
            sess.next_game_number = max_game + 1
