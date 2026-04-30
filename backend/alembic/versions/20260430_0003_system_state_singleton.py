from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


revision = "20260430_0003"
down_revision = "20260430_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("system_state")}
    indexes = {i["name"] for i in inspector.get_indexes("system_state")}

    with op.batch_alter_table("system_state") as batch:
        if "singleton_key" not in cols:
            batch.add_column(sa.Column("singleton_key", sa.Integer(), nullable=False, server_default="1"))
        if "uq_system_state_singleton_key" not in indexes:
            batch.create_index("uq_system_state_singleton_key", ["singleton_key"], unique=True)

    rows = bind.execute(text("SELECT id FROM system_state ORDER BY id DESC")).fetchall()
    if rows:
        keep_id = rows[0][0]
        bind.execute(text("UPDATE system_state SET singleton_key = 1"))
        bind.execute(text("DELETE FROM system_state WHERE id != :keep_id"), {"keep_id": keep_id})


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("system_state")}
    indexes = {i["name"] for i in inspector.get_indexes("system_state")}

    with op.batch_alter_table("system_state") as batch:
        if "uq_system_state_singleton_key" in indexes:
            batch.drop_index("uq_system_state_singleton_key")
        if "singleton_key" in cols:
            batch.drop_column("singleton_key")

