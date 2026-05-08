from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260508_0005"
down_revision = "20260501_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("ai_model_configs")}

    with op.batch_alter_table("ai_model_configs") as batch:
        if "api_key_encrypted" not in cols:
            batch.add_column(sa.Column("api_key_encrypted", sa.Text(), nullable=True))
        if "api_key_last4" not in cols:
            batch.add_column(sa.Column("api_key_last4", sa.String(length=8), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("ai_model_configs")}

    with op.batch_alter_table("ai_model_configs") as batch:
        if "api_key_last4" in cols:
            batch.drop_column("api_key_last4")
        if "api_key_encrypted" in cols:
            batch.drop_column("api_key_encrypted")
