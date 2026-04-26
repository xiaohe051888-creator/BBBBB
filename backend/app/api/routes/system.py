"""
系统状态路由
"""
from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy import select, func, desc
from datetime import datetime, timedelta

from app.core.database import async_session
from app.models.schemas import GameRecord, BetRecord, SystemLog, SystemState
from app.core.config import settings
from app.services.game import get_current_state, get_session
from app.api.routes.utils import get_current_user

router = APIRouter(
    prefix="/api/system", 
    tags=["系统状态"]
)

@router.get("/state")
async def get_system_state(_: dict = Depends(get_current_user)):
    """获取系统状态"""
    from app.services.game import get_current_state
    
    async with async_session() as session:
        stmt = select(SystemState)
        result = await session.execute(stmt)
        state = result.scalar_one_or_none()
        
        # 获取内存态（更实时）
        mem_state = await get_current_state()
        
        if not state:
            return {
                "status": mem_state["status"],
                "boot_number": mem_state["boot_number"],
                "game_number": mem_state["next_game_number"] - 1,
                "balance": mem_state["balance"],
                "prediction_mode": mem_state.get("prediction_mode", "ai"),
                "predict_direction": mem_state["predict_direction"],
                "predict_confidence": mem_state["predict_confidence"],
                "current_bet_tier": mem_state["predict_bet_tier"],
                "consecutive_errors": mem_state["consecutive_errors"],
                "health_score": 100.0,
                "pending_bet": mem_state["pending_bet"],
                "next_game_number": mem_state["next_game_number"],
            }

        return {
            "status": mem_state["status"],
            "boot_number": state.boot_number,
            "game_number": state.game_number,
            "current_game_result": state.current_game_result,
            "prediction_mode": getattr(state, "prediction_mode", mem_state.get("prediction_mode", "ai")),
            "predict_direction": mem_state["predict_direction"] or state.predict_direction,
            "predict_confidence": mem_state["predict_confidence"] or state.predict_confidence,
            "current_model_version": state.current_model_version,
            "current_bet_tier": mem_state["predict_bet_tier"] or state.current_bet_tier,
            "balance": mem_state["balance"],
            "consecutive_errors": mem_state["consecutive_errors"],
            "health_score": state.health_score,
            "pending_bet": mem_state["pending_bet"],
            "next_game_number": mem_state["next_game_number"],
        }


