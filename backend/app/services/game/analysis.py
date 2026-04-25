"""
AI分析模块 - 处理三模型分析预测
"""
from datetime import datetime
from typing import Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.schemas import GameRecord, MistakeBook
from .session import get_session, get_session_lock, broadcast_event
from .state import get_or_create_state
from .logging import write_game_log


async def run_ai_analysis(
    db: AsyncSession,
    boot_number: int,
) -> Dict[str, Any]:
    """
    触发AI三模型分析预测下一局
    
    Returns:
        {"success": True, "predict": "庄"/"闲", "confidence": 0.72, "bet_amount": 100, "tier": "标准"}
    """
    from app.services.three_model_service import ThreeModelService
    from app.services.road_engine import UnifiedRoadEngine
    from app.services.smart_model_selector import SmartModelSelector
    
    lock = get_session_lock()
    async with lock:
        sess = get_session()
        import copy
        sess_backup = copy.deepcopy(sess)
        sess.status = "分析中"
        
        try:
            # 获取该靴的所有历史记录
            stmt = select(GameRecord).where(
                GameRecord.boot_number == boot_number,
            ).order_by(GameRecord.game_number)
            result = await db.execute(stmt)
            records = result.scalars().all()
            
            if not records:
                await write_game_log(
                    db, boot_number, sess.next_game_number,
                    "LOG-VAL-003", "AI分析", "失败",
                    f"AI分析失败：靴号{boot_number}无历史数据",
                    priority="P2",
                )
                await db.commit()
                return {"success": False, "error": "无历史数据可供分析"}
            
            # 构建五路走势供AI参考
            engine = UnifiedRoadEngine()
            
            # 获取错题本（需要在设置错误标记之前）
            stmt2 = select(MistakeBook).where(
                MistakeBook.boot_number == boot_number,
            ).order_by(MistakeBook.game_number.desc()).limit(5)
            mb_result = await db.execute(stmt2)
            mistakes = mb_result.scalars().all()
            
            # 设置错误标记到五路数据
            error_map = {m.game_number: m.error_id for m in mistakes}
            if error_map:
                engine.set_error_marks(error_map)
            
            # 获取五路数据
            road_data = await engine.get_all_roads(boot_number)
            
            # 构建游戏历史
            game_history = [
                {"game_number": r.game_number, "result": r.result}
                for r in records
            ]
            
            if sess.prediction_mode == "ai":
                from app.core.config import settings
                api_configured = bool(
                    (settings.OPENAI_API_KEY and len(settings.OPENAI_API_KEY) > 10) or
                    (settings.ANTHROPIC_API_KEY and len(settings.ANTHROPIC_API_KEY) > 10) or
                    (settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY) > 10)
                )
                if not api_configured:
                    # 自动降级为规则引擎
                    sess.prediction_mode = "rule"
                    sess._api_configured_checked = False
                    import logging
                    logging.getLogger(__name__).warning("未配置AI大模型API Key，系统已自动降级为强规则引擎模式！")
                else:
                    sess._api_configured_checked = True

            if sess.prediction_mode == "rule":
                from app.services.game.rule_engine import BaccaratRuleEngine
                rule_engine = BaccaratRuleEngine()
                
                # 同步调用规则引擎（由于规则引擎是同步的，不带 await）
                rule_res = rule_engine.analyze(game_history, road_data)
                
                analysis_result = {
                    "combined_model": {
                        "final_prediction": rule_res["predict"],
                        "confidence": rule_res["confidence"],
                        "bet_tier": rule_res["tier"],
                        "summary": ("⚠️ 【系统提示】：未检测到有效的 AI 大模型 API Key 配置，系统已自动为您降级并启用【强规则引擎模式】。\n\n" if not getattr(sess, '_api_configured_checked', True) else "") + "【强规则引擎模式】\n" + rule_res["combined_summary"],
                    },
                    "banker_model": {"summary": rule_res["banker_summary"]},
                    "player_model": {"summary": rule_res["player_summary"]},
                    "bet_amount": rule_res["bet_amount"]
                }
            else:
                # 调用AI三模型服务
                ai_service = ThreeModelService()
    
                # 获取当前版本（用于学习）
                selector = SmartModelSelector(db)
                current_version = await selector.get_current_version()
                current_version.version_id if current_version else "default"
                
                # 获取AI记忆库 (提取最新生成的实时微学习策略经验)
                from app.models.schemas import AIMemory
                stmt_memory = select(AIMemory).where(
                    AIMemory.boot_number == boot_number,
                    AIMemory.mistake_type == "实时推演策略"
                ).order_by(AIMemory.created_at.desc()).limit(1)
                memory_result = await db.execute(stmt_memory)
                latest_memory = memory_result.scalar_one_or_none()
    
                realtime_strategy = latest_memory.self_reflection if latest_memory else ""
    
                # 构建错题上下文
                mistake_context = [
                    {
                        "game_number": m.game_number,
                        "error_id": m.error_id,
                        "error_type": m.error_type,
                        "predict_direction": m.predict_direction,
                        "actual_result": m.actual_result,
                        "analysis": m.analysis,
                    }
                    for m in mistakes
                ]
                
                if realtime_strategy:
                    mistake_context.append({
                        "game_number": "实时前瞻",
                        "error_id": "REALTIME-001",
                        "error_type": "实时高维特征提取",
                        "predict_direction": "N/A",
                        "actual_result": "N/A",
                        "analysis": realtime_strategy,
                    })
                
                # 执行三模型分析
                analysis_result = await ai_service.analyze(
                    game_number=sess.next_game_number,
                    boot_number=boot_number,
                    game_history=game_history,
                    road_data=road_data,
                    mistake_context=mistake_context,
                    consecutive_errors=sess.consecutive_errors,
                    prompt_template=current_version.prompt_template if current_version else None,
                )
            
            # 保存预测结果到会话（适配ThreeModelService返回结构）
            combined_model = analysis_result.get("combined_model", {})
            banker_model = analysis_result.get("banker_model", {})
            player_model = analysis_result.get("player_model", {})
            
            sess.predict_direction = combined_model.get("final_prediction")
            sess.predict_confidence = combined_model.get("confidence", 0.5)
            sess.predict_bet_tier = combined_model.get("bet_tier", "标准")
            sess.predict_bet_amount = analysis_result.get("bet_amount", 100)
            sess.banker_summary = banker_model.get("summary", "")
            sess.player_summary = player_model.get("summary", "")
            sess.combined_summary = combined_model.get("summary", "")
            sess.analysis_time = datetime.now()
            
            # 更新系统状态
            state = await get_or_create_state(db)
            state.predict_direction = sess.predict_direction
            state.predict_confidence = sess.predict_confidence
            
            await write_game_log(
                db, boot_number, sess.next_game_number,
                "LOG-MDL-001", "AI分析", "完成",
                f"🧠 AI对第{sess.next_game_number}局推理完成：预测【{sess.predict_direction}】 (置信度: {sess.predict_confidence:.0%})",
                category="AI事件",
                priority="P2",
            )
            
            # 自动下注前暂存状态，由后续 place_bet 决定最终状态
            sess.status = "分析完成"
            state.status = "分析完成"
            
            await db.commit()
            
        except Exception as e:
            await db.rollback()
            import app.services.game.session as session_module
            session_module._session = sess_backup
            raise e
        
    # 广播AI分析结果和状态更新
    await broadcast_event("ai_analysis", {
        "game_number": sess.next_game_number,
        "prediction": sess.predict_direction,
        "confidence": sess.predict_confidence,
        "tier": sess.predict_bet_tier,
        "bet_amount": sess.predict_bet_amount,
        "banker_summary": sess.banker_summary,
        "player_summary": sess.player_summary,
        "combined_summary": sess.combined_summary,
    })
    
    # 广播状态变更
    await broadcast_event("state_update", {
        "status": "分析完成",
        "game_number": sess.next_game_number,
        "predict_direction": sess.predict_direction,
        "predict_confidence": sess.predict_confidence,
    })
    
    return {
        "success": True,
        "game_number": sess.next_game_number,
        "prediction": sess.predict_direction,
        "confidence": sess.predict_confidence,
        "tier": sess.predict_bet_tier,
        "bet_amount": sess.predict_bet_amount,
    }
