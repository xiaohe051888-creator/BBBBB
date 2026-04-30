"""
数据库模块 - 百家乐分析预测系统
按靴隔离存储，最多1000局历史滚动
"""
import atexit
import asyncio

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

from sqlalchemy import event, inspect, text

async def init_db():
    """初始化数据库表并自动执行增量迁移"""
    async with engine.begin() as conn:
        if settings.ENVIRONMENT.lower() == "production":
            def _check(sync_conn):
                inspector = inspect(sync_conn)
                required = {"alembic_version", "system_logs", "background_tasks"}
                missing = [t for t in required if not inspector.has_table(t)]
                if missing:
                    raise RuntimeError("生产环境数据库未完成迁移，请先执行 alembic upgrade head")

            await conn.run_sync(_check)
            logger.info("生产环境数据库迁移检查通过")
            return

        # 创建所有不存在的表
        await conn.run_sync(Base.metadata.create_all)
        
        # SQLite 增量字段同步 (Auto Migration for missing columns)
        if settings.DATABASE_URL.startswith("sqlite"):
            def sync_columns(sync_conn):
                inspector = inspect(sync_conn)
                for table_name, table in Base.metadata.tables.items():
                    if inspector.has_table(table_name):
                        existing_columns = {c["name"] for c in inspector.get_columns(table_name)}
                        for column in table.columns:
                            if column.name not in existing_columns:
                                # 构建 ALTER TABLE 语句（简化版，仅支持添加基本列）
                                col_type = column.type.compile(dialect=sync_conn.dialect)
                                default_val = "NULL"
                                if column.server_default is not None:
                                    default_val = column.server_default.arg.text if hasattr(column.server_default.arg, "text") else column.server_default.arg
                                elif not column.nullable:
                                    if "VARCHAR" in str(col_type) or "TEXT" in str(col_type) or "String" in str(col_type):
                                        default_val = "''"
                                    elif "INTEGER" in str(col_type) or "FLOAT" in str(col_type) or "NUMERIC" in str(col_type):
                                        default_val = "0"
                                    elif "BOOLEAN" in str(col_type):
                                        default_val = "0"
                                
                                alter_stmt = f"ALTER TABLE {table_name} ADD COLUMN {column.name} {col_type} DEFAULT {default_val}"
                                try:
                                    sync_conn.execute(text(alter_stmt))
                                    logger.info(f"Auto-Migrate: Added column '{column.name}' to table '{table_name}'")
                                except Exception as e:
                                    logger.warning(f"Auto-Migrate failed for {table_name}.{column.name}: {e}")

            await conn.run_sync(sync_columns)

    logger.info("数据库初始化及字段同步完成")

async def close_db() -> None:
    await engine.dispose()


async def get_session() -> AsyncSession:
    """获取数据库会话"""
    async with async_session() as session:
        yield session


def _dispose_on_exit() -> None:
    try:
        asyncio.run(close_db())
    except RuntimeError:
        pass
    except Exception:
        pass


atexit.register(_dispose_on_exit)
