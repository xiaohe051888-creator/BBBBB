"""
系统状态路由
"""
import logging
from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy import select, func, desc
from datetime import datetime, timedelta, UTC

from app.core.database import async_session
from app.models.schemas import GameRecord, BetRecord, SystemLog, SystemState, AiModelConfig
from app.core.config import settings
from app.services.game import get_current_state, get_session
from app.api.routes.utils import get_current_user, is_secret_configured
from app.services.ai_config_status import compute_config_hash

router = APIRouter(
    prefix="/api/system", 
    tags=["系统状态"]
)
logger = logging.getLogger(__name__)

@router.get("/ping")
async def ping():
    return {"ok": True}

@router.get("/state")
async def get_system_state(_: dict = Depends(get_current_user)):
    """获取系统状态"""
    from app.services.game import get_current_state
    
    async with async_session() as session:
        stmt = select(SystemState).where(SystemState.singleton_key == 1)
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
                "prediction_mode": mem_state.get("prediction_mode", "rule"),
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
            "prediction_mode": getattr(state, "prediction_mode", mem_state.get("prediction_mode", "rule")),
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

@router.get("/state-public")
async def get_system_state_public():
    mem_state = await get_current_state()
    return {
        "status": mem_state.get("status"),
        "boot_number": mem_state.get("boot_number"),
        "game_number": (mem_state.get("next_game_number") or 1) - 1,
        "current_game_result": None,
        "prediction_mode": mem_state.get("prediction_mode", "rule"),
        "predict_direction": None,
        "predict_confidence": None,
        "current_model_version": None,
        "current_bet_tier": mem_state.get("predict_bet_tier") or "标准",
        "balance": None,
        "consecutive_errors": mem_state.get("consecutive_errors") or 0,
        "health_score": None,
        "pending_bet": None,
        "next_game_number": mem_state.get("next_game_number"),
    }


@router.get("/health")
async def get_health_score(_: dict = Depends(get_current_user)):
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
    
    from app.services.game import get_current_state

    mem = await get_current_state()
    mode = mem.get("prediction_mode", "rule")

    openai_ok = is_secret_configured(settings.OPENAI_API_KEY)
    anthropic_ok = is_secret_configured(settings.ANTHROPIC_API_KEY)
    gemini_ok = is_secret_configured(settings.GEMINI_API_KEY)
    single_ok = is_secret_configured(getattr(settings, "SINGLE_AI_API_KEY", ""))

    def _mode_label(v: str) -> str:
        return "3AI" if v == "ai" else "单AI" if v == "single_ai" else "规则" if v == "rule" else v

    health_details["ai_by_mode"] = {
        "current_mode": mode,
        "current_mode_ai": {"score": 0, "max": 40, "issues": []},
        "other_modes_ai": {"issues_by_mode": {}},
    }

    def _other_issues() -> dict:
        return {
            "ai": [i for i in [
                None if openai_ok else "庄模型接口未配置",
                None if anthropic_ok else "闲模型接口未配置",
                None if gemini_ok else "综合模型接口未配置",
            ] if i],
            "single_ai": [] if single_ok else ["单AI接口未配置"],
            "rule": [],
        }

    other = _other_issues()
    for k, v in other.items():
        if k != mode:
            health_details["ai_by_mode"]["other_modes_ai"]["issues_by_mode"][_mode_label(k)] = v

    current_ai = health_details["ai_by_mode"]["current_mode_ai"]

    if mode == "rule":
        current_ai["score"] = 40
        health_details["ai_models"]["score"] = 40
    elif mode == "single_ai":
        if single_ok:
            current_ai["score"] = 40
            health_details["ai_models"]["score"] = 40
        else:
            current_ai["issues"].append("单AI接口未配置")
            health_details["ai_models"]["issues"].append("单AI接口未配置")
    else:
        if openai_ok:
            current_ai["score"] += 15
            health_details["ai_models"]["score"] += 15
        else:
            current_ai["issues"].append("庄模型接口未配置")
            health_details["ai_models"]["issues"].append("庄模型接口未配置")

        if anthropic_ok:
            current_ai["score"] += 15
            health_details["ai_models"]["score"] += 15
        else:
            current_ai["issues"].append("闲模型接口未配置")
            health_details["ai_models"]["issues"].append("闲模型接口未配置")

        if gemini_ok:
            current_ai["score"] += 10
            health_details["ai_models"]["score"] += 10
        else:
            current_ai["issues"].append("综合模型接口未配置")
            health_details["ai_models"]["issues"].append("综合模型接口未配置")
    
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
            
            stmt = select(SystemState).where(SystemState.singleton_key == 1)
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
                BetRecord.status == "待开奖"
            )
            result = await session.execute(stmt)
            pending_count = result.scalar() or 0
            
            if pending_count > 5:
                consistency_score -= 10
                health_details["data_consistency"]["issues"].append(f"有{pending_count}笔未结算下注")
            
            stmt = select(func.count()).select_from(SystemLog).where(
                SystemLog.priority == "P1",
                SystemLog.log_time > (datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1))
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
    scored_parts = [d for d in health_details.values() if isinstance(d, dict) and "score" in d and "max" in d]
    total_score = sum(d["score"] for d in scored_parts)
    max_score = sum(d["max"] for d in scored_parts)
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
        "all_issues": [
            issue
            for d in health_details.values()
            if isinstance(d, dict) and isinstance(d.get("issues"), list)
            for issue in d["issues"]
        ],
        "timestamp": datetime.now(UTC).replace(tzinfo=None).isoformat(),
    }