@router.get("/health")
async def get_health_score():
    """
    获取系统健康分 - 实时计算
    基于AI模型状态、数据库健康、数据一致性等实际指标
    """
    health_details = {
        "ai_models": {"score": 0, "max": 40, "issues": []},
        "database": {"score": 0, "max": 30, "issues": []},
        "data_consistency": {"score": 0, "max": 20, "issues": []},
        "session_health": {"score": 0, "max": 10, "issues": []},
    }
    
    # 1. AI模型健康检查 (40分)
    openai_ok = bool(settings.OPENAI_API_KEY and len(settings.OPENAI_API_KEY) > 20)
    anthropic_ok = bool(settings.ANTHROPIC_API_KEY and len(settings.ANTHROPIC_API_KEY) > 20)
    gemini_ok = bool(settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY) > 20)
    
    if openai_ok:
        health_details["ai_models"]["score"] += 15
    else:
        health_details["ai_models"]["issues"].append("OpenAI(庄模型)未配置")
    
    if anthropic_ok:
        health_details["ai_models"]["score"] += 15
    else:
        health_details["ai_models"]["issues"].append("Anthropic(闲模型)未配置")
    
    if gemini_ok:
        health_details["ai_models"]["score"] += 10
    else:
        health_details["ai_models"]["issues"].append("Gemini(综合模型)未配置")
    
    # 2. 数据库健康检查 (30分)
    try:
        async with async_session() as session:
            result = await session.execute(select(func.count()).select_from(GameRecord))
            game_count = result.scalar() or 0
            
            stmt = select(GameRecord).order_by(desc(GameRecord.id)).limit(1)
            result = await session.execute(stmt)
            result.scalar_one_or_none()
            
            if game_count > 0:
                health_details["database"]["score"] += 20
            else:
                health_details["database"]["issues"].append("数据库无游戏记录")
            
            stmt = select(SystemState)
            result = await session.execute(stmt)
            state = result.scalar_one_or_none()
            if state:
                health_details["database"]["score"] += 10
            else:
                health_details["database"]["issues"].append("无状态记录")
                
    except Exception as e:
        health_details["database"]["score"] = 0
        health_details["database"]["issues"].append(f"数据库连接异常: {str(e)[:30]}")
    
    # 3. 数据一致性检查 (20分)
    consistency_score = 20
    try:
        async with async_session() as session:
            stmt = select(func.count()).select_from(BetRecord).where(
                BetRecord.settlement_amount.is_(None),
                BetRecord.status == "pending"
            )
            result = await session.execute(stmt)
            pending_count = result.scalar() or 0
            
            if pending_count > 5:
                consistency_score -= 10
                health_details["data_consistency"]["issues"].append(f"有{pending_count}笔未结算下注")
            
            stmt = select(func.count()).select_from(SystemLog).where(
                SystemLog.priority == "high",
                SystemLog.created_at > datetime.utcnow() - timedelta(hours=1)
            )
            result = await session.execute(stmt)
            error_count = result.scalar() or 0
            
            if error_count > 0:
                consistency_score -= min(error_count * 2, 10)
                health_details["data_consistency"]["issues"].append(f"最近1小时有{error_count}个高优先级错误")
        
        health_details["data_consistency"]["score"] = max(0, consistency_score)
    except Exception as e:
        health_details["data_consistency"]["score"] = 0
        health_details["data_consistency"]["issues"].append(f"一致性检查失败: {str(e)[:30]}")
    
    # 4. 会话健康检查 (10分)
    from app.services.game.session import get_session
    try:
        session_data = get_session()
        health_details["session_health"]["score"] = 10
        error_count = getattr(session_data, 'consecutive_errors', 0)
        if error_count > 0:
            health_details["session_health"]["score"] -= min(error_count * 2, 5)
            health_details["session_health"]["issues"].append(f"会话有{error_count}个连续错误")
    except Exception as e:
        health_details["session_health"]["issues"].append(f"获取会话失败: {str(e)[:30]}")
    
    # 计算总分
    total_score = sum(d["score"] for d in health_details.values())
    max_score = sum(d["max"] for d in health_details.values())
    health_score = int((total_score / max_score) * 100) if max_score > 0 else 0
    
    # 计算模型稳定性
    model_stability = int(((15 if openai_ok else 0) + (15 if anthropic_ok else 0) + (10 if gemini_ok else 0)) / 40 * 100)
    
    # 计算结算一致性
    settlement_consistency = health_details["data_consistency"]["score"] / 20 * 100
    
    # 确定状态等级
    if health_score >= 85:
        status = "healthy"
        status_text = "健康"
    elif health_score >= 70:
        status = "warning"
        status_text = "警告"
    elif health_score >= 50:
        status = "critical"
        status_text = "危险"
    else:
        status = "error"
        status_text = "严重"
    
    return {
        "health_score": health_score,
        "model_stability": int(model_stability),
        "settlement_consistency": int(settlement_consistency),
        "status": status,
        "status_text": status_text,
        "details": health_details,
        "all_issues": [issue for d in health_details.values() for issue in d["issues"]],
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/diagnostics")
async def get_system_diagnostics():
    """
    系统诊断接口 - 返回所有关键系统组件的实时状态
    """
    # AI模型配置检查
    openai_enabled = bool(settings.OPENAI_API_KEY)
    anthropic_enabled = bool(settings.ANTHROPIC_API_KEY)
    gemini_enabled = bool(settings.GEMINI_API_KEY)
    
    # 数据库连通性检查
    db_ok = True
    try:
        async with async_session() as session:
            await session.execute(select(func.count()).select_from(GameRecord))
    except Exception:
        db_ok = False
    
    # 内存会话状态
    current_session_state = await get_current_state()
    
    # WebSocket连接数（从websocket模块获取）
    from app.api.routes.websocket import ws_clients
    ws_count = len(ws_clients)
    
    # 收集AI模型详细状态
    models_status = {
        "openai": {
            "enabled": openai_enabled,
            "label": "庄模型",
            "model": getattr(settings, "OPENAI_MODEL", "gpt-4o-mini"),
            "issue": None if openai_enabled else "OPENAI_API_KEY 未在 .env 中配置",
        },
        "anthropic": {
            "enabled": anthropic_enabled,
            "label": "闲模型",
            "model": getattr(settings, "ANTHROPIC_MODEL", "claude-sonnet-4-5"),
            "issue": None if anthropic_enabled else "ANTHROPIC_API_KEY 未在 .env 中配置",
        },
        "gemini": {
            "enabled": gemini_enabled,
            "label": "综合模型",
            "model": getattr(settings, "GEMINI_MODEL", "gemini-2.0-flash"),
            "issue": None if gemini_enabled else "GEMINI_API_KEY 未在 .env 中配置",
        },
    }
    
    configured_count = sum([openai_enabled, anthropic_enabled, gemini_enabled])
    
    # 构建告警列表
    issues = []
    if not db_ok:
        issues.append({"level": "critical", "title": "数据库连接失败", "detail": "SQLite 数据库无法访问，所有数据操作均会失败"})
    if configured_count == 0:
        issues.append({"level": "critical", "title": "所有AI模型均未配置", "detail": "请在 backend/.env 文件中配置 OPENAI_API_KEY、ANTHROPIC_API_KEY、GEMINI_API_KEY"})
    elif configured_count < 3:
        unconfigured = [v["label"] for k, v in models_status.items() if not v["enabled"]]
        issues.append({"level": "warning", "title": f"{len(unconfigured)}个AI模型未配置", "detail": f"以下模型缺少API Key：{'、'.join(unconfigured)}"})
    
    return {
        "backend_version": settings.APP_VERSION,
        "timestamp": datetime.now().isoformat(),
        "openai_enabled": openai_enabled,
        "anthropic_enabled": anthropic_enabled,
        "gemini_enabled": gemini_enabled,
        "ai_configured_count": configured_count,
        "models_detail": models_status,
        "db_ok": db_ok,
        "ws_connections": ws_count,
        "current_session": current_session_state,
        "issues": issues,
        "has_critical_issues": any(i["level"] == "critical" for i in issues),
        "overall_status": "critical" if not db_ok or configured_count == 0 else "warning" if configured_count < 3 else "ok",
    }


from pydantic import BaseModel, Field
from typing import Literal

class PredictionModeRequest(BaseModel):
    mode: Literal["ai", "rule"] = Field(..., description="预测模式：ai 或 rule")

class BalanceAdjustmentRequest(BaseModel):
    action: Literal["add", "sub"] = Field(..., description="操作类型：add(充值) 或 sub(扣除)")
    amount: float = Field(..., gt=0, description="调整金额必须大于0")

@router.post("/balance")
async def adjust_balance(
    req: BalanceAdjustmentRequest,
    _: dict = Depends(get_current_user),
):
    """管理员手动调整余额"""
    import math
    if math.isnan(req.amount) or math.isinf(req.amount) or req.amount < 0:
        raise HTTPException(400, "非法的金额参数")

    from app.services.game.session import get_session, get_session_lock, broadcast_event
    from app.services.game.logging import write_game_log

    lock = get_session_lock()
    async with lock:
        sess = get_session()
        old_balance = sess.balance

        if req.action == "sub" and sess.balance < req.amount:
            raise HTTPException(400, "余额不足，无法扣减")

        try:
            async with async_session() as db:
                stmt = select(SystemState).order_by(SystemState.id.desc()).limit(1)
                res = await db.execute(stmt)
                state = res.scalar_one_or_none()
                if not state:
                    from app.services.game.state import get_or_create_state
                    state = await get_or_create_state(db)
                
                # Apply changes to both memory and DB safely inside transaction
                if req.action == "add":
                    sess.balance += req.amount
                else:
                    sess.balance -= req.amount
                    
                state.balance = sess.balance

                action_text = "增加" if req.action == "add" else "扣除"
                await write_game_log(
                    db, sess.boot_number, sess.next_game_number - 1,
                    "LOG-SYS-BAL", "管理员调账", "成功",
                    f"管理员手动{action_text}余额: {req.amount:.0f}，原余额: {old_balance:.0f}，现余额: {sess.balance:.0f}",
                    category="资金事件", priority="P1"
                )
                await db.commit()
        except Exception as e:
            # Rollback memory state on DB failure
            sess.balance = old_balance
            raise HTTPException(500, f"数据库同步失败: {str(e)}")

        await broadcast_event("state_update", {"balance": sess.balance})

    return {"status": "success", "new_balance": sess.balance}

@router.post("/prediction-mode")
async def update_prediction_mode(
    req: PredictionModeRequest,
    _: dict = Depends(get_current_user),
):
    """Update system prediction mode (ai or rule)"""
    if req.mode not in ("ai", "rule"):
        raise HTTPException(400, "Invalid prediction mode")
    
    async with async_session() as session:
        stmt = select(SystemState).order_by(SystemState.id.desc()).limit(1)
        result = await session.execute(stmt)
        state = result.scalar_one_or_none()
        
        if state:
            state.prediction_mode = req.mode
        else:
            from app.services.game.state import get_or_create_state
            state = await get_or_create_state(session)
            state.prediction_mode = req.mode
        await session.commit()
            
        mem_sess = get_session()
        mem_sess.prediction_mode = req.mode
        
    return {"status": "success", "prediction_mode": req.mode}



@router.post("/select-model")
async def select_best_model(
    force_version: str = Query(None),
    _: dict = Depends(get_current_user),
):
    """执行智能选模（需认证）"""
    from app.services.smart_model_selector import SmartModelSelector
    
    async with async_session() as session:
        selector = SmartModelSelector(session)
        result = await selector.select_best_model(force_version=force_version)
        return result
