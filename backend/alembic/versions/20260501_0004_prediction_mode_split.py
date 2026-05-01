from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


revision = "20260501_0004"
down_revision = "20260430_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    def _add_col(table: str, col: sa.Column) -> None:
        cols = {c["name"] for c in inspector.get_columns(table)}
        if col.name in cols:
            return
        with op.batch_alter_table(table) as batch:
            batch.add_column(col)

    _add_col(
        "model_versions",
        sa.Column("prediction_mode", sa.String(length=20), nullable=False, server_default="ai"),
    )
    bind.execute(text("UPDATE model_versions SET prediction_mode = 'ai' WHERE prediction_mode IS NULL OR prediction_mode = ''"))

    _add_col(
        "game_records",
        sa.Column("prediction_mode", sa.String(length=20), nullable=True),
    )
    bind.execute(text("UPDATE game_records SET prediction_mode = 'ai' WHERE prediction_mode IS NULL AND predict_direction IS NOT NULL"))
    _add_col(
        "mistake_book",
        sa.Column("prediction_mode", sa.String(length=20), nullable=True),
    )
    bind.execute(text("UPDATE mistake_book SET prediction_mode = 'ai' WHERE prediction_mode IS NULL"))
    _add_col(
        "ai_memories",
        sa.Column("prediction_mode", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    inspector = inspect(op.get_bind())

    def _drop_col(table: str, col_name: str) -> None:
        cols = {c["name"] for c in inspector.get_columns(table)}
        if col_name not in cols:
            return
        with op.batch_alter_table(table) as batch:
            batch.drop_column(col_name)

    _drop_col("ai_memories", "prediction_mode")
    _drop_col("mistake_book", "prediction_mode")
    _drop_col("game_records", "prediction_mode")
    _drop_col("model_versions", "prediction_mode")
