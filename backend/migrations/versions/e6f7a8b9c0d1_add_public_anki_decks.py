"""add public visibility to anki decks

Revision ID: e6f7a8b9c0d1
Revises: f1a2b3c4d5e6
Create Date: 2026-11-23 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "b8d2e4f6a1c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    with op.batch_alter_table("anki_decks", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.false())
        )


def downgrade() -> None:
    with op.batch_alter_table("anki_decks", schema=None) as batch_op:
        batch_op.drop_column("is_public")
