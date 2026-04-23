"""
学习模块 - 微学习和深度学习
"""
from datetime import datetime
from typing import Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.schemas import GameRecord, AIMemory
from .session import get_session, broadcast_event
from .logging import write_game_log


async def micro_learning_previous_game(
    db: AsyncSession,
    boot_number: int,
    prev_game_number: int,
):
    """
    微学习上一局 - 利用等待开奖的时间进行
    在下一局分析前完成，提升预测准确率
    """
    try:
        # 获取上一局的游戏记录
        stmt = select(GameRecord).where(
            GameRecord.boot_number == boot_number,
            GameRecord.game_number == prev_game_number,
        )
        result = await db.execute(stmt)
        prev_game = result.scalar_one_or_none()
        
        if not prev_game or not prev_game.result:
            return  # 上一局还没有结果，无法学习
        
        # 跳过和局
        if prev_game.result == "和":
            await broadcast_event("micro_learning", {
                "game_number": prev_game_number,
                "status": "跳过",
                "reason": "和局不学习",
            })
            return
        
        # 检查是否已经学习过
        stmt2 = select(AIMemory).where(
            AIMemory.boot_number == boot_number,
            AIMemory.game_number == prev_game_number,
        )
        result2 = await db.execute(stmt2)
        if result2.scalar_one_or_none():
            return  # 已经学习过
        
        # 执行微学习
        from app.services.ai_learning_service import AILearningService
        from app.services.smart_model_selector import SmartModelSelector
        from app.services.road_engine import UnifiedRoadEngine
        
        ai_learning = AILearningService(db)
        selector = SmartModelSelector(db)
        
        current_version = await selector.get_current_version()
        road_engine = UnifiedRoadEngine()
        road_data = await road_engine.get_all_roads(boot_number)
        
        is_correct = prev_game.predict_correct if prev_game.predict_direction else False
        
        await ai_learning.micro_learning(
            boot_number=boot_number,
            game_number=prev_game_number,
            version_id=current_version.version_id if current_version else "default",
            prediction=prev_game.predict_direction or "",
            actual_result=prev_game.result,
            is_correct=is_correct,
            confidence=prev_game.predict_confidence or 0.5,
            road_data=road_data,
            banker_evidence={"summary": "", "confidence": 0.5},
            player_evidence={"summary": "", "confidence": 0.5},
        )
        
        await broadcast_event("micro_learning", {
            "game_number": prev_game_number,
            "status": "完成",
            "prediction": prev_game.predict_direction,
            "actual": prev_game.result,
            "is_correct": is_correct,
        })
        
    except Exception as e:
        await broadcast_event("micro_learning", {
            "game_number": prev_game_number,
            "status": "失败",
            "error": str(e),
        })
