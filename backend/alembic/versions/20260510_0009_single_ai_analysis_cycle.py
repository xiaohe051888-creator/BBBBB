from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260510_0009"
down_revision = "20260510_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "system_state" not in tables:
        return

    dialect_name = getattr(getattr(bind, "dialect", None), "name", "")
    retryable_default = sa.text("false") if dialect_name == "postgresql" else sa.text("0")

    cols = {c["name"] for c in inspector.get_columns("system_state")}
    with op.batch_alter_table("system_state") as batch:
        if "analysis_cycle_status" not in cols:
            batch.add_column(sa.Column("analysis_cycle_status", sa.String(length=20), nullable=True))
        if "analysis_cycle_stage" not in cols:
            batch.add_column(sa.Column("analysis_cycle_stage", sa.String(length=20), nullable=True))
        if "analysis_cycle_attempt" not in cols:
            batch.add_column(sa.Column("analysis_cycle_attempt", sa.Integer(), nullable=True))
        if "analysis_cycle_started_at" not in cols:
            batch.add_column(sa.Column("analysis_cycle_started_at", sa.DateTime(), nullable=True))
        if "analysis_cycle_deadline_at" not in cols:
            batch.add_column(sa.Column("analysis_cycle_deadline_at", sa.DateTime(), nullable=True))
        if "analysis_failure_code" not in cols:
            batch.add_column(sa.Column("analysis_failure_code", sa.String(length=64), nullable=True))
        if "analysis_failure_message" not in cols:
            batch.add_column(sa.Column("analysis_failure_message", sa.Text(), nullable=True))
        if "analysis_retryable" not in cols:
            batch.add_column(sa.Column("analysis_retryable", sa.Boolean(), nullable=False, server_default=retryable_default))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "system_state" not in tables:
        return

    cols = {c["name"] for c in inspector.get_columns("system_state")}
    with op.batch_alter_table("system_state") as batch:
        if "analysis_retryable" in cols:
            batch.drop_column("analysis_retryable")
        if "analysis_failure_message" in cols:
            batch.drop_column("analysis_failure_message")
        if "analysis_failure_code" in cols:
            batch.drop_column("analysis_failure_code")
        if "analysis_cycle_deadline_at" in cols:
            batch.drop_column("analysis_cycle_deadline_at")
        if "analysis_cycle_started_at" in cols:
            batch.drop_column("analysis_cycle_started_at")
        if "analysis_cycle_attempt" in cols:
            batch.drop_column("analysis_cycle_attempt")
        if "analysis_cycle_stage" in cols:
            batch.drop_column("analysis_cycle_stage")
        if "analysis_cycle_status" in cols:
            batch.drop_column("analysis_cycle_status")