@router.get("/diagnostics")
async def get_system_diagnostics(_: dict = Depends(get_current_user)):
    """
    系统诊断接口 - 返回所有关键系统组件的实时状态
    """
    current_session_state = await get_current_state()
    current_mode = current_session_state.get("prediction_mode", "rule")

    def _mode_label(v: str) -> str:
        return "3AI" if v == "ai" else "单AI" if v == "single_ai" else "规则" if v == "rule" else v

    openai_enabled = is_secret_configured(settings.OPENAI_API_KEY)
    anthropic_enabled = is_secret_configured(settings.ANTHROPIC_API_KEY)
    gemini_enabled = is_secret_configured(settings.GEMINI_API_KEY)
    single_ai_enabled = is_secret_configured(getattr(settings, "SINGLE_AI_API_KEY", ""))
    
    db_ok = True
    db_error = None
    db_game_count = None
    db_has_state = None
    try:
        async with async_session() as session:
            res = await session.execute(select(func.count()).select_from(GameRecord))
            db_game_count = res.scalar() or 0
            res = await session.execute(select(SystemState).where(SystemState.singleton_key == 1))
            db_has_state = bool(res.scalar_one_or_none())
    except Exception as e:
        db_ok = False
        db_error = str(e)[:200]
    
    def _readiness(required: list[str], enabled_map: dict[str, bool]) -> dict:
        missing = [k for k in required if not enabled_map.get(k)]
        configured_count = len(required) - len(missing)
        if not required:
            status = "ok"
        else:
            status = "ok" if len(missing) == 0 else "critical"
        return {
            "required": required,
            "configured_count": configured_count,
            "missing": missing,
            "status": status,
        }

    enabled_map = {
        "openai": openai_enabled,
        "anthropic": anthropic_enabled,
        "gemini": gemini_enabled,
        "single_ai": single_ai_enabled,
    }

    mode_readiness = {
        "ai": _readiness(["openai", "anthropic", "gemini"], enabled_map),
        "single_ai": _readiness(["single_ai"], enabled_map),
        "rule": _readiness([], enabled_map),
    }

    models = [
        {
            "key": "openai",
            "label": "庄模型",
            "provider": "openai",
            "model": getattr(settings, "OPENAI_MODEL", "gpt-4o-mini"),
            "enabled": openai_enabled,
            "required_in_modes": ["ai"],
        },
        {
            "key": "anthropic",
            "label": "闲模型",
            "provider": "anthropic",
            "model": getattr(settings, "ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
            "enabled": anthropic_enabled,
            "required_in_modes": ["ai"],
        },
        {
            "key": "gemini",
            "label": "综合模型",
            "provider": "gemini",
            "model": getattr(settings, "GEMINI_MODEL", "gemini-1.5-flash"),
            "enabled": gemini_enabled,
            "required_in_modes": ["ai"],
        },
        {
            "key": "single_ai",
            "label": "单AI",
            "provider": "deepseek",
            "model": getattr(settings, "SINGLE_AI_MODEL", "deepseek-v4-pro"),
            "enabled": single_ai_enabled,
            "required_in_modes": ["single_ai"],
        },
    ]

    for m in models:
        m["required_in_current_mode"] = current_mode in (m.get("required_in_modes") or [])
        m["issue"] = None if m["enabled"] else "接口密钥未配置"
    
    from app.api.routes.websocket import get_ws_client_count
    ws_count = await get_ws_client_count()
    
    # 收集AI模型详细状态（兼容旧字段）
    models_status = {
        "openai": {
            "enabled": openai_enabled,
            "label": "庄模型",
            "model": getattr(settings, "OPENAI_MODEL", "gpt-4o-mini"),
            "issue": None if openai_enabled else "接口密钥未配置",
        },
        "anthropic": {
            "enabled": anthropic_enabled,
            "label": "闲模型",
            "model": getattr(settings, "ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
            "issue": None if anthropic_enabled else "接口密钥未配置",
        },
        "gemini": {
            "enabled": gemini_enabled,
            "label": "综合模型",
            "model": getattr(settings, "GEMINI_MODEL", "gemini-1.5-flash"),
            "issue": None if gemini_enabled else "接口密钥未配置",
        },
        "single_ai": {
            "enabled": single_ai_enabled,
            "label": "单AI",
            "model": getattr(settings, "SINGLE_AI_MODEL", "deepseek-v4-pro"),
            "issue": None if single_ai_enabled else "接口密钥未配置",
        },
    }
    
    configured_count = sum([openai_enabled, anthropic_enabled, gemini_enabled])

    current_required = mode_readiness.get(current_mode, mode_readiness["ai"]).get("required", [])
    current_missing = mode_readiness.get(current_mode, mode_readiness["ai"]).get("missing", [])
    other_modes = [m for m in ("ai", "single_ai", "rule") if m != current_mode]
    issues_current_mode = []
    if not db_ok:
        issues_current_mode.append({
            "level": "critical",
            "title": "数据库访问失败",
            "detail": "数据库无法访问，所有数据操作均会失败",
        })
    else:
        if db_game_count == 0:
            issues_current_mode.append({"level": "info", "title": "数据库暂无游戏记录", "detail": "首次启动或尚未上传数据属于正常现象"})
        if not db_has_state:
            issues_current_mode.append({"level": "info", "title": "数据库暂无状态记录", "detail": "首次启动或尚未写入状态属于正常现象"})
    if current_missing:
        issues_current_mode.append({
            "level": "critical",
            "title": "当前模式AI未就绪",
            "detail": f"当前模式({_mode_label(current_mode)})缺少必要配置：{'、'.join(current_missing)}",
        })

    issues_other_modes = []
    for om in other_modes:
        missing = mode_readiness.get(om, {}).get("missing", [])
        if missing:
            issues_other_modes.append({
                "level": "info",
                "title": f"其它模式({_mode_label(om)})未就绪",
                "detail": f"缺少配置：{'、'.join(missing)}（不影响当前模式）",
            })
    
    issues = issues_current_mode + issues_other_modes

    from sqlalchemy import select as sa_select
    from app.models.schemas import BackgroundTask
    tasks = []
    try:
        async with async_session() as s:
            tasks = (await s.execute(sa_select(BackgroundTask).order_by(BackgroundTask.created_at.desc()).limit(50))).scalars().all()
    except Exception:
        logger.exception("读取 BackgroundTask 列表失败")
        tasks = []

    running = [t for t in tasks if getattr(t, "status", None) == "running"]
    running_by_type: dict[str, int] = {}
    for t in running:
        if getattr(t, "task_type", None):
            running_by_type[t.task_type] = running_by_type.get(t.task_type, 0) + 1

    stuck_signals = []
    try:
        async with async_session() as s:
            from app.services.game.recovery import detect_stuck_state
            info = await detect_stuck_state(s)
            if info.get("stuck"):
                stuck_signals.append(info)
    except Exception:
        logger.exception("detect_stuck_state 执行失败")

    latest_errors = [t for t in tasks if getattr(t, "status", None) == "failed" and getattr(t, "error", None)][:5]
    background_tasks = {
        "running_count": len(running),
        "running_types": sorted(list({getattr(t, "task_type", None) for t in running if getattr(t, "task_type", None)})),
        "running_tasks_by_type": running_by_type,
        "stuck_signals": stuck_signals,
        "latest_errors": [
            {
                "task_id": t.task_id,
                "task_type": t.task_type,
                "boot_number": t.boot_number,
                "status": t.status,
                "message": t.message,
                "error": t.error,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in latest_errors
        ],
    }
    
    overall_status_current_mode = (
        "critical"
        if any(i["level"] == "critical" for i in issues_current_mode)
        else "warning" if any(i["level"] == "warning" for i in issues_current_mode)
        else "ok"
    )

    return {
        "backend_version": settings.APP_VERSION,
        "timestamp": datetime.now().isoformat(),
        "current_mode": current_mode,
        "models": models,
        "mode_readiness": mode_readiness,
        "issues_current_mode": issues_current_mode,
        "issues_other_modes": issues_other_modes,
        "overall_status_current_mode": overall_status_current_mode,
        "openai_enabled": openai_enabled,
        "anthropic_enabled": anthropic_enabled,
        "gemini_enabled": gemini_enabled,
        "ai_configured_count": configured_count,
        "models_detail": models_status,
        "db_ok": db_ok,
        "db_error": db_error,
        "db_game_count": db_game_count,
        "db_has_state": db_has_state,
        "ws_connections": ws_count,
        "current_session": current_session_state,
        "background_tasks": background_tasks,
        "issues": issues,
        "has_critical_issues": any(i["level"] == "critical" for i in issues),
        "overall_status": overall_status_current_mode,
    }


@router.post("/repair")
async def repair_system(_: dict = Depends(get_current_user)):
    async with async_session() as session:
        from app.services.game.recovery import recover_on_startup, repair_stuck_state
        await recover_on_startup(session)
        repaired = await repair_stuck_state(session)
        return {"success": True, "repaired": repaired}


@router.get("/tasks")
async def list_system_tasks(
    limit: int = Query(50, ge=1, le=200),
    _: dict = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.models.schemas import BackgroundTask
    from app.services.game.task_registry import registry

    async with async_session() as session:
        rows = (await session.execute(
            select(BackgroundTask).order_by(BackgroundTask.created_at.desc()).limit(limit)
        )).scalars().all()

    mem = {k: v for k, v in registry._tasks.items()}
    tasks = []
    for r in rows:
        m = mem.get(r.task_id)
        tasks.append({
            "task_id": r.task_id,
            "task_type": r.task_type,
            "boot_number": r.boot_number,
            "dedupe_key": r.dedupe_key,
            "created_at": (r.created_at.isoformat() if r.created_at else None),
            "status": (m.status if m else r.status),
            "message": (m.message if m else r.message),
            "error": (m.error if m else r.error),
        })

    return {"tasks": tasks}


@router.post("/tasks/{task_id}/cancel")
async def cancel_system_task(
    task_id: str,
    _: dict = Depends(get_current_user),
):
    from app.services.game.task_registry import registry

    ok = registry.cancel(task_id)
    if not ok:
        raise HTTPException(400, "任务不存在或已结束")
    return {"success": True}


from pydantic import BaseModel, Field
from typing import Literal

class PredictionModeRequest(BaseModel):
    mode: Literal["ai", "single_ai", "rule"] = Field(..., description="预测模式：ai | single_ai | rule")

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
        sess.balance = float(sess.balance)
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
                    sess.balance = round(float(sess.balance) + float(req.amount), 2)
                else:
                    sess.balance = round(float(sess.balance) - float(req.amount), 2)
                    
                state.balance = float(sess.balance)

                action_text = "增加" if req.action == "add" else "扣除"
                await write_game_log(
                    db, sess.boot_number, sess.next_game_number - 1,
                    "LOG-SYS-BAL", "管理员调账", "成功",
                    f"管理员手动{action_text}余额: {req.amount:.2f}，原余额: {old_balance:.2f}，现余额: {sess.balance:.2f}",
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
    """更新系统预测模式"""
    if req.mode not in ("ai", "single_ai", "rule"):
        raise HTTPException(400, "非法的预测模式")

    role_map = {
        "banker": ("OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_API_BASE"),
        "player": ("ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "ANTHROPIC_API_BASE"),
        "combined": ("GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_API_BASE"),
        "single": ("SINGLE_AI_API_KEY", "SINGLE_AI_MODEL", "SINGLE_AI_API_BASE"),
    }

    def _get_setting(key: str) -> str:
        return getattr(settings, key, "") or ""

    async def _require_test_ok(session) -> None:
        if req.mode == "rule":
            return

        need_roles = ("banker", "player", "combined") if req.mode == "ai" else ("single",)
        rows = (await session.execute(select(AiModelConfig).where(AiModelConfig.role.in_(need_roles)))).scalars().all()
        by_role = {r.role: r for r in rows if getattr(r, "role", None)}

        labels = {
            "banker": "庄模型(OpenAI)",
            "player": "闲模型(Claude)",
            "combined": "综合模型(Gemini)",
            "single": "单AI(DeepSeek)",
        }

        missing = []
        for role in need_roles:
            row = by_role.get(role)
            if row is None:
                missing.append(labels[role])
                continue
            k_key, m_key, b_key = role_map[role]
            current_hash = compute_config_hash(row.provider, _get_setting(m_key), _get_setting(k_key), _get_setting(b_key) or None)
            ok = bool(row.last_test_ok and row.last_test_config_hash == current_hash)
            if not ok:
                missing.append(labels[role])

        if missing:
            if req.mode == "ai":
                raise HTTPException(409, f"无法切换至3AI模式：请先配置并测试通过：{'、'.join(missing)}")
            raise HTTPException(409, f"无法切换至单AI模式：请先配置并测试通过：{'、'.join(missing)}")

    if req.mode == "ai":
        ok = is_secret_configured(settings.OPENAI_API_KEY) and is_secret_configured(settings.ANTHROPIC_API_KEY) and is_secret_configured(settings.GEMINI_API_KEY)
        if not ok:
            raise HTTPException(400, "无法切换至3AI模式：需同时配置 庄模型(OpenAI)、闲模型(Claude)、综合模型(Gemini) 三项接口密钥")
    elif req.mode == "single_ai":
        ok = is_secret_configured(getattr(settings, "SINGLE_AI_API_KEY", ""))
        if not ok:
            raise HTTPException(400, "无法切换至单AI模式：请先配置 单AI(DeepSeek) 接口密钥")
    
    async with async_session() as session:
        await _require_test_ok(session)
        from app.services.game.state import get_or_create_state
        state = await get_or_create_state(session)
        state.prediction_mode = req.mode
        await session.commit()
            
        from app.services.game.session import get_session_lock
        lock = get_session_lock()
        async with lock:
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
