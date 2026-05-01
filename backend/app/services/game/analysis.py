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
    from app.services.single_model_service import SingleModelService
    from app.services.road_engine import UnifiedRoadEngine
    from app.services.smart_model_selector import SmartModelSelector
    
    lock = get_session_lock()
    async with lock:
        sess = get_session()
        import copy
        sess_backup = copy.deepcopy(sess)
        
        try:
            if sess.boot_number != boot_number:
                return {"success": False, "error": "stale_boot"}

            sess.status = "分析中"

            # 获取该靴的所有历史记录
            stmt = select(GameRecord).where(
                GameRecord.boot_number == boot_number,
            ).order_by(GameRecord.game_number)
            result = await db.execute(stmt)
            records = result.scalars().all()
            
            if not records:
                sess.status = "错误"
                await write_game_log(
                    db, boot_number, sess.next_game_number,
                    "LOG-VAL-003", "AI分析", "失败",
                    f"AI分析失败：靴号{boot_number}无历史数据",
                    priority="P2",
                )
                state = await get_or_create_state(db)
                state.status = "错误"
                await db.commit()
                return {"success": False, "error": "无历史数据可供分析"}
            
            # 构建五路走势供AI参考
            engine = UnifiedRoadEngine()
            
            # 获取错题本（需要在设置错误标记之前）
            # 修复重大业务 Bug: 移除 `.limit(5)` 硬编码限制
            # 必须将本靴内发生的所有错误血迹完整传递给 AI 引擎，否则会导致 AI 看到的五路图错题标记残缺，胜率大幅下降
            stmt2 = select(MistakeBook).where(
                MistakeBook.boot_number == boot_number,
            ).order_by(MistakeBook.game_number)  # 改为升序，保证时间线正确
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
            
            prediction_mode = sess.prediction_mode
            consecutive_errors = sess.consecutive_errors
            next_game_number = sess.next_game_number
            
            if prediction_mode == "ai":
                from app.core.config import settings
                api_configured = bool(
                    (settings.OPENAI_API_KEY and len(settings.OPENAI_API_KEY) > 10) or
                    (settings.ANTHROPIC_API_KEY and len(settings.ANTHROPIC_API_KEY) > 10) or
                    (settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY) > 10)
                )
                if not api_configured:
                    # 自动降级为规则引擎
                    prediction_mode = "rule"
                    sess.prediction_mode = "rule"
                    state = await get_or_create_state(db)
                    state.prediction_mode = "rule"
                    await db.commit()
                    sess._api_configured_checked = False
                    import logging
                    logging.getLogger(__name__).warning("未配置AI大模型API Key，系统已自动降级为强规则引擎模式！")
                else:
                    sess._api_configured_checked = True
            elif prediction_mode == "single_ai":
                from app.core.config import settings
                api_configured = bool(settings.SINGLE_AI_API_KEY and len(settings.SINGLE_AI_API_KEY) > 10)
                if not api_configured:
                    prediction_mode = "rule"
                    sess.prediction_mode = "rule"
                    state = await get_or_create_state(db)
                    state.prediction_mode = "rule"
                    await db.commit()
                    sess._api_configured_checked = False
                    import logging
                    logging.getLogger(__name__).warning("未配置单AI模式API Key，系统已自动降级为强规则引擎模式！")
                else:
                    sess._api_configured_checked = True

            # 获取AI记忆库 (提取最新生成的实时微学习策略经验)
            from app.models.schemas import AIMemory
            stmt_memory = select(AIMemory).where(
                AIMemory.boot_number == boot_number,
                AIMemory.error_type == "实时推演策略"
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
            
            # 获取当前版本（用于学习）
            selector = SmartModelSelector(db)
            current_version = await selector.get_current_version()
            prompt_template = current_version.prompt_template if current_version else None
            api_configured_checked = getattr(sess, '_api_configured_checked', True)

        except Exception as e:
            await db.rollback()
            import app.services.game.session as session_module
            session_module._session = sess_backup
            raise e

    # ================== 解锁执行AI/规则分析 ==================
    # 核心修复：AI请求可能长达120秒，必须在无锁状态下执行，防止整个系统（如下注/其他查询）假死
    if prediction_mode == "rule":
        from app.services.game.rule_engine import BaccaratRuleEngine
        rule_engine = BaccaratRuleEngine()
        
        # 同步调用规则引擎
        rule_res = rule_engine.analyze(game_history, road_data)
        
        analysis_result = {
            "combined_model": {
                "final_prediction": rule_res["predict"],
                "confidence": rule_res["confidence"],
                "bet_tier": rule_res["tier"],
                "summary": ("⚠️ 【系统提示】：未检测到有效的 AI 大模型 API Key 配置，系统已自动为您降级并启用【强规则引擎模式】。\n\n" if not api_configured_checked else "") + "【强规则引擎模式】\n" + rule_res["combined_summary"],
            },
            "banker_model": {"summary": rule_res["banker_summary"]},
            "player_model": {"summary": rule_res["player_summary"]},
            "bet_amount": rule_res.get("bet_amount", 100)
        }
    elif prediction_mode == "single_ai":
        try:
            ai_service = SingleModelService()
            analysis_result = await ai_service.analyze(
                game_number=next_game_number,
                boot_number=boot_number,
                game_history=game_history,
                road_data=road_data,
                mistake_context=mistake_context,
                consecutive_errors=consecutive_errors,
                prompt_template=prompt_template,
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"单AI分析发生致命异常: {e}", exc_info=True)
            analysis_result = {
                "combined_model": {
                    "final_prediction": "观望",
                    "confidence": 0.0,
                    "bet_tier": "保守",
                    "summary": f"系统异常，单AI降级: {str(e)}"
                },
                "banker_model": {"summary": "分析失败"},
                "player_model": {"summary": "分析失败"},
                "bet_amount": 0
            }
    else:
        # 调用AI三模型服务
        try:
            ai_service = ThreeModelService()
            # 执行三模型分析
            analysis_result = await ai_service.analyze(
                game_number=next_game_number,
                boot_number=boot_number,
                game_history=game_history,
                road_data=road_data,
                mistake_context=mistake_context,
                consecutive_errors=consecutive_errors,
                prompt_template=prompt_template,
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"AI分析发生致命异常: {e}", exc_info=True)
            # 触发降级为安全的错误回退结构，防止死锁卡死在“分析中”
            analysis_result = {
                "combined_model": {
                    "final_prediction": "观望", 
                    "confidence": 0.0, 
                    "bet_tier": "保守", 
                    "summary": f"系统异常，AI降级: {str(e)}"
                },
                "banker_model": {"summary": "分析失败"},
                "player_model": {"summary": "分析失败"},
                "bet_amount": 0
            }

    # ================== 重新加锁更新状态 ==================
    async with lock:
        sess = get_session()
        sess_backup = copy.deepcopy(sess)
        try:
            if sess.boot_number != boot_number:
                return {"success": False, "error": "stale_boot"}

            # 保存预测结果到会话（适配ThreeModelService返回结构）
            combined_model = analysis_result.get("combined_model", {})
            banker_model = analysis_result.get("banker_model", {})
            player_model = analysis_result.get("player_model", {})
            
            sess.predict_direction = combined_model.get("final_prediction")
            sess.predict_confidence = combined_model.get("confidence", 0.5)
            sess.predict_bet_tier = combined_model.get("bet_tier", "标准")
            from app.services.game.bet_sizing import compute_bet_amount
            sess.predict_bet_amount = compute_bet_amount(sess.predict_confidence, sess.balance)
            sess.banker_summary = banker_model.get("summary", "")
            sess.player_summary = player_model.get("summary", "")
            sess.combined_summary = combined_model.get("summary", "")
            sess.analysis_time = datetime.now()
            
            # 更新系统状态
            state = await get_or_create_state(db)
            state.predict_direction = sess.predict_direction
            state.predict_confidence = sess.predict_confidence
            state.current_bet_tier = sess.predict_bet_tier
            
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
