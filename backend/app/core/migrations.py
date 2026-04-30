from pathlib import Path
from typing import Optional

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text, inspect


def _alembic_config() -> Config:
    backend_dir = Path(__file__).resolve().parents[2]
    cfg = Config(str(backend_dir / "alembic.ini"))
    cfg.set_main_option("script_location", str(backend_dir / "alembic"))
    return cfg


def get_alembic_heads() -> list[str]:
    script = ScriptDirectory.from_config(_alembic_config())
    return list(script.get_heads())


def get_current_revision(sync_conn) -> Optional[str]:
    inspector = inspect(sync_conn)
    if not inspector.has_table("alembic_version"):
        return None
    try:
        return sync_conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
    except Exception:
        return None


def validate_migrations_at_head(sync_conn) -> None:
    current = get_current_revision(sync_conn)
    if not current:
        raise RuntimeError("生产环境数据库未完成迁移，请先执行 alembic upgrade head")
    heads = get_alembic_heads()
    if current not in heads:
        raise RuntimeError("生产环境数据库迁移版本不是最新，请先执行 alembic upgrade head")

