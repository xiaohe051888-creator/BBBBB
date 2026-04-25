"""
系统配置模块 - 百家乐分析预测系统（手动模式）
"""
import os
from typing import Optional

class Settings:
    """系统全局配置"""
    
    # 应用配置
    APP_NAME: str = "百家乐分析预测系统"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # 服务器配置
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
    
    # 安全配置
    import secrets
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", secrets.token_hex(32))
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173")
    
    # 数据库配置 (支持通过环境变量注入 PostgreSQL/MySQL 等，默认本地 SQLite)
    @property
    def DATABASE_URL(self) -> str:
        _db_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./data/baccarat.db")
        if _db_url.startswith("postgres://"):
            return _db_url.replace("postgres://", "postgresql+asyncpg://")
        elif _db_url.startswith("postgresql://") and "asyncpg" not in _db_url:
            return _db_url.replace("postgresql://", "postgresql+asyncpg://")
        return _db_url
    
    # 资金与下注配置
    DEFAULT_BALANCE: float = 20000.0
    BANKER_ODDS: float = 1.95
    PLAYER_ODDS: float = 2.0
    MIN_BET: int = 10
    MAX_BET: int = 10000
    BET_STEP: int = 10
    BASE_AMOUNT: int = 100
    
    # 自适应下注档位
    CONSERVATIVE_FACTOR: float = 0.5
    STANDARD_FACTOR: float = 1.0
    AGGRESSIVE_FACTOR: float = 1.5
    
    # 模型配置
    MAX_MODEL_VERSIONS: int = 5
    MIN_SAMPLE_FOR_LEARNING: int = 200  # 学习最低样本数
    MIN_RUNS_FOR_SWITCH: int = 20       # 版本切换冷却局数
    MAX_CONSECUTIVE_ERRORS: int = 3     # 连续失准触发阈值
    
    # AI API配置 - 三模型对应三个AI大模型
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY", "")  # 用于庄模型
    ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY", "")  # 用于闲模型
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", "")  # 用于综合模型
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")           # 庄模型专用
    ANTHROPIC_MODEL: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")  # 闲模型专用
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")      # 综合模型专用
    OPENAI_API_BASE: Optional[str] = os.getenv("OPENAI_API_BASE")  # OpenAI API地址
    ANTHROPIC_API_BASE: Optional[str] = os.getenv("ANTHROPIC_API_BASE")  # Anthropic API地址
    GEMINI_API_BASE: Optional[str] = os.getenv("GEMINI_API_BASE")  # Gemini API地址
    
    # API代理配置
    OFOX_API_BASE: Optional[str] = os.getenv("OFOX_API_BASE")  # ofox.ai代理API地址
    OFOX_API_KEY: Optional[str] = os.getenv("OFOX_API_KEY")    # ofox.ai API密钥
    
    # 模型可用性配置
    @property
    def ENABLE_OPENAI_MODEL(self) -> bool:
        """检查OpenAI模型是否可用"""
        return bool(self.OPENAI_API_KEY)
    
    @property
    def ENABLE_ANTHROPIC_MODEL(self) -> bool:
        """检查Anthropic模型是否可用"""
        return bool(self.ANTHROPIC_API_KEY)
    
    @property
    def ENABLE_GEMINI_MODEL(self) -> bool:
        """检查Gemini模型是否可用"""
        return bool(self.GEMINI_API_KEY)
    
    # 模型性能配置
    # 注意：ThreeModelService已实现永不降级机制（5次指数退避重试+备用模型轮换）
    # 以下配置仅作为兼容性保留，实际逻辑由服务层控制
    MODEL_TIMEOUT: int = 30  # API调用超时时间（秒）
    
    # 管理员配置
    DEFAULT_ADMIN_PASSWORD: str = os.getenv("ADMIN_DEFAULT_PASSWORD", "8888")
    MAX_LOGIN_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 10
    
    # 数据库配置
    MAX_HISTORY_RECORDS: int = 1000    # 最多保存1000局历史
    LOG_RETENTION_HOT: int = 7         # P3日志保留7天
    LOG_RETENTION_WARM: int = 30       # P2日志保留30天
    # P1日志永久保留
    
    # 健康分配置
    HEALTH_SCORE_WEIGHT_MODEL: float = 0.5
    HEALTH_SCORE_WEIGHT_SETTLE: float = 0.5
    HEALTH_SCORE_NORMAL: int = 85
    HEALTH_SCORE_WATCH: int = 70
    
    # 系统健康分采样窗口
    HEALTH_SAMPLE_WINDOW: int = 500
    
    # 手动模式配置
    MAX_UPLOAD_GAMES: int = 72         # 单次最大上传局数
    MIN_UPLOAD_GAMES: int = 1          # 单次最小上传局数


settings = Settings()
