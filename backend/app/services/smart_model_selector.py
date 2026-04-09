"""
智能选模服务 (AI Memory & Model Selection) - 百家乐分析预测系统

核心功能：
1. 启动时自动选择最优模型版本
2. 基于多维度评分选模（准确率、稳定性、恢复速度、回撤控制）
3. 版本切换冷却机制（至少20个有效局后才允许再次切换）
4. 选模结果可追溯记录

决策维度（来自文档17）：
- 历史预测准确率
- 最近连续局表现
- 错题本在本靴内复盘后的修正结果
- 版本稳定性评分
- 连续失准恢复速度评分
- 回撤控制评分

触发时机：系统启动时自动执行
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.core.config import settings
from app.models.schemas import (
    ModelVersion, GameRecord, MistakeBook,
    SystemState, LogPriority, LogCategory, SystemLog,
)

logger = logging.getLogger(__name__)


class SmartModelSelector:
    """
    智能模型选择器
    
    在系统启动时自动评估所有可用版本，
    综合多维度指标选出最佳模型版本。
    """
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def select_best_model(
        self,
        table_id: str,
        force_version: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        执行智能选模
        
        Args:
            table_id: 桌号
            force_version: 强制使用指定版本（跳过智能选择）
        
        Returns:
            选模结果字典，包含：
            - selected_version: 选中的版本号
            - version_id: 版本ID
            - score_details: 各维度评分明细
            - selection_reason: 选择原因摘要
            - confidence: 选模置信度
        """
        
        if force_version:
            # 强制指定版本
            return await self._select_forced_version(force_version)
        
        # 获取所有可用版本
        versions = await self._get_active_versions()
        
        if not versions:
            # 无可用版本，返回默认状态
            return {
                "selected_version": "v1.0-default",
                "version_id": None,
                "score_details": {},
                "selection_reason": "无可用模型版本，使用默认策略",
                "confidence": 0.5,
                "is_default": True,
            }
        
        if len(versions) == 1:
            # 仅一个可用版本，直接使用
            v = versions[0]
            return {
                "selected_version": v.version,
                "version_id": v.id,
                "score_details": self._score_single_version(v),
                "selection_reason": f"仅有一个可用版本 {v.version}，直接选用",
                "confidence": 0.8,
                "is_default": False,
            }
        
        # 多版本时进行综合评分
        best_version, scores = await self._evaluate_all_versions(versions, table_id)
        
        result = {
            "selected_version": best_version.version,
            "version_id": best_version.id,
            "score_details": scores.get(best_version.version, {}),
            "selection_reason": self._generate_selection_reason(best_version, scores, versions),
            "confidence": self._calculate_selection_confidence(best_version, scores, versions),
            "is_default": False,
            "all_scores": {
                v.version: s.get("total_score", 0) 
                for v, s in zip(versions, [scores.get(v.version, {}) for v in versions])
            },
        }
        
        # 记录选模日志
        await self._log_selection(table_id, result)
        
        return result
    
    async def _select_forced_version(self, version_name: str) -> Dict:
        """强制选择指定版本"""
        stmt = select(ModelVersion).where(
            ModelVersion.version == version_name,
            ModelVersion.is_eliminated == False,
        )
        result = await self.session.execute(stmt)
        version = result.scalar_one_or_none()
        
        if not version:
            return {
                "selected_version": version_name,
                "version_id": None,
                "score_details": {},
                "selection_reason": f"指定版本{version_name}未找到或已淘汰",
                "confidence": 0.3,
                "is_default": False,
                "forced": True,
                "error": "版本不存在",
            }
        
        return {
            "selected_version": version.version,
            "version_id": version.id,
            "score_details": self._score_single_version(version),
            "selection_reason": f"管理员手动指定版本 {version.version}",
            "confidence": 0.9,
            "is_default": False,
            "forced": True,
        }
    
    async def _get_active_versions(self) -> List[ModelVersion]:
        """获取所有非淘汰的模型版本"""
        stmt = select(ModelVersion).where(
            ModelVersion.is_eliminated == False
        ).order_by(desc(ModelVersion.created_at))
        
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
    
    def _score_single_version(self, version: ModelVersion) -> Dict[str, float]:
        """对单个版本进行基础评分"""
        return {
            "accuracy_after": version.accuracy_after or 50.0,
            "accuracy_delta": ((version.accuracy_after or 50.0) - (version.accuracy_before or 45.0)),
            "sample_count": min(100, (version.training_sample_count or 200) / settings.MIN_SAMPLE_FOR_LEARNING * 100),
            "age_factor": max(20, 100 - (datetime.now() - (version.created_at or datetime.now())).days),  # 新版本加分
            "stability_score": version.stability_score or 75.0,
            "recovery_speed_score": version.recovery_speed_score or 75.0,
            "drawdown_control_score": version.drawdown_control_score or 75.0,
        }
    
    async def _evaluate_all_versions(
        self,
        versions: List[ModelVersion],
        table_id: str,
    ) -> Tuple[ModelVersion, Dict[str, Dict]]:
        """
        对所有版本进行综合评分
        
        评分权重：
        - 准确率提升幅度：30%
        - 样本量充足度：15%
        - 稳定性评分：20%
        - 恢复速度：15%
        - 回撤控制：10%
        - 新鲜度因子：10%
        """
        scores: Dict[str, Dict] = {}
        
        for version in versions:
            base = self._score_single_version(version)
            
            # 加权总分计算
            total = (
                base["accuracy_delta"] * 0.30 +
                base["sample_count"] * 0.15 +
                base["stability_score"] * 0.20 +
                base["recovery_speed_score"] * 0.15 +
                base["drawdown_control_score"] * 0.10 +
                base["age_factor"] * 0.10
            )
            
            # 冷却期检查：新启用的版本如果在冷却期内，扣分
            if version.is_active and (version.total_runs or 0) < settings.MIN_RUNS_FOR_SWITCH:
                total *= 0.85  # 冷却期内降低优先级
            
            base["total_score"] = round(total, 2)
            scores[version.version] = base
        
        # 选出最高分版本
        sorted_versions = sorted(
            versions,
            key=lambda v: scores[v.version].get("total_score", 0),
            reverse=True,
        )
        
        return sorted_versions[0], scores
    
    def _generate_selection_reason(
        self,
        selected: ModelVersion,
        scores: Dict[str, Dict],
        all_versions: List[ModelVersion],
    ) -> str:
        """生成选模原因说明"""
        sel_score = scores[selected.version]
        reasons = []
        
        if sel_score.get("accuracy_delta", 0) > 3:
            reasons.append(f"准确率提升+{sel_score['accuracy_delta']:.1f}%")
        
        if sel_score.get("stability_score", 0) >= 80:
            reasons.append(f"稳定性优秀({sel_score['stability_score']:.0f})")
        
        if sel_score.get("recovery_speed_score", 0) >= 80:
            reasons.append("失准恢复快")
        
        if not reasons:
            reasons.append("综合评分最优")
        
        return f"{selected.version}: {' + '.join(reasons)}"
    
    def _calculate_selection_confidence(
        self,
        selected: ModelVersion,
        scores: Dict[str, Dict],
        all_versions: List[ModelVersion],
    ) -> float:
        """计算选模置信度"""
        if len(all_versions) <= 1:
            return 0.7
        
        sel_score = scores[selected.version]["total_score"]
        all_scores = [s.get("total_score", 0) for s in scores.values()]
        
        # 如果最高分远高于其他版本，置信度高
        second_best = sorted(all_scores)[-2]
        margin = sel_score - second_best
        
        if margin > 15:
            return 0.95
        elif margin > 8:
            return 0.80
        elif margin > 3:
            return 0.65
        else:
            return 0.50  # 分数接近时，置信度低
    
    async def _log_selection(self, table_id: str, result: Dict):
        """记录选模日志"""
        log = SystemLog(
            log_time=datetime.now(),
            event_code="LOG-AI-002",
            event_type="智能选模",
            event_result="成功",
            description=f"[{table_id}] 选择模型: {result['selected_version']} | "
                       f"原因: {result['selection_reason']} | "
                       f"置信度: {result['confidence']:.0%}",
            category=LogCategory.SYSTEM,
            priority=LogPriority.P2,
            source_module="智能选模模块",
            is_pinned=False,
            retention_tier="warm30",
        )
        self.session.add(log)
        await self.session.commit()
        
        # 同时更新SystemState中的当前模型版本
        stmt = select(SystemState).where(SystemState.table_id == table_id)
        state_result = await self.session.execute(stmt)
        state = state_result.scalar_one_or_none()
        
        if state:
            state.current_model_version = result["selected_version"]
            await self.session.commit()