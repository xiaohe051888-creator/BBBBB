"""
AI学习与模型版本管理服务 - 百家乐分析预测系统

核心功能：
1. AI离线学习：基于数据库历史数据，通过Claude API深度学习生成新模型版本
2. 模型版本管理：创建/淘汰/切换模型版本（最多5个）
3. 学习任务锁：防止重复触发
4. 按靴学习：单次学习仅使用一个桌号+靴号的数据

触发方式：管理员手动触发
前置条件：
- 数据库历史有效局总量 >= 200局
- 无正在执行的学习任务
- 仅按靴执行，不跨靴混合样本

输出：
- 新模型版本号
- 训练数据范围和关键变化
- 准确率前后对比
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_

from app.core.config import settings
from app.models.schemas import (
    GameRecord, ModelVersion, MistakeBook,
    LogPriority, LogCategory, SystemLog,
)

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
    _current_task: Optional[str] = None  # 当前学习任务标识 (tableId_bootNumber)
    
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
    
    async def check_preconditions(self, table_id: str, boot_number: int) -> tuple[bool, str]:
        """
        检查学习前置条件
        
        返回: (是否满足条件, 不满足原因)
        """
        # 1. 检查任务锁
        if self.is_busy():
            return False, f"有学习任务正在执行中: {self._current_task}"
        
        # 2. 检查最低样本数
        stmt = select(func.count()).select_from(
            select(GameRecord).where(
                GameRecord.table_id == table_id,
                GameRecord.boot_number == boot_number,
                GameRecord.predict_correct.isnot(None),  # 仅有效结算局
            ).subquery()
        )
        result = await self.session.execute(stmt)
        total_games = result.scalar() or 0
        
        if total_games < settings.MIN_SAMPLE_FOR_LEARNING:
            return False, f"有效结算局不足：当前{total_games}局，需要至少{settings.MIN_SAMPLE_FOR_LEARNING}局"
        
        # 3. 检查版本数量限制
        version_stmt = select(func.count()).select_from(
            select(ModelVersion).where(ModelVersion.is_eliminated == False).subquery()
        )
        ver_result = await self.session.execute(version_stmt)
        active_versions = ver_result.scalar() or 0
        
        if active_versions >= settings.MAX_MODEL_VERSIONS:
            return False, f"已达到最大版本数({settings.MAX_MODEL_VERSIONS})，需先淘汰旧版本"
        
        return True, "条件满足"
    
    async def start_learning(
        self,
        table_id: str,
        boot_number: int,
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
        task_id = f"{table_id}_boot{boot_number}"
        
        # 步骤1：前置条件检查
        ok, reason = await self.check_preconditions(table_id, boot_number)
        if not ok:
            return LearningResult(success=False, error=reason)
        
        # 步骤2：获取任务锁
        acquired = await self.acquire_lock(task_id)
        if not acquired:
            return LearningResult(success=False, error="任务锁获取失败（可能其他任务正在执行）")
        
        try:
            # 步骤3：收集训练数据
            training_data = await self._collect_training_data(table_id, boot_number)
            
            if not training_data["records"]:
                return LearningResult(success=False, error="未找到有效的训练数据")
            
            # 计算学习前准确率
            accuracy_before = self._calculate_accuracy(training_data["records"])
            
            # 步骤4：调用AI进行深度学习
            ai_analysis = await self._call_ai_for_learning(training_data, accuracy_before)
            
            # 步骤5：创建新版本
            version = await self._create_model_version(
                table_id=table_id,
                boot_number=boot_number,
                training_data=training_data,
                ai_analysis=ai_analysis,
                accuracy_before=accuracy_before,
            )
            
            # 步骤6：检查是否需淘汰旧版本
            await self._cleanup_old_versions()
            
            duration = (datetime.now() - start_time).total_seconds()
            
            result = LearningResult(
                success=True,
                version=version.version,
                training_range=f"{table_id} 第{boot_number}靴",
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
    
    async def _collect_training_data(self, table_id: str, boot_number: int) -> Dict[str, Any]:
        """收集指定桌号+靴号的训练数据"""
        # 获取所有开奖记录（含预测结果）
        stmt = select(GameRecord).where(
            GameRecord.table_id == table_id,
            GameRecord.boot_number == boot_number,
            GameRecord.predict_correct.isnot(None),
        ).order_by(GameRecord.game_number)
        
        result = await self.session.execute(stmt)
        records = result.scalars().all()
        
        # 获取错题本记录
        mistake_stmt = select(MistakeBook).where(
            MistakeBook.table_id == table_id,
            MistakeBook.boot_number == boot_number,
        ).order_by(MistakeBook.game_number)
        
        m_result = await self.session.execute(mistake_stmt)
        mistakes = m_result.scalars().all()
        
        return {
            "records": [
                {
                    "game_number": r.game_number,
                    "result": r.result,
                    "predict_direction": r.predict_direction,
                    "predict_correct": r.predict_correct,
                    "profit_loss": r.profit_loss,
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
                "total": len(records),
                "correct": sum(1 for r in records if r.predict_correct),
                "wrong": sum(1 for r in records if not r.predict_correct),
                "banker_wins": sum(1 for r in records if r.result == "庄"),
                "player_wins": sum(1 for r in records if r.result == "闲"),
                "tie_count": sum(1 for r in records if r.result == "和"),
            }
        }
    
    def _calculate_accuracy(self, records: List[Dict]) -> float:
        """计算当前数据集的预测准确率"""
        if not records:
            return 0.0
        correct = sum(1 for r in records if r.get("predict_correct"))
        return correct / len(records) * 100
    
    async def _call_ai_for_learning(self, training_data: Dict, current_accuracy: float) -> Dict:
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

## 最近20条开奖记录
{json.dumps(training_data['records'][-20:], ensure_ascii=False, indent=2)}

## 错误案例（共{len(mistakes)}条）
{json.dumps(mistakes[:15], ensure_ascii=False, indent=2)}

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
        
        # 调用 Claude API
        try:
            import httpx
            
            api_key = settings.ANTHROPIC_API_KEY
            if not api_key:
                raise ValueError("未配置Anthropic API Key（ANTHROPIC_API_KEY），无法执行AI学习")
            
            async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.ANTHROPIC_MODEL,
                        "max_tokens": 2000,
                        "messages": [{"role": "user", "content": prompt}],
                    }
                )
                response.raise_for_status()
                
                data = response.json()
                content = data["content"][0]["text"]
                
                # 解析AI返回的JSON
                try:
                    # 提取JSON部分
                    json_match = re.search(r'\{[\s\S]*\}', content)
                    if json_match:
                        analysis = json.loads(json_match.group())
                        return analysis
                except json.JSONDecodeError:
                    pass
                
                # JSON解析失败时返回原始文本
                return {"raw_response": content}
                
        except Exception as e:
            logger.error(f"[AI学习] Claude API调用失败: {e}")
            raise
    
    async def _create_model_version(
        self,
        table_id: str,
        boot_number: int,
        training_data: Dict,
        ai_analysis: Dict,
        accuracy_before: float,
    ) -> ModelVersion:
        """创建新模型版本"""
        
        # 版本号规则：v日期序号
        date_str = datetime.now().strftime("%Y%m%d")
        
        # 获取当天已有的版本数量
        stmt = select(func.count(ModelVersion)).where(
            ModelVersion.version.like(f"{date_str}%")
        )
        result = await self.session.execute(stmt)
        count = result.scalar() or 0
        
        version_name = f"v{date_str}-{count + 1}"
        
        # 提取关键变化摘要
        adjustments = ai_analysis.get("strategy_adjustments", [])
        key_changes = "; ".join([
            f"{adj.get('change', '')}" for adj in adjustments[:3]
        ]) if adjustments else ai_analysis.get("key_insight", "策略优化")
        
        # 创建版本记录
        version = ModelVersion(
            version=version_name,
            created_at=datetime.now(),
            training_range=f"{table_id} Boot#{boot_number} ({len(training_data['records'])} samples)",
            training_sample_count=len(training_data["records"]),
            accuracy_before=accuracy_before,
            accuracy_after=accuracy_before,  # AI学习后准确率由实际数据决定
            key_changes=key_changes[:500],  # 截断过长内容
            is_active=True,
        )
        
        self.session.add(version)
        await self.session.commit()
        await self.session.refresh(version)
        
        logger.info(f"[AI学习] 新版本创建: {version_name}")
        return version
    
    async def _cleanup_old_versions(self):
        """清理旧版本（超过5个时淘汰最旧的活跃版本）"""
        stmt = select(ModelVersion).where(
            ModelVersion.is_eliminated == False
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
            "min_samples": settings.MIN_SAMPLE_FOR_LEARNING,
            "max_versions": settings.MAX_MODEL_VERSIONS,
        }
    
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

# 导入re用于正则匹配
import re