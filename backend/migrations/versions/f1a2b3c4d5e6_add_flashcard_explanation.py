"""add_flashcard_explanation

Revision ID: f1a2b3c4d5e6
Revises: daaeaea46557
Create Date: 2026-06-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'daaeaea46557'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('flashcards', schema=None) as batch_op:
        batch_op.add_column(sa.Column('explanation', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('flashcards', schema=None) as batch_op:
        batch_op.drop_column('explanation')
