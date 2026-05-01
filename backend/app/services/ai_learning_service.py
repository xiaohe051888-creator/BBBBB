"""
AI学习与模型版本管理服务 - 百家乐分析预测系统（升级版）

核心功能：
1. AI深度学习：基于历史数据进行5维度错误分析 + 自我反思
2. 三级记忆机制：短期（当前靴）/ 中期（最近5靴）/ 长期（所有历史）
3. 局级微学习：每局结束后即时分析，不创建新版本
4. 智能版本选择：基于加权评分自动选择最佳版本
5. 渐进式学习：支持版本回退和A/B测试

触发方式：
- 局级微学习：每局结算后自动触发（轻量级）
- 靴级深度学习：管理员手动触发或自动触发（创建新版本）

前置条件：
- 靴级学习：有效结算局 >= 20局
- 版本数量：最多10个活跃版本

输出：
- 新版本号 + 完整提示词模板
- 深度错误分析报告
- 自我反思总结
- 三级记忆更新
"""

import asyncio
import json
import logging
import re
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from fastapi.encoders import jsonable_encoder

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, update

from app.core.config import settings
from app.models.schemas import (
    GameRecord, ModelVersion, MistakeBook, AIMemory,
    LogPriority, LogCategory, SystemLog,
)
from app.services.game.logging import write_game_log

logger = logging.getLogger(__name__)


@dataclass
class LearningResult:
    """AI学习结果"""
    success: bool
    version: Optional[str] = None
    training_range: str = ""
    sample_count: int = 0
    accuracy_before: Optional[float] = None
    accuracy_after: Optional[float] = None
    key_changes: str = ""
    error: Optional[str] = None
    learning_time: float = 0.0


