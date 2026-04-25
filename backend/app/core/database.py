"""
数据库模块 - 百家乐分析预测系统
按靴隔离存储，最多1000局历史滚动
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import event
from app.core.config import settings

# 配置连接池参数，优化高并发性能
# 注意：SQLite 不支持传统的 pool_size 等参数，但 SQLAlchemy 允许传入，对其它 DB 有效。
# 为保证使用 SQLite 时的全自动托管高并发读写，必须通过 event 开启 WAL 模式。
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    connect_args=connect_args,
    pool_size=10,           # 连接池大小
    max_overflow=20,        # 最大溢出连接数
    pool_pre_ping=True,     # 连接前ping检测，避免使用已断开的连接
    pool_recycle=3600,      # 连接回收时间（1小时）
    pool_timeout=30,        # 获取连接超时时间
)

# SQLite 性能优化：启用 WAL (Write-Ahead Logging) 和 外键约束
@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if settings.DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA temp_store=MEMORY")
        cursor.close()

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """ORM 基类"""


import logging

logger = logging.getLogger(__name__)

async def init_db():
    """初始化数据库表"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("数据库初始化完成")


async def get_session() -> AsyncSession:
    """获取数据库会话"""
    async with async_session() as session:
        yield session
