from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260430_0002"
down_revision = "20260430_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("system_logs")}
    indexes = {i["name"] for i in inspector.get_indexes("system_logs")}

    with op.batch_alter_table("system_logs") as batch:
        if "task_id" not in cols:
            batch.add_column(sa.Column("task_id", sa.String(length=36), nullable=True))
        if "idx_log_task_id" not in indexes:
            batch.create_index("idx_log_task_id", ["task_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("system_logs")}
    indexes = {i["name"] for i in inspector.get_indexes("system_logs")}

    with op.batch_alter_table("system_logs") as batch:
        if "idx_log_task_id" in indexes:
            batch.drop_index("idx_log_task_id")
        if "task_id" in cols:
            batch.drop_column("task_id")
