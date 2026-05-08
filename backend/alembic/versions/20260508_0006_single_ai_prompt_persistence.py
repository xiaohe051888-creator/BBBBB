from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260508_0006"
down_revision = "20260508_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("ai_model_configs")}

    with op.batch_alter_table("ai_model_configs") as batch:
        if "realtime_strategy_prompt_b64" not in cols:
            batch.add_column(sa.Column("realtime_strategy_prompt_b64", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("ai_model_configs")}

    with op.batch_alter_table("ai_model_configs") as batch:
        if "realtime_strategy_prompt_b64" in cols:
            batch.drop_column("realtime_strategy_prompt_b64")
