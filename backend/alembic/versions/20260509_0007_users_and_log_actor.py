from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260509_0007"
down_revision = "20260508_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "users" not in tables:
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("username", sa.String(length=64), nullable=False),
            sa.Column("password_hash", sa.String(length=200), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("login_attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("locked_until", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("username", name="uq_users_username"),
        )
        op.create_index("idx_users_username", "users", ["username"], unique=True)

    system_log_cols = {c["name"] for c in inspector.get_columns("system_logs")}
    with op.batch_alter_table("system_logs") as batch:
        if "actor_role" not in system_log_cols:
            batch.add_column(sa.Column("actor_role", sa.String(length=20), nullable=True))
        if "actor_uid" not in system_log_cols:
            batch.add_column(sa.Column("actor_uid", sa.Integer(), nullable=True))
        if "actor_username" not in system_log_cols:
            batch.add_column(sa.Column("actor_username", sa.String(length=64), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "system_logs" in tables:
        cols = {c["name"] for c in inspector.get_columns("system_logs")}
        with op.batch_alter_table("system_logs") as batch:
            if "actor_username" in cols:
                batch.drop_column("actor_username")
            if "actor_uid" in cols:
                batch.drop_column("actor_uid")
            if "actor_role" in cols:
                batch.drop_column("actor_role")

    if "users" in tables:
        op.drop_index("idx_users_username", table_name="users")
        op.drop_table("users")

