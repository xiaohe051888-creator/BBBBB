"""
模型智能路由与选择器
根据性能、成本、可用性动态选择最佳模型
实现真正的满血三模型智能协作
"""
import time
import asyncio
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import statistics
from app.core.config import settings


@dataclass
class ModelCapability:
    """模型能力配置"""
    model_id: str  # 模型标识
    name: str      # 模型名称
    vendor: str    # 供应商：openai/anthropic/google
    task_types: List[str]  # 支持的任务类型
    cost_per_token: float  # token成本（元/千token）
    max_tokens: int        # 最大输出token
    temperature_range: Tuple[float, float]  # 温度范围
    description: str = ""  # 模型描述


@dataclass
class ModelPerformanceMetrics:
    """模型性能指标"""
    model_id: str
    success_count: int = 0
    error_count: int = 0
    total_tokens: int = 0
    total_cost: float = 0.0
    total_time: float = 0.0  # 总响应时间（秒）
    avg_response_time: float = 0.0
    success_rate: float = 0.0
    recent_errors: List[float] = field(default_factory=list)  # 最近错误时间戳
    last_success: Optional[datetime] = None
    last_error: Optional[datetime] = None
    
    @property
    def is_healthy(self) -> bool:
        """判断模型是否健康"""
        if self.success_rate < 0.5:  # 成功率低于50%
            return False
        
        # 最近5分钟内有错误且无成功
        five_min_ago = datetime.now() - timedelta(minutes=5)
        recent_error = self.last_error and self.last_error > five_min_ago
        recent_success = self.last_success and self.last_success > five_min_ago
        
        if recent_error and not recent_success:
            return False
        
        # 平均响应时间超过30秒
        if self.avg_response_time > 30:
            return False
        
        return True
    
    @property
    def error_rate_last_hour(self) -> float:
        """计算最近1小时错误率"""
        one_hour_ago = time.time() - 3600
        recent_errors = [e for e in self.recent_errors if e > one_hour_ago]
        total_calls = self.success_count + self.error_count
        
        if total_calls == 0:
            return 0.0
        
        return len(recent_errors) / total_calls


@dataclass
class TaskRequirement:
    """任务需求"""
    task_type: str  # banker/player/combined
    priority: str = "normal"  # high/normal/low
    cost_constraint: Optional[float] = None  # 成本约束（元）
    timeout: int = 30  # 超时时间（秒）
    min_confidence: float = 0.5  # 最低置信度要求
    context_tokens: int = 0  # 上下文token数


@dataclass
class ModelSelectionResult:
    """模型选择结果"""
    model_id: str
    model_name: str
    confidence_score: float  # 选择置信度 0-1
    estimated_cost: float    # 预估成本
    estimated_time: float    # 预估响应时间
    fallback_options: List[str]  # 备用选项
    selection_reason: str    # 选择原因


