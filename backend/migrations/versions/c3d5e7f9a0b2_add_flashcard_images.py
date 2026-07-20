"""add hint_image and explanation_image to flashcards

Revision ID: c3d5e7f9a0b2
Revises: b2c4d6e8f0a1
Create Date: 2026-07-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "c3d5e7f9a0b2"
down_revision = "b2c4d6e8f0a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("flashcards", schema=None) as batch_op:
        batch_op.add_column(sa.Column("hint_image", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("explanation_image", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("flashcards", schema=None) as batch_op:
        batch_op.drop_column("explanation_image")
        batch_op.drop_column("hint_image")
