from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260510_0008"
down_revision = "20260509_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "admin_users" not in tables:
        return
    cols = {c["name"] for c in inspector.get_columns("admin_users")}
    with op.batch_alter_table("admin_users") as batch:
        if "acknowledged_alert_log_id" not in cols:
            batch.add_column(sa.Column("acknowledged_alert_log_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "admin_users" not in tables:
        return
    cols = {c["name"] for c in inspector.get_columns("admin_users")}
    with op.batch_alter_table("admin_users") as batch:
        if "acknowledged_alert_log_id" in cols:
            batch.drop_column("acknowledged_alert_log_id")