class ModelRouter:
    """
    模型智能路由器
    
    核心功能：
    1. 基于性能、成本、可用性的智能模型选择
    2. 实时健康度监控与故障检测
    3. 负载均衡与成本优化
    4. 故障自动切换与恢复
    """
    
    def __init__(self):
        self.capabilities: Dict[str, ModelCapability] = {}
        self.metrics: Dict[str, ModelPerformanceMetrics] = {}
        self._init_capabilities()
        self._init_metrics()
        
        # 任务类型与模型偏好映射
        self.task_preferences = {
            "banker": ["openai_gpt4o", "claude_sonnet", "gemini_flash"],  # 庄模型偏好顺序
            "player": ["claude_sonnet", "openai_gpt4o", "gemini_flash"],  # 闲模型偏好顺序
            "combined": ["gemini_flash", "claude_sonnet", "openai_gpt4o"]  # 综合模型偏好顺序
        }
        
        # 成本权重配置
        self.weights = {
            "performance": 0.4,   # 性能权重
            "cost": 0.3,          # 成本权重
            "reliability": 0.3    # 可靠性权重
        }
    
    def _init_capabilities(self):
        """初始化模型能力配置"""
        # OpenAI GPT-4o mini - 庄模型专用（概率推理型）
        self.capabilities["openai_gpt4o"] = ModelCapability(
            model_id="openai_gpt4o",
            name="GPT-4o mini",
            vendor="openai",
            task_types=["banker", "player", "combined"],
            cost_per_token=0.0015,  # 约0.15元/千token
            max_tokens=16384,
            temperature_range=(0.1, 0.5),
            description="OpenAI最新小模型，适合概率推理和快速分析"
        )
        
        # Anthropic Claude Sonnet 4 - 闲模型专用（逻辑严谨型）
        self.capabilities["claude_sonnet"] = ModelCapability(
            model_id="claude_sonnet",
            name="Claude Sonnet 4",
            vendor="anthropic",
            task_types=["banker", "player", "combined"],
            cost_per_token=0.003,  # 约0.3元/千token
            max_tokens=8192,
            temperature_range=(0.1, 0.4),
            description="Anthropic Claude模型，逻辑严谨，适合规则分析"
        )
        
        # Google Gemini 1.5 Flash - 综合模型专用（整合决策型）
        self.capabilities["gemini_flash"] = ModelCapability(
            model_id="gemini_flash",
            name="Gemini 1.5 Flash",
            vendor="google",
            task_types=["banker", "player", "combined"],
            cost_per_token=0.00035,  # 约0.035元/千token
            max_tokens=8192,
            temperature_range=(0.1, 0.3),
            description="Google Gemini模型，多模态能力强，适合综合决策"
        )
    
    def _init_metrics(self):
        """初始化性能指标"""
        for model_id in self.capabilities:
            self.metrics[model_id] = ModelPerformanceMetrics(model_id=model_id)
    
    def is_model_available(self, model_id: str) -> bool:
        """检查模型是否可用"""
        # 检查配置是否启用
        if model_id == "openai_gpt4o" and not settings.ENABLE_OPENAI_MODEL:
            return False
        if model_id == "claude_sonnet" and not settings.ENABLE_ANTHROPIC_MODEL:
            return False
        if model_id == "gemini_flash" and not settings.ENABLE_GEMINI_MODEL:
            return False
        
        # 检查模型健康度
        metrics = self.metrics.get(model_id)
        if not metrics:
            return False
        
        return metrics.is_healthy
    
    def select_best_model(self, task: TaskRequirement) -> ModelSelectionResult:
        """
        选择最佳模型
        
        Args:
            task: 任务需求
            
        Returns:
            模型选择结果
        """
        # 获取可用模型列表（按偏好排序）
        preferred_models = self.task_preferences.get(task.task_type, [])
        available_models = [m for m in preferred_models if self.is_model_available(m)]
        
        if not available_models:
            # 没有首选模型可用，尝试所有可用模型
            available_models = [m for m in self.capabilities.keys() if self.is_model_available(m)]
        
        if not available_models:
            # 所有模型都不可用
            return self._get_fallback_selection(task)
        
        # 计算每个模型的综合评分
        scores = {}
        for model_id in available_models:
            score = self._calculate_model_score(model_id, task)
            scores[model_id] = score
        
        # 选择评分最高的模型
        best_model_id = max(scores, key=scores.get)
        best_score = scores[best_model_id]
        
        # 获取备用选项（评分第二高的模型）
        backup_models = sorted(scores.items(), key=lambda x: x[1], reverse=True)[1:3]
        fallback_options = [m[0] for m in backup_models]
        
        # 预估成本和响应时间
        estimated_cost = self._estimate_cost(best_model_id, task.context_tokens)
        estimated_time = self._estimate_response_time(best_model_id)
        
        # 构建选择原因
        selection_reason = self._build_selection_reason(
            best_model_id, best_score, scores, task
        )
        
        return ModelSelectionResult(
            model_id=best_model_id,
            model_name=self.capabilities[best_model_id].name,
            confidence_score=best_score,
            estimated_cost=estimated_cost,
            estimated_time=estimated_time,
            fallback_options=fallback_options,
            selection_reason=selection_reason
        )
    
    def _calculate_model_score(self, model_id: str, task: TaskRequirement) -> float:
        """计算模型综合评分"""
        if not self.is_model_available(model_id):
            return 0.0
        
        capability = self.capabilities[model_id]
        metrics = self.metrics[model_id]
        
        # 性能评分（基于响应时间和成功率）
        perf_score = self._calculate_performance_score(metrics)
        
        # 成本评分（基于预估成本）
        cost_score = self._calculate_cost_score(capability, task)
        
        # 可靠性评分（基于错误率和健康状态）
        reliability_score = self._calculate_reliability_score(metrics)
        
        # 任务适配评分（基于任务类型偏好）
        task_score = self._calculate_task_score(model_id, task.task_type)
        
        # 综合评分（加权平均）
        final_score = (
            perf_score * self.weights["performance"] +
            cost_score * self.weights["cost"] +
            reliability_score * self.weights["reliability"]
        ) * task_score
        
        return final_score
    
    def _calculate_performance_score(self, metrics: ModelPerformanceMetrics) -> float:
        """计算性能评分"""
        if metrics.success_count == 0:
            return 0.5  # 默认值
        
        # 基于响应时间的评分（越快越好）
        if metrics.avg_response_time <= 2:
            time_score = 1.0
        elif metrics.avg_response_time <= 5:
            time_score = 0.8
        elif metrics.avg_response_time <= 10:
            time_score = 0.6
        elif metrics.avg_response_time <= 20:
            time_score = 0.4
        else:
            time_score = 0.2
        
        # 基于成功率的评分
        success_score = metrics.success_rate
        
        # 综合性能评分
        return (time_score + success_score) / 2
    
    def _calculate_cost_score(self, capability: ModelCapability, task: TaskRequirement) -> float:
        """计算成本评分（成本越低评分越高）"""
        # 预估成本
        estimated_cost = capability.cost_per_token * (task.context_tokens / 1000)
        
        if task.cost_constraint is not None and estimated_cost > task.cost_constraint:
            return 0.0  # 超出成本约束
        
        # 成本评分（成本越低评分越高）
        if estimated_cost <= 0.01:  # <= 0.01元
            return 1.0
        elif estimated_cost <= 0.05:  # <= 0.05元
            return 0.8
        elif estimated_cost <= 0.1:   # <= 0.1元
            return 0.6
        elif estimated_cost <= 0.2:   # <= 0.2元
            return 0.4
        else:                         # > 0.2元
            return 0.2
    
    def _calculate_reliability_score(self, metrics: ModelPerformanceMetrics) -> float:
        """计算可靠性评分"""
        # 基于错误率
        error_rate = metrics.error_rate_last_hour
        
        if error_rate == 0:
            error_score = 1.0
        elif error_rate <= 0.1:  # 错误率 <= 10%
            error_score = 0.8
        elif error_rate <= 0.2:  # 错误率 <= 20%
            error_score = 0.6
        elif error_rate <= 0.3:  # 错误率 <= 30%
            error_score = 0.4
        else:                    # 错误率 > 30%
            error_score = 0.2
        
        # 基于健康状态
        health_score = 1.0 if metrics.is_healthy else 0.0
        
        # 基于最近成功时间
        if metrics.last_success:
            hours_since_success = (datetime.now() - metrics.last_success).total_seconds() / 3600
            if hours_since_success <= 1:  # 1小时内成功过
                recency_score = 1.0
            elif hours_since_success <= 6:  # 6小时内成功过
                recency_score = 0.8
            elif hours_since_success <= 24:  # 24小时内成功过
                recency_score = 0.6
            else:                            # 超过24小时
                recency_score = 0.4
        else:
            recency_score = 0.0
        
        # 综合可靠性评分
        return (error_score + health_score + recency_score) / 3
    
    def _calculate_task_score(self, model_id: str, task_type: str) -> float:
        """计算任务适配评分"""
        # 检查是否为任务首选模型
        preferred_models = self.task_preferences.get(task_type, [])
        
        if not preferred_models:
            return 1.0  # 无偏好，所有模型平等
        
        if model_id in preferred_models:
            # 在偏好列表中，位置越靠前评分越高
            position = preferred_models.index(model_id)
            max_position = len(preferred_models) - 1
            return 1.0 - (position / max_position * 0.3)  # 最高1.0，最低0.7
        else:
            # 不在偏好列表中，降低评分
            return 0.7
    
    def _estimate_cost(self, model_id: str, context_tokens: int) -> float:
        """预估成本"""
        capability = self.capabilities[model_id]
        estimated_tokens = context_tokens + 500  # 预估输出500token
        return capability.cost_per_token * (estimated_tokens / 1000)
    
    def _estimate_response_time(self, model_id: str) -> float:
        """预估响应时间"""
        metrics = self.metrics.get(model_id)
        if not metrics or metrics.success_count == 0:
            return 5.0  # 默认预估5秒
        
        return metrics.avg_response_time
    
    def _get_fallback_selection(self, task: TaskRequirement) -> ModelSelectionResult:
        """获取降级选择结果"""
        # 尝试所有模型（包括不健康的）
        all_models = list(self.capabilities.keys())
        fallback_model = None
        
        for model_id in all_models:
            # 检查基本配置
            if model_id == "openai_gpt4o" and settings.OPENAI_API_KEY:
                fallback_model = model_id
                break
            elif model_id == "claude_sonnet" and settings.ANTHROPIC_API_KEY:
                fallback_model = model_id
                break
            elif model_id == "gemini_flash" and settings.GEMINI_API_KEY:
                fallback_model = model_id
                break
        
        if not fallback_model:
            # 所有模型都不可用
            fallback_model = all_models[0] if all_models else "unknown"
        
        return ModelSelectionResult(
            model_id=fallback_model,
            model_name=self.capabilities[fallback_model].name if fallback_model in self.capabilities else "未知模型",
            confidence_score=0.1,
            estimated_cost=0.0,
            estimated_time=10.0,
            fallback_options=[],
            selection_reason="所有健康模型均不可用，使用基本配置降级"
        )
    
    def _build_selection_reason(self, best_model_id: str, best_score: float, 
                                scores: Dict[str, float], task: TaskRequirement) -> str:
        """构建选择原因说明"""
        capability = self.capabilities[best_model_id]
        metrics = self.metrics[best_model_id]
        
        reasons = []
        
        # 任务适配原因
        if best_model_id in self.task_preferences.get(task.task_type, []):
            position = self.task_preferences[task.task_type].index(best_model_id) + 1
            reasons.append(f"任务类型'{task.task_type}'的第{position}首选模型")
        
        # 性能原因
        if metrics.avg_response_time < 5:
            reasons.append(f"响应速度快({metrics.avg_response_time:.1f}s)")
        if metrics.success_rate > 0.9:
            reasons.append(f"成功率高({metrics.success_rate:.1%})")
        
        # 成本原因
        estimated_cost = self._estimate_cost(best_model_id, task.context_tokens)
        if estimated_cost < 0.05:
            reasons.append(f"成本低({estimated_cost:.3f}元)")
        
        # 可靠性原因
        if metrics.error_rate_last_hour < 0.1:
            reasons.append("稳定性好")
        
        if not reasons:
            reasons.append("综合评分最高")
        
        return f"选择原因: {', '.join(reasons)} (综合评分: {best_score:.3f})"
    
    def update_metrics(self, model_id: str, success: bool, 
                      execution_time: float, tokens_used: int = 0):
        """更新模型性能指标"""
        if model_id not in self.metrics:
            self.metrics[model_id] = ModelPerformanceMetrics(model_id=model_id)
        
        metrics = self.metrics[model_id]
        
        if success:
            metrics.success_count += 1
            metrics.total_time += execution_time
            metrics.avg_response_time = metrics.total_time / metrics.success_count
            metrics.total_tokens += tokens_used
            metrics.total_cost += self._estimate_cost(model_id, tokens_used)
            metrics.last_success = datetime.now()
        else:
            metrics.error_count += 1
            metrics.recent_errors.append(time.time())
            metrics.last_error = datetime.now()
            
            # 只保留最近24小时的错误记录
            one_day_ago = time.time() - 86400
            metrics.recent_errors = [e for e in metrics.recent_errors if e > one_day_ago]
        
        # 更新成功率
        total = metrics.success_count + metrics.error_count
        metrics.success_rate = metrics.success_count / total if total > 0 else 0.0
    
    def get_performance_report(self) -> Dict:
        """获取性能报告"""
        report = {
            "timestamp": datetime.now().isoformat(),
            "models": {},
            "summary": {
                "total_models": len(self.metrics),
                "healthy_models": sum(1 for m in self.metrics.values() if m.is_healthy),
                "total_calls": sum(m.success_count + m.error_count for m in self.metrics.values()),
                "total_cost": sum(m.total_cost for m in self.metrics.values()),
                "overall_success_rate": self._calculate_overall_success_rate()
            }
        }
        
        for model_id, metrics in self.metrics.items():
            report["models"][model_id] = {
                "name": self.capabilities[model_id].name if model_id in self.capabilities else "未知",
                "is_healthy": metrics.is_healthy,
                "success_count": metrics.success_count,
                "error_count": metrics.error_count,
                "success_rate": metrics.success_rate,
                "avg_response_time": metrics.avg_response_time,
                "total_cost": metrics.total_cost,
                "error_rate_last_hour": metrics.error_rate_last_hour,
                "last_success": metrics.last_success.isoformat() if metrics.last_success else None,
                "last_error": metrics.last_error.isoformat() if metrics.last_error else None
            }
        
        return report
    
    def _calculate_overall_success_rate(self) -> float:
        """计算总体成功率"""
        total_success = sum(m.success_count for m in self.metrics.values())
        total_calls = sum(m.success_count + m.error_count for m in self.metrics.values())
        
        if total_calls == 0:
            return 0.0
        
        return total_success / total_calls
    
    def reset_metrics(self, model_id: Optional[str] = None):
        """重置性能指标"""
        if model_id:
            if model_id in self.metrics:
                self.metrics[model_id] = ModelPerformanceMetrics(model_id=model_id)
        else:
            self._init_metrics()