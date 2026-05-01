"""
AI分析相关路由
"""
import asyncio
from fastapi import APIRouter, Query, Depends, HTTPException
from sqlalchemy import select

from app.core.database import async_session
from app.models.schemas import SystemLog, SystemState
from app.api.routes.utils import get_current_user

router = APIRouter(prefix="/api", tags=["AI分析"])


@router.get("/analysis/latest")
async def get_latest_analysis():
    """获取最新一局的AI三模型分析结果"""
    from app.services.game import get_current_state
    
    # 优先从内存获取（最新）
    mem = await get_current_state()
    if mem.get("analysis"):
        analysis = mem["analysis"]
        return {
            "prediction_mode": mem.get("prediction_mode", "ai"),
            "engine": analysis.get("engine"),
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
                "reasoning_points": analysis.get("combined_reasoning_points") or [],
                "reasoning_detail": analysis.get("combined_reasoning_detail"),
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
            "prediction_mode": getattr(state, "prediction_mode", None),
            "engine": None,
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
                "reasoning_points": [],
                "reasoning_detail": None,
                "time": combined_log.log_time.isoformat() if combined_log else None,
            },
            "has_data": bool(combined_log),
        }


@router.post("/admin/ai-learning/start")
async def start_ai_learning(
    boot_number: int = Query(...),
    mode: str | None = Query(None),
    _: dict = Depends(get_current_user),
):
    """启动AI学习任务（需认证）"""
    from app.services.ai_learning_service import AILearningService
    from app.services.game.session import get_session

    if mode is not None and not isinstance(mode, str):
        mode = None
    if mode is None:
        mode = get_session().prediction_mode
    if mode not in ("ai", "single_ai"):
        raise HTTPException(400, "当前模式不支持深度学习")

    async with async_session() as session:
        service = AILearningService(session)

        status = await service.get_learning_status()
        if status["is_learning"]:
            raise HTTPException(400, f"学习任务正在执行中: {status['current_task']}")
            
        ok, reason = await service.check_preconditions(boot_number, prediction_mode=mode)
        if not ok:
            raise HTTPException(400, reason)

        # 使用单独的生命周期创建后台任务，避免 async with session 关闭后抛出 500
        async def run_learning_task():
            async with async_session() as bg_session:
                bg_service = AILearningService(bg_session)
                try:
                    await bg_service.start_learning(boot_number, prediction_mode=mode)
                except asyncio.CancelledError:
                    from app.services.game.logging import write_game_log

                    async def _cleanup_on_cancel() -> None:
                        await write_game_log(
                            bg_session,
                            boot_number,
                            None,
                            "LOG-AI-002",
                            "AI学习",
                            "取消",
                            f"AI学习任务已取消（boot_number={boot_number}）",
                            category="AI事件",
                            priority="P1",
                            source_module="AILearningService",
                        )
                        await bg_session.commit()

                    try:
                        await asyncio.shield(_cleanup_on_cancel())
                    except Exception:
                        pass
                    raise

        from app.services.game.session import start_background_task
        task_meta = start_background_task(
            task_type="ai_learning",
            coro=run_learning_task(),
            boot_number=boot_number,
            dedupe_key=f"ai_learning:{mode}:{boot_number}",
        )

        if boot_number == 0:
            msg = "深度学习已启动，正在分析全库历史数据（最多1000局）..."
        else:
            msg = f"深度学习已启动，正在分析第{boot_number}靴数据..."

        return {
            "status": "started",
            "message": msg,
            "task_id": task_meta.task_id,
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
