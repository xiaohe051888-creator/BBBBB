"""
数据模型定义 - 百家乐分析预测系统
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, JSON, Numeric
from sqlalchemy.sql import func
from sqlalchemy import UniqueConstraint, Index
from enum import Enum as PyEnum
from app.core.database import Base


class GameResult(str, PyEnum):
    """开奖结果"""
    BANKER = "庄"
    PLAYER = "闲"
    TIE = "和"


class BetDirection(str, PyEnum):
    """下注方向"""
    BANKER = "庄"
    PLAYER = "闲"


class BetStatus(str, PyEnum):
    """下注状态"""
    PENDING = "待开奖"
    SETTLED = "已结算"
    REFUNDED = "异常退回"
    DATA_ERROR = "数据异常"


class BetTier(str, PyEnum):
    """下注档位"""
    CONSERVATIVE = "保守"
    STANDARD = "标准"
    AGGRESSIVE = "进取"


class SystemStatus(str, PyEnum):
    """系统状态"""
    RUNNING = "运行中"
    WAITING = "等待开奖"
    STRATEGY_REVIEW = "策略重评估中"
    ERROR = "异常处理中"
    STOPPED = "空闲"
    SHUFFLE_WAIT = "洗牌等待"
    INSUFFICIENT_BALANCE = "余额不足"


class LogPriority(str, PyEnum):
    """日志优先级"""
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"


class LogCategory(str, PyEnum):
    """日志分类"""
    SYSTEM = "系统状态"
    OPERATION = "操作记录"
    WORKFLOW = "工作流事件"
    FINANCE = "资金事件"


class ErrorType(str, PyEnum):
    """错误类型"""
    TREND_MISJUDGE = "趋势误判"
    TURNING_MISJUDGE = "转折误判"
    OVERCONFIDENCE = "置信过高"
    INSUFFICIENT_SAMPLE = "样本不足"
    SETTLEMENT_ERROR = "结算映射异常"


# ============ 开奖记录表 ============
class GameRecord(Base):
    """开奖记录 - 唯一键：靴号+局号"""
    __tablename__ = "game_records"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    boot_number = Column(Integer, nullable=False, comment="靴号")
    game_number = Column(Integer, nullable=False, comment="局号")
    result = Column(String(4), nullable=False, comment="开奖结果：庄/闲/和")
    prediction_mode = Column(String(20), nullable=True, comment="预测模式：ai/single_ai/rule")
    predict_direction = Column(String(4), nullable=True, comment="预测方向：庄/闲")
    predict_correct = Column(Boolean, nullable=True, comment="预测是否正确")
    error_id = Column(String(20), nullable=True, comment="错误编号")
    settlement_status = Column(String(10), nullable=True, comment="结算状态")
    profit_loss = Column(Numeric(10, 2), default=0.0, comment="本局盈亏")
    balance_after = Column(Numeric(10, 2), default=0.0, comment="结算后余额")
    result_time = Column(DateTime, nullable=True, comment="开奖时间")
    created_at = Column(DateTime, server_default=func.now())
    
    __table_args__ = (
        UniqueConstraint("boot_number", "game_number", name="uq_game_record"),
        Index("idx_game_boot_number", "boot_number", "game_number"),
    )


# ============ 五路图数据表 ============
class RoadMap(Base):
    """五路图数据"""
    __tablename__ = "road_maps"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    boot_number = Column(Integer, nullable=False)
    game_number = Column(Integer, nullable=False)
    road_type = Column(String(20), nullable=False, comment="路类型：大路/珠盘路/大眼仔路/小路/螳螂路")
    position_x = Column(Integer, nullable=False, comment="列坐标")
    position_y = Column(Integer, nullable=False, comment="行坐标")
    value = Column(String(4), nullable=False, comment="值：庄/闲")
    is_new_column = Column(Boolean, default=False, comment="是否新列起始")
    created_at = Column(DateTime, server_default=func.now())
    
    __table_args__ = (
        Index("idx_road_boot_game", "boot_number", "game_number", "road_type"),
    )


# ============ 下注记录表 ============
class BetRecord(Base):
    """下注记录 - 唯一键：靴号+局号+下注序号"""
    __tablename__ = "bet_records"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    boot_number = Column(Integer, nullable=False)
    game_number = Column(Integer, nullable=False)
    bet_seq = Column(Integer, default=1, comment="下注序号")
    bet_direction = Column(String(4), nullable=False, comment="下注方向：庄/闲")
    bet_amount = Column(Numeric(10, 2), nullable=False, comment="下注金额")
    bet_tier = Column(String(10), default="标准", comment="下注档位")
    status = Column(String(10), default="待开奖", comment="状态")
    game_result = Column(String(4), nullable=True, comment="开奖结果")
    error_id = Column(String(20), nullable=True, comment="错误编号")
    settlement_amount = Column(Numeric(10, 2), nullable=True, comment="结算金额")
    profit_loss = Column(Numeric(10, 2), nullable=True, comment="本局盈亏")
    balance_before = Column(Numeric(10, 2), nullable=False, comment="余额变动前")
    balance_after = Column(Numeric(10, 2), nullable=False, comment="余额变动后")
    adapt_summary = Column(Text, nullable=True, comment="自适应依据摘要")
    bet_time = Column(DateTime, nullable=True, comment="下注时间")
    settle_time = Column(DateTime, nullable=True, comment="结算时间")
    created_at = Column(DateTime, server_default=func.now())
    
    __table_args__ = (
        UniqueConstraint("boot_number", "game_number", "bet_seq", name="uq_bet_record"),
        Index("idx_bet_status_time", "status", "bet_time"),
        Index("idx_bet_boot", "boot_number"),
    )


# ============ 实盘日志表 ============
class SystemLog(Base):
    """实盘日志 - 唯一键：事件唯一键"""
    __tablename__ = "system_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    log_time = Column(DateTime, nullable=False, comment="时间")
    boot_number = Column(Integer, nullable=True, comment="靴号")
    game_number = Column(Integer, nullable=True, comment="局号")
    event_code = Column(String(20), nullable=False, comment="事件编码")
    event_type = Column(String(50), nullable=False, comment="事件类型")
    event_result = Column(String(50), nullable=False, comment="事件结果")
    description = Column(Text, nullable=False, comment="说明")
    category = Column(String(20), nullable=False, comment="分类")
    priority = Column(String(4), default="P3", comment="优先级")
    source_module = Column(String(50), nullable=True, comment="来源模块")
    event_key = Column(String(200), nullable=True, comment="事件唯一键")
    task_id = Column(String(36), nullable=True, comment="关联后台任务编号")
    is_pinned = Column(Boolean, default=False, comment="是否置顶")
    retention_tier = Column(String(10), default="hot7", comment="保留层级：hot7/warm30/cold_perm")
    created_at = Column(DateTime, server_default=func.now())
    
    __table_args__ = (
        Index("idx_log_time_priority", "log_time", "priority"),
        Index("idx_log_event_code", "event_code"),
        Index("idx_log_category", "category"),
        Index("idx_log_boot_game", "boot_number", "game_number"),
        Index("idx_log_task_id", "task_id"),
    )


# ============ 后台任务记录表 ============
class BackgroundTask(Base):
    __tablename__ = "background_tasks"

    task_id = Column(String(36), primary_key=True)
    task_type = Column(String(50), nullable=False)
    boot_number = Column(Integer, nullable=True)
    dedupe_key = Column(String(200), nullable=True)
    status = Column(String(20), nullable=False, default="running")
    message = Column(String(200), nullable=False, default="运行中")
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    finished_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("idx_bg_task_created_at", "created_at"),
        Index("idx_bg_task_status", "status"),
        Index("idx_bg_task_type", "task_type"),
    )


# ============ 错题本表 ============
class MistakeBook(Base):
    """错题本 - 本靴内生效，不跨靴"""
    __tablename__ = "mistake_book"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    boot_number = Column(Integer, nullable=False)
    game_number = Column(Integer, nullable=False)
    prediction_mode = Column(String(20), nullable=True, comment="预测模式：ai/single_ai")
    error_id = Column(String(20), nullable=False, comment="错误编号")
    error_type = Column(String(20), nullable=False, comment="错误类型")
    predict_direction = Column(String(4), nullable=False, comment="预测方向")
    actual_result = Column(String(4), nullable=False, comment="实际结果")
    banker_summary = Column(Text, nullable=True, comment="庄模型摘要")
    player_summary = Column(Text, nullable=True, comment="闲模型摘要")
    combined_summary = Column(Text, nullable=True, comment="综合模型摘要")
    confidence = Column(Float, nullable=True, comment="置信度")
    road_snapshot = Column(JSON, nullable=True, comment="五路图快照")
    analysis = Column(Text, nullable=True, comment="错因分析")
    correction = Column(Text, nullable=True, comment="修正策略")
    created_at = Column(DateTime, server_default=func.now())
    
    __table_args__ = (
        Index("idx_mistake_boot", "boot_number"),
        UniqueConstraint("boot_number", "game_number", name="uq_mistake_boot_game"),
    )


# ============ 模型版本表 ============
class ModelVersion(Base):
    """AI模型版本管理 - 智能版本选择 + 三级记忆"""
    __tablename__ = "model_versions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    version = Column(String(30), unique=True, nullable=False, comment="版本号")
    prediction_mode = Column(String(20), nullable=False, default="ai", server_default="ai", comment="版本所属模式：ai/single_ai")
    created_at = Column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")
    
    # 训练信息
    training_range = Column(Text, nullable=True, comment="训练数据范围")
    training_sample_count = Column(Integer, default=0, comment="训练样本数")
    learning_count = Column(Integer, default=0, comment="学习次数（经验值）")
    parent_version = Column(String(30), nullable=True, comment="父版本（继承自哪个版本）")
    
    # 准确率追踪
    accuracy_before = Column(Float, nullable=True, comment="学习前准确率")
    accuracy_after = Column(Float, nullable=True, comment="学习后准确率")
    recent_3_boot_accuracy = Column(Float, nullable=True, comment="最近3靴命中率")
    overall_accuracy = Column(Float, nullable=True, comment="整体命中率")
    
    # 关键变化
    key_changes = Column(Text, nullable=True, comment="关键变化摘要")
    prompt_template = Column(Text, nullable=True, comment="完整提示词模板")
    self_reflection = Column(Text, nullable=True, comment="自我反思总结")
    
    # 状态管理
    is_active = Column(Boolean, default=False, comment="是否当前使用")
    is_eliminated = Column(Boolean, default=False, comment="是否已淘汰")
    is_stable = Column(Boolean, default=False, comment="是否为稳定版本")
    
    # 性能统计
    total_runs = Column(Integer, default=0, comment="使用局数")
    hit_count = Column(Integer, default=0, comment="命中次数")
    total_boots = Column(Integer, default=0, comment="使用靴数")
    recent_boots_hit = Column(Integer, default=0, comment="最近3靴命中次数")
    recent_boots_total = Column(Integer, default=0, comment="最近3靴总次数")
    
    # 综合评分维度
    stability_score = Column(Float, nullable=True, comment="稳定性评分(0-100)")
    recovery_speed_score = Column(Float, nullable=True, comment="恢复速度评分(0-100)")
    drawdown_control_score = Column(Float, nullable=True, comment="回撤控制评分(0-100)")
    user_rating = Column(Float, default=5.0, comment="用户评分(0-10)")
    
    # 智能评分（自动计算）
    intelligence_score = Column(Float, nullable=True, comment="智能评分(加权综合)")
    
    # 三级记忆
    short_term_memory = Column(Text, nullable=True, comment="短期记忆JSON（当前靴）")
    medium_term_memory = Column(Text, nullable=True, comment="中期记忆JSON（最近5靴）")
    long_term_memory = Column(Text, nullable=True, comment="长期记忆JSON（所有历史）")


# ============ AI记忆表 ============
class AIMemory(Base):
    """AI记忆 - 局级微学习记录"""
    __tablename__ = "ai_memories"
    
    __table_args__ = (
        Index("idx_ai_memory_boot_game", "boot_number", "game_number"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime, server_default=func.now(), comment="记忆创建时间")
    
    # 关联信息
    boot_number = Column(Integer, nullable=False, comment="靴号")
    game_number = Column(Integer, nullable=False, comment="局号")
    version_id = Column(String(30), nullable=True, comment="使用的模型版本")
    prediction_mode = Column(String(20), nullable=True, comment="预测模式：ai/single_ai")
    
    # 预测信息
    prediction = Column(String(10), nullable=True, comment="预测结果")
    actual_result = Column(String(10), nullable=True, comment="实际结果")
    is_correct = Column(Boolean, nullable=True, comment="是否预测正确")
    confidence = Column(Float, nullable=True, comment="置信度")
    
    # 深度错误分析（5维度）
    error_type = Column(String(50), nullable=True, comment="错误类型")
    error_dimension = Column(String(50), nullable=True, comment="错误维度：证据误判/血迹盲区/规律误判/权重失衡/其他")
    error_analysis = Column(Text, nullable=True, comment="错误详细分析")
    
    # 自我反思
    self_reflection = Column(Text, nullable=True, comment="AI自我反思")
    would_do_differently = Column(Text, nullable=True, comment="如果重来会怎么做")
    lesson_learned = Column(Text, nullable=True, comment="学到的教训")
    
    # 五路快照
    road_snapshot = Column(Text, nullable=True, comment="五路走势图快照JSON")
    bloodstain_pattern = Column(Text, nullable=True, comment="血迹模式分析")
    
    # 记忆权重（用于遗忘曲线）
    memory_weight = Column(Float, default=1.0, comment="记忆权重(0-1)")
    access_count = Column(Integer, default=0, comment="被引用次数")
    last_accessed = Column(DateTime, nullable=True, comment="最后引用时间")


# ============ 管理员表 ============
class AdminUser(Base):
    """管理员"""
    __tablename__ = "admin_users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, default="admin")
    password_hash = Column(String(200), nullable=False)
    must_change_password = Column(Boolean, default=True, comment="首次登录必须修改密码")
    login_attempts = Column(Integer, default=0, comment="连续登录失败次数")
    locked_until = Column(DateTime, nullable=True, comment="锁定截止时间")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class AiModelConfig(Base):
    __tablename__ = "ai_model_configs"

    role = Column(String(20), primary_key=True)
    provider = Column(String(50), nullable=False)
    model = Column(String(100), nullable=False)
    base_url = Column(String(200), nullable=True)
    config_hash = Column(String(64), nullable=False)
    last_test_ok = Column(Boolean, default=False, nullable=False)
    last_test_at = Column(DateTime, nullable=True)
    last_test_error = Column(Text, nullable=True)
    last_test_config_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_ai_model_configs_updated_at", "updated_at"),
    )


# ============ 系统运行状态表 ============
class SystemState(Base):
    """系统运行状态"""
    __tablename__ = "system_state"
    __table_args__ = (
        Index("uq_system_state_singleton_key", "singleton_key", unique=True),
    )
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    singleton_key = Column(Integer, nullable=False, server_default="1")
    status = Column(String(20), default="空闲", server_default="空闲")
    boot_number = Column(Integer, default=0)
    game_number = Column(Integer, default=0)
    current_game_result = Column(String(4), nullable=True, comment="当前局结果")
    predict_direction = Column(String(4), nullable=True, comment="预测方向")
    predict_confidence = Column(Float, nullable=True, comment="置信度")
    prediction_mode = Column(String(20), default="rule", comment="预测模式：ai / single_ai / rule")
    current_model_version = Column(String(20), nullable=True)
    current_bet_tier = Column(String(10), default="标准")
    balance = Column(Numeric(10, 2), default=20000.0)
    consecutive_errors = Column(Integer, default=0, comment="连续失准次数")
    health_score = Column(Float, default=100.0, comment="系统健康分")
    data_integrity = Column(Float, default=100.0, comment="数据完整性")
    model_stability = Column(Float, default=100.0, comment="模型稳定性")
    settlement_consistency = Column(Float, default=100.0, comment="结算一致性")
    workflow_start_time = Column(DateTime, nullable=True, comment="本轮工作流开始时间")
    started_at = Column(DateTime, nullable=True, comment="系统启动时间")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
