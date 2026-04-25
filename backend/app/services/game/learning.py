"""
学习模块 - 微学习和深度学习
"""
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.schemas import GameRecord, AIMemory
from .session import broadcast_event


async def micro_learning_current_trend(
    db: AsyncSession,
    boot_number: int,
    current_game_number: int,
):
    """
    等待期实时微学习 - 综合模型根据本靴现有走势图进行微学习，实时改进自我提升
    一切为了提高分析预测的准确率。
    在用户下注后、等待开奖期间执行。
    """
    try:
        # 向前端广播正在进行实时学习
        await broadcast_event("micro_learning", {
            "game_number": current_game_number,
            "status": "进行中",
            "message": "综合模型正在根据本靴现有走势图进行微学习和自我提升...",
        })

        from app.services.smart_model_selector import SmartModelSelector
        from app.services.road_engine import UnifiedRoadEngine
        from app.services.three_model_service import ThreeModelService
        from app.models.schemas import GameRecord
        import json

        selector = SmartModelSelector(db)
        current_version = await selector.get_current_version()
        road_engine = UnifiedRoadEngine()
        road_data = await road_engine.get_all_roads(boot_number)

        # 提取历史记录供大模型参考
        stmt = select(GameRecord).where(
            GameRecord.boot_number == boot_number,
            GameRecord.result.isnot(None),
        ).order_by(GameRecord.game_number)
        result = await db.execute(stmt)
        records = result.scalars().all()
        game_history = [{"game_number": r.game_number, "result": r.result} for r in records]

        # 触发综合模型的等待期自我演练
        # 我们调用真实的 ThreeModelService API 来生成策略
        ai_service = ThreeModelService()
        realtime_strategy_text = await ai_service.realtime_strategy_learning(
            game_history=game_history,
            road_data=road_data,
        )

        # 将真实推演经验写入 AIMemory，作为实时提升的知识库
        memory = AIMemory(
            boot_number=boot_number,
            game_number=current_game_number,
            version_id=current_version.version_id if current_version else "realtime_v1",
            error_type="实时推演策略",
            prediction="N/A",
            actual_result="N/A",
            is_correct=True,
            confidence=1.0,
            road_snapshot=json.dumps(road_data.get("big_road", [])[-5:]), # 只存最近特征
            error_analysis="实时演练：综合模型提取最新五路形态",
            self_reflection=realtime_strategy_text,  # 存入真实的 AI 大模型回复
            created_at=datetime.now()
        )
        db.add(memory)
        await db.commit()

        await broadcast_event("micro_learning", {
            "game_number": current_game_number,
            "status": "完成",
        })

    except Exception as e:
        await broadcast_event("micro_learning", {
            "game_number": current_game_number,
            "status": "失败",
            "error": str(e),
        })

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
            "message": f"第{prev_game_number}局学习完毕",
        })
        
    except Exception as e:
        await broadcast_event("micro_learning", {
            "game_number": prev_game_number,
            "status": "失败",
            "error": str(e),
        })
