"""Add per-user AI credentials to settings table.

Revision ID: b2c4d6e8f0a1
Revises: f1a2b3c4d5e6
Create Date: 2026-06-24
"""
from alembic import op
import sqlalchemy as sa

revision = "b2c4d6e8f0a1"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("settings", schema=None) as batch_op:
        batch_op.add_column(sa.Column("ai_api_key_encrypted", sa.String(), nullable=False, server_default=""))
        batch_op.add_column(sa.Column("ollama_base_url", sa.String(), nullable=False, server_default=""))
        batch_op.add_column(sa.Column("ollama_model", sa.String(), nullable=False, server_default=""))


def downgrade() -> None:
    with op.batch_alter_table("settings", schema=None) as batch_op:
        batch_op.drop_column("ollama_model")
        batch_op.drop_column("ollama_base_url")
        batch_op.drop_column("ai_api_key_encrypted")
