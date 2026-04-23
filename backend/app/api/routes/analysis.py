"""
AI分析相关路由
"""
import asyncio
from fastapi import APIRouter, Query, Depends, HTTPException
from sqlalchemy import select, desc

from app.core.database import async_session
from app.models.schemas import SystemLog, SystemState
from app.api.routes.utils import get_current_user

router = APIRouter(prefix="/api", tags=["AI分析"])


@router.get("/analysis/latest")
async def get_latest_analysis():
    """获取最新一局的AI三模型分析结果"""
    from app.services.manual_game_service import get_current_state
    
    # 优先从内存获取（最新）
    mem = await get_current_state()
    if mem.get("analysis"):
        analysis = mem["analysis"]
        return {
            "banker_model": {
                "summary": analysis.get("banker_summary"),
                "time": analysis.get("time"),
            },
            "player_model": {
                "summary": analysis.get("player_summary"),
                "time": analysis.get("time"),
            },
            "combined_model": {
                "summary": analysis.get("combined_summary"),
                "confidence": mem.get("predict_confidence"),
                "bet_tier": mem.get("predict_bet_tier"),
                "prediction": mem.get("predict_direction"),
                "time": analysis.get("time"),
            },
            "has_data": True,
        }
    
    # 从日志中提取（历史记录）
    async with async_session() as session:
        stmt = select(SystemLog).where(
            SystemLog.event_code.in_([
                "LOG-MDL-001",
                "LOG-MDL-002",
                "LOG-MDL-003",
            ]),
        ).order_by(SystemLog.log_time.desc()).limit(10)
        
        result = await session.execute(stmt)
        logs = result.scalars().all()
        
        banker_log = next((l for l in logs if l.event_code == "LOG-MDL-001"), None)
        player_log = next((l for l in logs if l.event_code == "LOG-MDL-002"), None)
        combined_log = next((l for l in logs if l.event_code == "LOG-MDL-003"), None)
        
        state_stmt = select(SystemState)
        state_result = await session.execute(state_stmt)
        state = state_result.scalar_one_or_none()
        
        return {
            "banker_model": {
                "summary": banker_log.description if banker_log else None,
                "time": banker_log.log_time.isoformat() if banker_log else None,
            },
            "player_model": {
                "summary": player_log.description if player_log else None,
                "time": player_log.log_time.isoformat() if player_log else None,
            },
            "combined_model": {
                "summary": combined_log.description if combined_log else None,
                "confidence": (state.predict_confidence if state else None),
                "bet_tier": (state.current_bet_tier if state else None),
                "prediction": (state.predict_direction if state else None),
                "time": combined_log.log_time.isoformat() if combined_log else None,
            },
            "has_data": bool(combined_log),
        }


@router.post("/admin/ai-learning/start")
async def start_ai_learning(
    boot_number: int = Query(...),
    _: dict = Depends(get_current_user),
):
    """启动AI学习任务（需认证）"""
    from app.services.ai_learning_service import AILearningService
    
    async with async_session() as session:
        service = AILearningService(session)
        
        status = await service.get_learning_status()
        if status["is_learning"]:
            raise HTTPException(400, f"学习任务正在执行中: {status['current_task']}")
        
        asyncio.create_task(service.start_learning(boot_number))
        
        return {
            "status": "started",
            "message": f"AI学习已启动，正在分析第{boot_number}靴数据...",
        }


@router.get("/admin/ai-learning/status")
async def get_ai_learning_status(_: dict = Depends(get_current_user)):
    """获取AI学习状态（需认证）"""
    from app.services.ai_learning_service import AILearningService
    
    return {
        "is_learning": AILearningService._is_learning,
        "current_task": AILearningService._current_task,
        "min_samples": getattr(AILearningService, '_min_samples', 200),
        "max_versions": getattr(AILearningService, '_max_versions', 5),
    }