class AILearningService:
    """
    AI学习服务
    
    使用 Claude API 对历史数据进行深度分析，
    生成新的预测策略并创建新模型版本。
    """
    
    # 类级别的任务锁（跨实例共享）
    _learning_lock: asyncio.Lock = asyncio.Lock()
    _is_learning: bool = False
    _current_task: Optional[str] = None  # 当前学习任务标识 (bootNumber)
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    @classmethod
    def is_busy(cls) -> bool:
        """检查是否有学习任务在执行"""
        return cls._is_learning
    
    @classmethod
    async def acquire_lock(cls, task_id: str) -> bool:
        """获取学习任务锁"""
        if cls._is_learning:
            return False
        async with cls._learning_lock:
            if cls._is_learning:
                return False
            cls._is_learning = True
            cls._current_task = task_id
            logger.info(f"[AI学习] 任务锁获取成功: {task_id}")
            return True
    
    @classmethod
    def release_lock(cls):
        """释放学习任务锁"""
        cls._is_learning = False
        cls._current_task = None
        logger.info("[AI学习] 任务锁已释放")
    
    async def check_preconditions(self, boot_number: int, prediction_mode: str = "ai") -> tuple[bool, str]:
        """
        检查学习前置条件
        
        返回: (是否满足条件, 不满足原因)
        """
        # 1. 检查任务锁
        if self.is_busy():
            return False, f"有学习任务正在执行中: {self._current_task}"
        
        if prediction_mode not in ("ai", "single_ai"):
            return False, "当前模式不支持深度学习"

        from app.core.config import settings
        if prediction_mode == "single_ai":
            if not (settings.SINGLE_AI_API_KEY and len(settings.SINGLE_AI_API_KEY) > 10):
                return False, "未配置单AI模式接口密钥，无法启动深度学习"
        else:
            api_configured = bool(
                (settings.OPENAI_API_KEY and len(settings.OPENAI_API_KEY) > 10)
                and (settings.ANTHROPIC_API_KEY and len(settings.ANTHROPIC_API_KEY) > 10)
                and (settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY) > 10)
            )
            if not api_configured:
                return False, "未配置完整3AI模式接口密钥（庄/闲/综合），无法启动深度学习"

        if boot_number == 0:
            stmt = select(func.count()).select_from(
                select(GameRecord).where(
                    GameRecord.result.isnot(None),
                ).subquery()
            )
            result = await self.session.execute(stmt)
            total_games = result.scalar() or 0

            if total_games < 20:
                return False, f"历史数据不足：当前仅有 {total_games} 局记录，AI 学习需要至少 20 局数据。"
            if total_games > 1000:
                return False, f"历史数据超出上限：当前有 {total_games} 局记录，AI 学习支持最多 1000 局，请先清理或归档历史数据。"
        else:
            stmt = select(func.count()).select_from(
                select(GameRecord).where(
                    GameRecord.boot_number == boot_number,
                    GameRecord.result.isnot(None),
                ).subquery()
            )
            result = await self.session.execute(stmt)
            total_games = result.scalar() or 0

            if total_games < 200:
                return False, f"总历史数据不足：当前仅有 {total_games} 局记录，AI 学习需要至少 200 局数据。"
            if total_games > 1000:
                return False, f"总历史数据超出上限：当前有 {total_games} 局记录，AI 学习支持最多 1000 局，请先清理或归档历史数据。"
        
        # 3. 检查版本数量限制
        version_stmt = select(func.count()).select_from(
            select(ModelVersion).where(
                ModelVersion.is_eliminated is False,
                ModelVersion.prediction_mode == prediction_mode,
            ).subquery()
        )
        ver_result = await self.session.execute(version_stmt)
        active_versions = ver_result.scalar() or 0
        
        if active_versions >= settings.MAX_MODEL_VERSIONS:
            return False, f"已达到最大版本数({settings.MAX_MODEL_VERSIONS})，需先淘汰旧版本"
        
        return True, "条件满足"
    
    async def start_learning(
        self,
        boot_number: int,
        prediction_mode: str = "ai",
    ) -> LearningResult:
        """
        启动AI学习任务
        
        流程：
        1. 前置条件检查
        2. 获取任务锁
        3. 收集训练数据
        4. 调用AI进行深度学习分析
        5. 创建新版本
        6. 可能淘汰旧版本
        7. 释放锁
        """
        start_time = datetime.now()
        task_id = f"{prediction_mode}:global" if boot_number == 0 else f"{prediction_mode}:boot_{boot_number}"
        
        # 步骤1：前置条件检查
        ok, reason = await self.check_preconditions(boot_number, prediction_mode)
        if not ok:
            return LearningResult(success=False, error=reason)
        
        # 步骤2：获取任务锁
        acquired = await self.acquire_lock(task_id)
        if not acquired:
            return LearningResult(success=False, error="任务锁获取失败（可能其他任务正在执行）")
        
        try:
            # 步骤3：收集训练数据
            training_data = await (self._collect_global_training_data(prediction_mode) if boot_number == 0 else self._collect_training_data(boot_number, prediction_mode))
            
            if not training_data["records"]:
                return LearningResult(success=False, error="未找到有效的训练数据")
            
            # 计算学习前准确率
            accuracy_before = self._calculate_accuracy(training_data["records"])
            
            # 步骤4：调用AI进行深度学习
            ai_analysis = await self._call_ai_for_learning(training_data, accuracy_before, prediction_mode)
            
            # 步骤5：创建新版本
            version = await self._create_model_version(
                boot_number=boot_number,
                training_data=training_data,
                ai_analysis=ai_analysis,
                accuracy_before=accuracy_before,
                prediction_mode=prediction_mode,
            )
            
            # 步骤6：检查是否需淘汰旧版本
            await self._cleanup_old_versions()
            
            duration = (datetime.now() - start_time).total_seconds()
            
            result = LearningResult(
                success=True,
                version=version.version,
                training_range=f"第{boot_number}靴",
                sample_count=len(training_data["records"]),
                accuracy_before=accuracy_before,
                accuracy_after=version.accuracy_after,
                key_changes=version.key_changes,
                learning_time=duration,
            )
            
            # 写入日志
            await self._write_log(
                event_code="LOG-AI-001",
                event_type="AI学习完成",
                event_result="成功",
                description=f"AI学习完成！版本{version.version}，样本{len(training_data['records'])}局，"
                           f"准确率{accuracy_before:.1f}%→{(version.accuracy_after or 0):.1f}%，耗时{duration:.1f}秒",
                priority=LogPriority.P2,
            )
            
            return result
            
        except Exception as e:
            logger.error(f"[AI学习] 异常: {e}", exc_info=True)
            
            await self._write_log(
                event_code="LOG-ERR-009",
                event_type="AI学习异常",
                event_result="失败",
                description=f"AI学习过程中发生异常：{str(e)}",
                category=LogCategory.WORKFLOW,
                priority=LogPriority.P1,
                is_pinned=True,
            )
            
            return LearningResult(success=False, error=str(e))
            
        finally:
            self.release_lock()
    
    async def _collect_training_data(self, boot_number: int, prediction_mode: str) -> Dict[str, Any]:
        """收集指定靴号的训练数据"""
        # 获取所有开奖记录（包括和局，和局的 predict_correct 可能为 None）
        stmt = select(GameRecord).where(
            GameRecord.boot_number == boot_number,
            GameRecord.result.isnot(None),
            ((GameRecord.predict_direction.is_(None)) | (GameRecord.prediction_mode == prediction_mode)),
        ).order_by(GameRecord.game_number)

        result = await self.session.execute(stmt)
        records = result.scalars().all()
        
        # 获取错题本记录
        mistake_stmt = select(MistakeBook).where(
            MistakeBook.boot_number == boot_number,
            MistakeBook.prediction_mode == prediction_mode,
        ).order_by(MistakeBook.game_number)
        
        m_result = await self.session.execute(mistake_stmt)
        mistakes = m_result.scalars().all()
        
        settled = [r for r in records if r.predict_correct is True or r.predict_correct is False]
        correct = sum(1 for r in settled if r.predict_correct is True)
        wrong = sum(1 for r in settled if r.predict_correct is False)

        return {
            "records": [
                {
                    "game_number": r.game_number,
                    "result": r.result,
                    "predict_direction": r.predict_direction,
                    "predict_correct": r.predict_correct,
                    "profit_loss": float(r.profit_loss) if r.profit_loss is not None else 0.0,
                }
                for r in records
            ],
            "mistakes": [
                {
                    "game_number": m.game_number,
                    "error_type": m.error_type,
                    "actual_result": m.actual_result,
                }
                for m in mistakes
            ],
            "stats": {
                "total": len(settled),
                "correct": correct,
                "wrong": wrong,
                "banker_wins": sum(1 for r in records if r.result == "庄"),
                "player_wins": sum(1 for r in records if r.result == "闲"),
                "tie_count": sum(1 for r in records if r.result == "和"),
            }
        }

    async def _collect_global_training_data(self, prediction_mode: str) -> Dict[str, Any]:
        stmt = select(GameRecord).where(
            GameRecord.result.isnot(None),
            ((GameRecord.predict_direction.is_(None)) | (GameRecord.prediction_mode == prediction_mode)),
        ).order_by(GameRecord.id.desc()).limit(1000)
        result = await self.session.execute(stmt)
        records_desc = result.scalars().all()
        records = list(reversed(records_desc))

        mistake_stmt = select(MistakeBook).where(
            MistakeBook.prediction_mode == prediction_mode,
        ).order_by(MistakeBook.id.desc()).limit(200)
        m_result = await self.session.execute(mistake_stmt)
        mistakes_desc = m_result.scalars().all()
        mistakes = list(reversed(mistakes_desc))

        settled = [r for r in records if r.predict_correct is True or r.predict_correct is False]
        correct = sum(1 for r in settled if r.predict_correct is True)
        wrong = sum(1 for r in settled if r.predict_correct is False)

        return {
            "records": [
                {
                    "boot_number": r.boot_number,
                    "game_number": r.game_number,
                    "result": r.result,
                    "predict_direction": r.predict_direction,
                    "predict_correct": r.predict_correct,
                    "profit_loss": float(r.profit_loss) if r.profit_loss is not None else 0.0,
                }
                for r in records
            ],
            "mistakes": [
                {
                    "boot_number": m.boot_number,
                    "game_number": m.game_number,
                    "error_type": m.error_type,
                    "actual_result": m.actual_result,
                }
                for m in mistakes
            ],
            "stats": {
                "total": len(settled),
                "correct": correct,
                "wrong": wrong,
                "banker_wins": sum(1 for r in records if r.result == "庄"),
                "player_wins": sum(1 for r in records if r.result == "闲"),
                "tie_count": sum(1 for r in records if r.result == "和"),
            },
        }
    
    def _calculate_accuracy(self, records: List[Dict]) -> float:
        """计算当前数据集的预测准确率"""
        if not records:
            return 0.0
        settled = [r for r in records if r.get("predict_correct") is True or r.get("predict_correct") is False]
        if not settled:
            return 0.0
        correct = sum(1 for r in settled if r.get("predict_correct") is True)
        return correct / len(settled) * 100
    
    async def _call_ai_for_learning(self, training_data: Dict, current_accuracy: float, prediction_mode: str) -> Dict:
        """
        调用 Claude API 进行深度学习分析
        
        让AI分析历史数据的模式、错误规律，
        并给出优化建议和新策略参数。
        """
        stats = training_data["stats"]
        mistakes = training_data["mistakes"]
        
        # 构建学习提示词
        prompt = f"""你是一个百家乐游戏分析专家。请根据以下历史数据进行深度学习分析。

## 当前状态
- 本靴总局数：{stats['total']} 局
- 预测正确：{stats['correct']} 局 ({stats['correct']/max(stats['total'],1)*100:.1f}%)
- 预测错误：{stats['wrong']} 局
- 庄出现：{stats['banker_wins']} 次 | 闲出现：{stats['player_wins']} 次 | 和局：{stats['tie_count']} 次
- 当前综合准确率：{current_accuracy:.1f}%

## 最近开奖记录（全靴完整数据）
{json.dumps(jsonable_encoder(training_data['records'][-80:]), ensure_ascii=False, indent=2)}

## 错误案例（错题本）
{json.dumps(jsonable_encoder(mistakes[-40:]), ensure_ascii=False, indent=2)}

## 请输出以下JSON格式分析结果：
{{
    "pattern_summary": "发现的主要模式（如连庄型/跳转型/震荡型等）",
    "error_patterns": "错误发生的规律总结",
    "strategy_adjustments": [
        {{"factor": "调整因素", "change": "具体调整内容", "reasoning": "调整原因"}}
    ],
    "confidence_threshold_recommendation": "建议的置信度阈值调整",
    "key_insight": "最关键的一个发现或洞察",
    "expected_improvement": "预期的准确率提升幅度估计"
}}
        
请直接输出JSON，不要添加任何其他文字。"""
        
        try:
            content = await self._call_llm(prompt, prediction_mode)

            try:
                json_match = re.search(r"\{[\s\S]*\}", content)
                if json_match:
                    analysis = json.loads(json_match.group())
                    return analysis
            except json.JSONDecodeError:
                pass

            return {"raw_response": content}
                
        except Exception as e:
            logger.error(f"[AI学习] 深度学习引擎调用失败: {e}")
            raise

    async def _call_llm(self, prompt: str, prediction_mode: str) -> str:
        if prediction_mode == "single_ai":
            from app.services.single_model_service import SingleModelService
            svc = SingleModelService()
            return await svc._call_raw(prompt)

        from app.core.config import settings
        from app.services.three_model_service import AnthropicClient, OpenAIClient, GeminiClient

        if settings.ANTHROPIC_API_KEY and len(settings.ANTHROPIC_API_KEY) > 10:
            client = AnthropicClient(
                api_key=settings.ANTHROPIC_API_KEY,
                model=getattr(settings, "ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022"),
                base_url=getattr(settings, "ANTHROPIC_API_BASE", None),
            )
            return await client.call(prompt)

        if settings.OPENAI_API_KEY and len(settings.OPENAI_API_KEY) > 10:
            client = OpenAIClient(
                api_key=settings.OPENAI_API_KEY,
                model=getattr(settings, "OPENAI_MODEL", "gpt-4o-mini"),
                base_url=getattr(settings, "OPENAI_API_BASE", None) or "https://api.openai.com/v1/chat/completions",
            )
            return await client.call(prompt)

        if settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY) > 10:
            base_url = getattr(settings, "GEMINI_API_BASE", None)
            client = GeminiClient(
                api_key=settings.GEMINI_API_KEY,
                model=getattr(settings, "GEMINI_MODEL", "gemini-1.5-flash"),
                base_url=base_url,
            )
            return await client.call(prompt)

        raise RuntimeError("未配置3AI模式接口密钥，无法启动深度学习")
    
    async def _create_model_version(
        self,
        boot_number: int,
        training_data: Dict,
        ai_analysis: Dict,
        accuracy_before: float,
        prediction_mode: str,
    ) -> ModelVersion:
        """创建新模型版本"""
        
        # 版本号规则：v日期序号
        date_str = datetime.now().strftime("%Y%m%d")
        mode_tag = "ai" if prediction_mode == "ai" else "single"
        
        # 获取当天已有的版本数量
        stmt = select(func.count(ModelVersion)).where(
            ModelVersion.version.like(f"{mode_tag}-v{date_str}-%"),
            ModelVersion.prediction_mode == prediction_mode,
        )
        result = await self.session.execute(stmt)
        count = result.scalar() or 0
        
        version_name = f"{mode_tag}-v{date_str}-{count + 1}"
        
        # 提取关键变化摘要
        adjustments = ai_analysis.get("strategy_adjustments", [])
        key_changes = "; ".join([
            f"{adj.get('change', '')}" for adj in adjustments[:3]
        ]) if adjustments else ai_analysis.get("key_insight", "策略优化")
        
        prompt_template = self._generate_optimized_prompt_template(ai_analysis, key_changes, prediction_mode)
        
        # 构建三级记忆内容
        short_term, medium_term, long_term = await self._build_tiered_memory(
            boot_number, ai_analysis, training_data, prediction_mode
        )
        
        await self.session.execute(
            update(ModelVersion).where(
                ModelVersion.is_active == True,
                ModelVersion.prediction_mode == prediction_mode,
            ).values(is_active=False)
        )

        # 创建版本记录
        version = ModelVersion(
            version=version_name,
            prediction_mode=prediction_mode,
            created_at=datetime.now(),
            training_range=f"Boot#{boot_number} ({len(training_data['records'])} samples)",
            training_sample_count=len(training_data["records"]),
            accuracy_before=accuracy_before,
            accuracy_after=accuracy_before,  # AI学习后准确率由实际数据决定
            key_changes=key_changes[:500],  # 截断过长内容
            prompt_template=prompt_template,  # 学习后的提示词模板
            short_term_memory=short_term,  # 短期记忆（当前靴）
            medium_term_memory=medium_term,  # 中期记忆（最近5靴）
            long_term_memory=long_term,  # 长期记忆（所有历史）
            is_active=True,
        )
        
        self.session.add(version)
        await self.session.commit()
        await self.session.refresh(version)
        
        logger.info(f"[AI学习] 新版本创建: {version_name}")
        return version
    
    async def _build_tiered_memory(
        self,
        current_boot: int,
        ai_analysis: Dict,
        training_data: Dict,
        prediction_mode: str,
    ) -> tuple[str, str, str]:
        """
        构建三级记忆
        
        - 短期记忆：当前靴的关键模式、错误热点、即时教训
        - 中期记忆：最近5靴的共性规律、模式演变、策略调整
        - 长期记忆：所有历史数据中的深层规律、核心洞察、永恒原则
        """
        # 1. 短期记忆：当前靴的具体教训
        short_term_patterns = ai_analysis.get("pattern_summary", "")
        short_term_errors = ai_analysis.get("error_patterns", "")
        short_term_insight = ai_analysis.get("key_insight", "")
        
        short_term = f"""【当前靴(#{current_boot})核心记忆】
模式发现：{short_term_patterns[:300]}
错误热点：{short_term_errors[:300]}
关键洞察：{short_term_insight[:300]}
样本数：{len(training_data['records'])}局
准确率：{training_data['stats'].get('correct', 0)}/{training_data['stats'].get('total', 0)}"""
        
        # 2. 中期记忆：最近5靴的共性规律
        # 获取最近5靴的数据
        recent_boots_stmt = select(GameRecord).where(
            GameRecord.boot_number >= current_boot - 4,
            GameRecord.boot_number <= current_boot,
            GameRecord.predict_correct.isnot(None),
            GameRecord.prediction_mode == prediction_mode,
        )
        result = await self.session.execute(recent_boots_stmt)
        recent_records = result.scalars().all()
        
        if recent_records:
            recent_correct = sum(1 for r in recent_records if r.predict_correct)
            recent_total = len(recent_records)
            recent_accuracy = recent_correct / recent_total * 100 if recent_total > 0 else 0
            
            # 统计各靴表现
            boot_stats = {}
            for r in recent_records:
                boot_stats[r.boot_number] = boot_stats.get(r.boot_number, {"correct": 0, "total": 0})
                boot_stats[r.boot_number]["total"] += 1
                if r.predict_correct:
                    boot_stats[r.boot_number]["correct"] += 1
            
            boot_summary = "; ".join([
                f"#{b}: {s['correct']}/{s['total']}"
                for b, s in sorted(boot_stats.items())[-5:]
            ])
            
            medium_term = f"""【最近5靴中期记忆】
时间跨度：Boot #{max(0, current_boot-4)} - #{current_boot}
总体表现：{recent_correct}/{recent_total} ({recent_accuracy:.1f}%)
各靴表现：{boot_summary}
趋势判断：{'上升' if recent_accuracy > 50 else '下降' if recent_accuracy < 40 else '震荡'}
共性规律：{ai_analysis.get('pattern_summary', '分析中')[:300]}"""
        else:
            medium_term = "【最近5靴中期记忆】数据不足，待积累"
        
        # 3. 长期记忆：所有历史的深层规律
        all_time_stmt = select(func.count()).select_from(
            select(GameRecord).where(
                GameRecord.predict_correct.isnot(None),
                GameRecord.prediction_mode == prediction_mode,
            ).subquery()
        )
        result = await self.session.execute(all_time_stmt)
        total_all_time = result.scalar() or 0
        
        # 获取所有历史版本的平均准确率
        version_stmt = select(func.avg(ModelVersion.overall_accuracy)).where(
            ModelVersion.overall_accuracy.isnot(None),
            ModelVersion.prediction_mode == prediction_mode,
        )
        result = await self.session.execute(version_stmt)
        avg_accuracy = result.scalar() or 0
        
        # 统计最常见的错误维度
        error_dim_stmt = select(AIMemory.error_dimension, func.count()).where(
            AIMemory.error_dimension.isnot(None),
            AIMemory.prediction_mode == prediction_mode,
        ).group_by(AIMemory.error_dimension).order_by(desc(func.count())).limit(3)
        result = await self.session.execute(error_dim_stmt)
        top_errors = result.all()
        
        error_summary = ", ".join([f"{dim}({cnt})" for dim, cnt in top_errors]) if top_errors else "暂无数据"
        
        long_term = f"""【长期历史记忆】
累计样本：{total_all_time}局
历史平均准确率：{avg_accuracy:.1f}%
常见错误类型：{error_summary}
核心原则：规律会突然中断，血迹是陷阱警告，灵活应变是关键
永恒教训：不要过度自信，保持敬畏，随时准备调整策略"""
        
        return short_term, medium_term, long_term

    def _generate_optimized_prompt_template(self, ai_analysis: Dict, key_changes: str, prediction_mode: str) -> str:
        """
        基于AI学习结果生成优化后的提示词模板
        
        这个模板会被综合模型使用，包含学习后的策略优化
        """
        pattern_summary = ai_analysis.get("pattern_summary", "")
        error_patterns = ai_analysis.get("error_patterns", "")
        confidence_threshold = ai_analysis.get("confidence_threshold_recommendation", "保持默认")
        key_insight = ai_analysis.get("key_insight", "")
        
        if prediction_mode == "single_ai":
            template = f"""你是百家乐分析预测引擎（单AI模式 - 学习优化版）。你必须基于全量历史局与全量五路走势做出下一局庄/闲预测。

【学习优化内容 - 基于深度学习生成】
- 本版本关键优化：{key_changes}
- 发现的模式规律：{pattern_summary}
- 错误模式总结：{error_patterns}
- 核心洞察：{key_insight}
- 置信度阈值建议：{confidence_threshold}

【硬性输出要求】
你必须只输出严格 JSON（不要任何额外文字），字段如下：
{{"final_prediction":"庄或闲","confidence":0-1,"bet_tier":"保守/标准/激进","summary":"一句话摘要"}}

【输入数据】
靴号：{{BOOT_NUMBER}}
局号：{{GAME_NUMBER}}
连续失准：{{CONSECUTIVE_ERRORS}}
历史：{{GAME_HISTORY}}
五路：{{ROAD_DATA}}
错题：{{MISTAKE_CONTEXT}}"""
            return template

        # 构建优化后的提示词模板
        template = f"""你是百家乐分析系统的【综合决策模型 - 学习优化版】。你是最终的决策者，负责融合庄模型和闲模型的证据，结合历史错误分析，输出最终预测。

【学习优化内容 - 基于深度学习生成】
- 本版本关键优化：{key_changes}
- 发现的模式规律：{pattern_summary}
- 错误模式总结：{error_patterns}
- 核心洞察：{key_insight}
- 置信度阈值建议：{confidence_threshold}

【你的独特职责 - 只有你需要做这些】

1. **你是唯一需要理解血迹的模型**
   - 庄模型和闲模型只负责找证据，它们不知道历史哪里错了
   - 只有你能看到完整的"陷阱地图"（血迹标记分布）
   - 你必须分析：错误集中在哪些区域？当前位置是否在危险区？

2. **你是唯一需要做预测的模型**
   - 庄模型只输出庄向证据
   - 闲模型只输出闲向证据  
   - 你负责对比双方证据，做出最终预测决策

3. **你是唯一需要灵活应变的模型**
   - 识别规律期vs混沌期
   - 知道什么时候该变，什么时候该跟
   - 根据连续错误次数动态调整策略

【核心认知 - 必须深刻理解】

**1. 五路带血迹的完整2D走势图**
- 你面对的不是孤立的数据点，而是一张完整的2D走势图系统
- 大路是主趋势，珠盘路是原始记录，下三路是规律节奏
- 血迹标记(error_id)是历史预测错误的可视化记录，是"陷阱地图"
- **你的任务：读懂这张地图，避开陷阱**

**2. 血迹分析 - 你的专属武器**
- 血迹表示该局AI预测错误
- 观察血迹分布模式：
  * 血迹集中在哪些路？（大路？下三路？）
  * 血迹出现的位置有什么规律？（列首？列尾？特定高度？）
  * 血迹后的走势发生了什么变化？（规律中断？继续延续？）
- 当前位置附近是否有血迹？（是否处于危险区？）

**3. 百家乐的本质：随机中的短暂规律**
- 每一局的开奖结果是100%完全随机的
- 但随机也能随机出短暂的走势图规律
- 这些规律可能出现在任意一条路上
- **关键：这些规律会突然中断，没有任何预警！**

**4. 灵活应变的艺术**
- 识别"规律期"（各路共振，信号一致）→ 可以跟随
- 识别"混沌期"（各路冲突，信号混乱）→ 必须谨慎
- **知道什么时候该变，什么时候该跟，是你的核心能力**

**5. 复盘与推演**
- 观察血迹标记的分布：错误集中在哪些区域？
- 推演：如果历史重演，当前位置会触发什么结果？
- 反思：庄闲模型的证据冲突点在哪里？哪一方更可能正确？

【输入数据】

庄模型分析结果（庄向证据）：
{{banker_result}}

闲模型分析结果（闲向证据）：
{{player_result}}

最近20局历史：
{{history}}

走势图可视化（含血迹标记）：
{{road_visual}}

历史错误分析（错题本）：
{{mistake_str}}

连续失准次数：{{consecutive_errors}}
{{tier_note}}

【你的决策框架 - 四步法】

**第一步：证据对比**
- 比较庄模型和闲模型的信号强度
- 比较两方的置信度
- 找出证据冲突的关键点

**第二步：血迹分析（你的专属步骤）**
- 观察血迹标记的分布模式
- 判断当前位置是否处于历史错误高发区
- 分析血迹后的走势变化规律
- 评估：历史错误是否会重演？

**第三步：规律识别**
- 判断当前处于"规律期"还是"混沌期"
- 观察各路是否形成共振
- 识别规律可能中断的信号

**第四步：灵活决策**
- 规律期 + 信号共振 + 无血迹警告 → 进取
- 规律期 + 信号冲突 或 有血迹警告 → 标准或保守
- 混沌期 或 连续错误 → 必须保守
- 血迹密集区域 → 强制保守，甚至观望

【风险控制铁律】
- 连续3局错误 → 强制保守策略
- 血迹密集区域 → 提高警惕，降低仓位
- 各路严重冲突 → 降低置信度
- 当前位置紧邻血迹 → 谨慎下注

请严格按以下JSON格式返回最终决策，不要输出其他内容：
{{
    "evidence_comparison": "庄闲证据对比结论（20字以内）",
    "bloodstain_analysis": "血迹分布分析（25字以内）",
    "pattern_assessment": "规律期/混沌期判断（15字以内）",
    "adaptation_strategy": "灵活应变策略（20字以内）",
    "final_prediction": "庄或闲（只能选一个）",
    "confidence": 0.0到1.0之间的数字,
    "bet_tier": "保守/标准/进取",
    "summary": "证据对比显示{{结论}}，血迹分析显示{{分析}}，当前处于{{规律判断}}，{{应变策略}}，所以按{{档位}}预测{{庄/闲}}"
}}

【输出规范】
1. final_prediction只能输出"庄"或"闲"
2. 连续3局失准时bet_tier必须为"保守"
3. summary必须包含：证据对比、血迹分析、规律判断、应变策略
4. 要体现"读懂血迹地图、灵活应变"的思维
5. 理解：规律会突然中断，血迹是陷阱警告，要随时准备调整"""
        
        return template

    async def _cleanup_old_versions(self):
        """清理旧版本（超过5个时淘汰最旧的活跃版本）"""
        stmt = select(ModelVersion).where(
            ModelVersion.is_eliminated is False
        ).order_by(ModelVersion.created_at)
        
        result = await self.session.execute(stmt)
        versions = result.scalars().all()
        
        if len(versions) > settings.MAX_MODEL_VERSIONS:
            # 淘汰最旧的版本
            to_eliminate = versions[-(len(versions) - settings.MAX_MODEL_VERSIONS):]
            for old_version in to_eliminate:
                old_version.is_eliminated = True
                logger.info(f"[AI学习] 淘汰旧版本: {old_version.version}")
            
            await self.session.commit()
    
    async def get_learning_status(self) -> Dict:
        """获取当前学习状态"""
        return {
            "is_learning": AILearningService._is_learning,
            "current_task": AILearningService._current_task,
            "min_samples": getattr(settings, 'MIN_SAMPLE_FOR_LEARNING', 20),
            "max_versions": getattr(settings, 'MAX_MODEL_VERSIONS', 10),
        }
    
    async def select_best_version(self) -> Optional[ModelVersion]:
        """
        智能选择最佳模型版本
        
        评分算法：
        - 最近3靴命中率 × 0.4
        - 整体命中率 × 0.2
        - 收益稳定性 × 0.2
        - 学习次数（经验值）× 0.1
        - 用户评分 × 0.1
        """
        stmt = select(ModelVersion).where(
            ModelVersion.is_eliminated is False
        ).order_by(desc(ModelVersion.created_at))
        
        result = await self.session.execute(stmt)
        versions = result.scalars().all()
        
        if not versions:
            return None
        
        # 计算每个版本的智能评分
        scored_versions = []
        for v in versions:
            score = self._calculate_intelligence_score(v)
            scored_versions.append((v, score))
            
            # 更新版本的智能评分
            v.intelligence_score = score
        
        await self.session.commit()
        
        # 按评分排序，返回最高分版本
        scored_versions.sort(key=lambda x: x[1], reverse=True)
        best_version = scored_versions[0][0]
        
        # 激活最佳版本
        for v in versions:
            v.is_active = (v.id == best_version.id)
        
        await self.session.commit()
        
        logger.info(f"[版本选择] 最佳版本: {best_version.version}, 评分: {scored_versions[0][1]:.2f}")
        return best_version
    
    def _calculate_intelligence_score(self, version: ModelVersion) -> float:
        """计算版本智能评分"""
        # 最近3靴命中率 (40%)
        recent_acc = version.recent_3_boot_accuracy or 0
        
        # 整体命中率 (20%)
        overall_acc = version.overall_accuracy or 0
        
        # 收益稳定性 - 使用回撤控制评分 (20%)
        stability = version.drawdown_control_score or 50
        
        # 学习次数/经验值 (10%) - 最多100次满分为10
        experience = min(version.learning_count or 0, 100) / 10
        
        # 用户评分 (10%) - 0-10分
        user_rating = version.user_rating or 5
        
        # 加权计算
        score = (
            recent_acc * 0.4 +
            overall_acc * 0.2 +
            stability * 0.2 +
            experience * 0.1 +
            user_rating * 10 * 0.1  # 转换为0-100分制
        )
        
        return min(score, 100)  # 最高100分
    
    async def update_version_performance(self, version_id: str, is_hit: bool):
        """更新版本性能统计"""
        stmt = select(ModelVersion).where(ModelVersion.version == version_id)
        result = await self.session.execute(stmt)
        version = result.scalar_one_or_none()
        
        if not version:
            return
        
        version.total_runs += 1
        if is_hit:
            version.hit_count += 1
            version.recent_boots_hit += 1
        
        version.recent_boots_total += 1
        
        # 更新整体准确率
        if version.total_runs > 0:
            version.overall_accuracy = version.hit_count / version.total_runs * 100
        
        # 更新最近3靴准确率
        if version.recent_boots_total > 0:
            version.recent_3_boot_accuracy = version.recent_boots_hit / version.recent_boots_total * 100
        
        await self.session.commit()
    
    async def micro_learning(
        self,
        boot_number: int,
        game_number: int,
        version_id: str,
        prediction: str,
        actual_result: str,
        is_correct: bool,
        confidence: float,
        road_data: Dict,
        banker_evidence: Dict,
        player_evidence: Dict,
        prediction_mode: str = "ai",
    ) -> Dict:
        """
        局级微学习 - 每局结算后自动触发
        
        轻量级分析，不创建新版本，只记录到AI记忆
        """
        try:
            # 1. 深度错误分析（如果错了）
            error_analysis = None
            self_reflection = None
            
            if not is_correct:
                error_analysis = await self._analyze_error_deep(
                    boot_number, game_number,
                    prediction, actual_result,
                    banker_evidence, player_evidence, road_data,
                    prediction_mode=prediction_mode,
                )
                
                # 2. 自我反思
                self_reflection = await self._self_reflection(
                    prediction, actual_result, error_analysis, road_data,
                    prediction_mode=prediction_mode,
                )
            
            # 3. 记录到AI记忆
            memory = AIMemory(
                boot_number=boot_number,
                game_number=game_number,
                version_id=version_id,
                prediction_mode=prediction_mode if prediction_mode in ("ai", "single_ai") else None,
                prediction=prediction,
                actual_result=actual_result,
                is_correct=is_correct,
                confidence=confidence,
                error_type=error_analysis.get("error_type") if error_analysis else None,
                error_dimension=error_analysis.get("dimension") if error_analysis else None,
                error_analysis=json.dumps(jsonable_encoder(error_analysis), ensure_ascii=False) if error_analysis else None,
                self_reflection=self_reflection.get("reflection") if self_reflection else None,
                would_do_differently=self_reflection.get("would_do_differently") if self_reflection else None,
                lesson_learned=self_reflection.get("lesson") if self_reflection else None,
                road_snapshot=json.dumps(jsonable_encoder(road_data), ensure_ascii=False) if road_data else None,
            )
            
            self.session.add(memory)
            await self.session.commit()
            
            # 如果是预测错误导致的微学习，记录到系统日志
            if not is_correct and self_reflection:
                await write_game_log(
                    session=self.session,
                    boot_number=boot_number,
                    game_number=game_number,
                    event_code="LOG-AI-003",
                    event_type="AI微学习",
                    event_result="成功",
                    description=f"第{game_number}局预测失准，AI已完成深度复盘并生成短期记忆。反思: {self_reflection.get('lesson', '调整策略模型')}。",
                    category="AI事件",
                    priority="P2"
                )

            # 4. 更新版本性能
            await self.update_version_performance(version_id, is_correct)
            
            return {
                "success": True,
                "memory_id": memory.id,
                "error_analyzed": error_analysis is not None,
                "self_reflection": self_reflection is not None,
            }
            
        except Exception as e:
            logger.error(f"[微学习] 失败: {e}")
            return {"success": False, "error": str(e)}
    
    async def _analyze_error_deep(
        self,
        boot_number: int,
        game_number: int,
        prediction: str,
        actual_result: str,
        banker_evidence: Dict,
        player_evidence: Dict,
        road_data: Dict,
        prediction_mode: str = "ai",
    ) -> Dict:
        """
        深度错误分析 - 5维度
        
        1. 证据误判
        2. 血迹盲区
        3. 规律误判
        4. 权重失衡
        5. 其他
        """
        # 构建分析提示词
        prompt = f"""你是一个百家乐错误分析专家。请深度分析这局预测错误的原因。

预测信息：
- 预测结果：{prediction}
- 实际结果：{actual_result}
- 错误类型：预测{prediction}但实际开{actual_result}

庄模型证据：
{json.dumps(jsonable_encoder(banker_evidence), ensure_ascii=False, indent=2)}

闲模型证据：
{json.dumps(jsonable_encoder(player_evidence), ensure_ascii=False, indent=2)}

五路走势图：
{json.dumps(jsonable_encoder(road_data), ensure_ascii=False, indent=2)}

请从以下5个维度分析错误原因，返回JSON格式：
{{
    "dimension": "错误维度（证据误判/血迹盲区/规律误判/权重失衡/其他）",
    "error_type": "具体错误类型",
    "analysis": "详细分析（100字以内）",
    "root_cause": "根本原因",
    "avoidance_strategy": "下次如何避免"
}}

维度说明：
- 证据误判：庄或闲模型过度自信，信号强但结果相反
- 血迹盲区：忽略了关键血迹警告，或血迹模式识别错误
- 规律误判：规律期判断为混沌期，或混沌期判断为规律期
- 权重失衡：过度依赖某一路（如过度看大路忽略下三路）
- 其他：不属于以上类别"""

        try:
            content = await self._call_llm(prompt, prediction_mode)
            json_match = re.search(r"\{[\s\S]*\}", content)
            if json_match:
                return json.loads(json_match.group())
            raise ValueError(f"AI返回格式错误，无法解析JSON: {content[:200]}")
                
        except Exception as e:
            logger.error(f"[错误分析] 失败: {e}")
            raise
    
    async def _self_reflection(
        self,
        prediction: str,
        actual_result: str,
        error_analysis: Dict,
        road_data: Dict,
        prediction_mode: str = "ai",
    ) -> Dict:
        """
        AI自我反思
        
        回答5个问题：
        1. 这局我为什么错了？
        2. 如果重来，我会怎么判断？
        3. 这个错误属于哪种类型？
        4. 我以后遇到类似情况该怎么办？
        5. 我的提示词哪里需要调整？
        """
        prompt = f"""你是百家乐AI综合决策模型。请对这局预测错误进行自我反思。

错误信息：
- 预测：{prediction}
- 实际：{actual_result}
- 错误分析：{json.dumps(jsonable_encoder(error_analysis), ensure_ascii=False)}

请回答以下5个问题，返回JSON格式：
{{
    "reflection": "这局我为什么错了？（50字以内）",
    "would_do_differently": "如果重来，我会怎么判断？（50字以内）",
    "error_category": "这个错误属于哪种类型？",
    "future_strategy": "以后遇到类似情况该怎么办？（50字以内）",
    "prompt_adjustment": "我的提示词哪里需要调整？（50字以内）",
    "lesson": "学到的核心教训（30字以内）"
}}"""

        try:
            content = await self._call_llm(prompt, prediction_mode)
            json_match = re.search(r"\{[\s\S]*\}", content)
            if json_match:
                return json.loads(json_match.group())
            raise ValueError(f"AI返回格式错误，无法解析JSON: {content[:200]}")
                
        except Exception as e:
            logger.error(f"[自我反思] 失败: {e}")
            raise
    
    async def _write_log(self, **kwargs):
        """写入日志"""
        log = SystemLog(
            log_time=datetime.now(),
            event_code=kwargs.get("event_code", ""),
            event_type=kwargs.get("event_type", ""),
            event_result=kwargs.get("event_result", ""),
            description=kwargs.get("description", ""),
            category=kwargs.get("category", LogCategory.WORKFLOW),
            priority=kwargs.get("priority", LogPriority.P3),
            source_module="AI学习模块",
            is_pinned=kwargs.get("is_pinned", False),
            retention_tier="cold_perm" if kwargs.get("priority") == LogPriority.P1 else "warm30",
        )
        self.session.add(log)
        await self.session.commit()
