"""
系统状态路由
"""
from typing import List, Dict, Any
from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy import select, func, desc
from datetime import datetime, timedelta
import os

from app.core.database import async_session
from app.models.schemas import GameRecord, BetRecord, SystemLog, SystemState
from app.core.config import settings
from app.services.manual_game_service import get_current_state, get_session
from app.api.routes.utils import get_current_user

router = APIRouter(prefix="/api/system", tags=["系统状态"])


@router.get("/state")
async def get_system_state():
    """获取系统状态"""
    from app.services.manual_game_service import get_current_state
    
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
    db_ok = True
    try:
        async with async_session() as session:
            result = await session.execute(select(func.count()).select_from(GameRecord))
            game_count = result.scalar() or 0
            
            stmt = select(GameRecord).order_by(desc(GameRecord.id)).limit(1)
            result = await session.execute(stmt)
            latest_game = result.scalar_one_or_none()
            
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
                health_details["database"]["issues"].append(f"无状态记录")
                
    except Exception as e:
        db_ok = False
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


from pydantic import BaseModel

class PredictionModeRequest(BaseModel):
    mode: str

class BalanceAdjustmentRequest(BaseModel):
    action: str  # "add" or "sub"
    amount: float

@router.post("/balance")
async def adjust_balance(
    req: BalanceAdjustmentRequest,
    _: dict = Depends(get_current_user),
):
    """管理员手动调整余额"""
    if req.action not in ("add", "sub"):
        raise HTTPException(400, "无效的操作类型，只能是 'add' 或 'sub'")
    if req.amount <= 0:
        raise HTTPException(400, "调整金额必须大于 0")

    from app.services.game.session import get_session, get_session_lock
    from app.services.game.logging import write_game_log

    lock = get_session_lock()
    async with lock:
        sess = get_session()
        old_balance = sess.balance

        if req.action == "add":
            sess.balance += req.amount
        else:
            if sess.balance < req.amount:
                raise HTTPException(400, "余额不足，无法扣减")
            sess.balance -= req.amount

        async with async_session() as db:
            stmt = select(SystemState).order_by(SystemState.id.desc()).limit(1)
            res = await db.execute(stmt)
            state = res.scalar_one_or_none()
            if state:
                state.balance = sess.balance
            
            action_text = "增加" if req.action == "add" else "扣除"
            await write_game_log(
                db, sess.boot_number, sess.next_game_number - 1,
                "LOG-SYS-BAL", "管理员调账", "成功",
                f"管理员手动{action_text}余额: {req.amount:.0f}，原余额: {old_balance:.0f}，现余额: {sess.balance:.0f}",
                category="资金事件", priority="P1"
            )
            await db.commit()

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
        stmt = select(SystemState)
        result = await session.execute(stmt)
        state = result.scalar_one_or_none()
        
        if state:
            state.prediction_mode = req.mode
            await session.commit()
            
        mem_sess = get_session()
        mem_sess.prediction_mode = req.mode
        
    return {"status": "success", "prediction_mode": req.mode}

class APIKeyUpdateRequest(BaseModel):
    openai_key: str | None = None
    anthropic_key: str | None = None
    gemini_key: str | None = None

@router.post("/api-keys")
async def update_api_keys(
    req: APIKeyUpdateRequest,
    # _: dict = Depends(get_current_user), # Uncomment for auth in production
):
    """Update API Keys in .env and runtime settings"""
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
    
    # Update runtime settings
    if req.openai_key is not None:
        settings.OPENAI_API_KEY = req.openai_key
        os.environ["OPENAI_API_KEY"] = req.openai_key
    if req.anthropic_key is not None:
        settings.ANTHROPIC_API_KEY = req.anthropic_key
        os.environ["ANTHROPIC_API_KEY"] = req.anthropic_key
    if req.gemini_key is not None:
        settings.GEMINI_API_KEY = req.gemini_key
        os.environ["GEMINI_API_KEY"] = req.gemini_key

    # Save to .env
    env_content = ""
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            env_content = f.read()
    
    # Very naive update/append logic for simplicity
    def set_env_var(content, key, val):
        if val is None:
            return content
        lines = content.split('\n')
        updated = False
        for i, line in enumerate(lines):
            if line.startswith(f"{key}="):
                lines[i] = f"{key}={val}"
                updated = True
                break
        if not updated:
            lines.append(f"{key}={val}")
        return '\n'.join(lines)

    env_content = set_env_var(env_content, "OPENAI_API_KEY", req.openai_key)
    env_content = set_env_var(env_content, "ANTHROPIC_API_KEY", req.anthropic_key)
    env_content = set_env_var(env_content, "GEMINI_API_KEY", req.gemini_key)

    with open(env_path, "w", encoding="utf-8") as f:
        f.write(env_content)

    return {"status": "success", "message": "API keys updated successfully"}

class BalanceUpdateRequest(BaseModel):
    amount: float
    action: str # "add" or "subtract"

@router.post("/balance/adjust")
async def adjust_balance(
    req: BalanceUpdateRequest,
    # _: dict = Depends(get_current_user),
):
    """Adjust system balance"""
    async with async_session() as session:
        stmt = select(SystemState)
        result = await session.execute(stmt)
        state = result.scalar_one_or_none()
        
        if not state:
            raise HTTPException(status_code=404, detail="System state not initialized")
            
        mem_sess = get_session()
        
        if req.action == "add":
            state.balance += req.amount
            mem_sess.balance += req.amount
        elif req.action == "subtract":
            if state.balance < req.amount:
                raise HTTPException(status_code=400, detail="Insufficient balance")
            state.balance -= req.amount
            mem_sess.balance -= req.amount
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
            
        await session.commit()
        
        from app.services.game.logging import write_game_log
        await write_game_log(
            session=session,
            boot_number=mem_sess.boot_number,
            game_number=mem_sess.next_game_number,
            event_code="FIN-001",
            event_type="资金调整",
            event_result="成功",
            description=f"用户手动{'增加' if req.action == 'add' else '扣除'}本金: {req.amount}, 当前余额: {state.balance}",
            category="资金事件",
            priority="P2",
            source_module="SystemSettings"
        )
        await session.commit()
        
        return {"status": "success", "new_balance": state.balance}

@router.post("/test-api-keys")
async def test_api_keys(
    # _: dict = Depends(get_current_user)
):
    """Test connection to the 3 AI models"""
    results = {}
    
    # 1. Test OpenAI
    try:
        from openai import AsyncOpenAI
        import httpx
        client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_API_BASE,
            http_client=httpx.AsyncClient(timeout=10.0)
        )
        # Minimal request
        res = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=5
        )
        results["openai"] = {"success": True, "message": "Connection successful"}
    except Exception as e:
        results["openai"] = {"success": False, "message": str(e)}

    # 2. Test Anthropic
    try:
        from anthropic import AsyncAnthropic
        import httpx
        client = AsyncAnthropic(
            api_key=settings.ANTHROPIC_API_KEY,
            base_url=settings.ANTHROPIC_API_BASE,
            http_client=httpx.AsyncClient(timeout=10.0)
        )
        res = await client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=5
        )
        results["anthropic"] = {"success": True, "message": "Connection successful"}
    except Exception as e:
        results["anthropic"] = {"success": False, "message": str(e)}

    # 3. Test Gemini
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(settings.GEMINI_MODEL)
        res = model.generate_content("Hello")
        results["gemini"] = {"success": True, "message": "Connection successful"}
    except Exception as e:
        results["gemini"] = {"success": False, "message": str(e)}

    return results

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
