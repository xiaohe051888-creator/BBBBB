"""
系统配置模块 - 百家乐分析预测系统
"""
import os
from typing import Optional, List

class Settings:
    """系统全局配置"""
    
    # 应用配置
    APP_NAME: str = "百家乐分析预测系统"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # 服务器配置
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # 安全配置
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173")
    
    # 数据库配置
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/baccarat.db"
    
    # 采集配置
    CRAWL_INTERVAL: int = 10          # 采集间隔（秒）
    SHUFFLE_DETECT_INTERVAL: int = 600  # 洗牌探测间隔（10分钟）
    NEW_BOOT_CONFIRM: int = 2         # 新靴确认次数
    
    # 工作流配置
    WORKFLOW_TIMEOUT: int = 150       # 单轮工作流超时（秒）
    BET_TIMEOUT: int = 300            # 下注超时退回（5分钟）
    AUTO_RESTART_DELAY: int = 600     # 自动重启延迟（10分钟）
    
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
    MODEL_TIMEOUT: int = 30  # API调用超时时间（秒）
    MODEL_MAX_RETRIES: int = 2  # 最大重试次数
    MODEL_FALLBACK_ORDER: List[str] = ["openai", "anthropic", "gemini"]  # 降级顺序
    
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
    HEALTH_SCORE_WEIGHT_CRAWL: float = 0.35
    HEALTH_SCORE_WEIGHT_MODEL: float = 0.35
    HEALTH_SCORE_WEIGHT_SETTLE: float = 0.30
    HEALTH_SCORE_NORMAL: int = 85
    HEALTH_SCORE_WATCH: int = 70
    
    # 系统健康分采样窗口
    HEALTH_SAMPLE_WINDOW: int = 500
    
    # 目标网站配置
    TARGET_TABLE_26_URL: str = os.getenv("TARGET_TABLE_26_URL", "https://rd.lile333.com/?d=26")
    TARGET_TABLE_27_URL: str = os.getenv("TARGET_TABLE_27_URL", "https://rd.lile333.com/?d=27")
    
    # Lile333 浏览器采集器专用配置
    LILE333_HEADLESS: bool = os.getenv("LILE333_HEADLESS", "true").lower() == "true"  # 是否使用无头浏览器（生产环境建议true，调试时设为false）


settings = Settings()
