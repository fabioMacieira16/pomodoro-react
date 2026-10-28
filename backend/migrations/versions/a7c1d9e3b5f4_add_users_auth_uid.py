"""add auth_uid to users (Supabase Auth)

Revision ID: a7c1d9e3b5f4
Revises: c3d5e7f9a0b2
Create Date: 2026-10-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "a7c1d9e3b5f4"
down_revision = "c3d5e7f9a0b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("auth_uid", sa.String(), nullable=True))
        batch_op.create_index("ix_users_auth_uid", ["auth_uid"], unique=True)


def downgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_index("ix_users_auth_uid")
        batch_op.drop_column("auth_uid")
