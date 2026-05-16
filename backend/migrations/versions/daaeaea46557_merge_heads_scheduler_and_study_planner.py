"""merge heads scheduler and study planner

Revision ID: daaeaea46557
Revises: d1e2f3a4b5c6, e4b7c9d2a1f0
Create Date: 2026-05-16 20:33:14.490922

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'daaeaea46557'
down_revision: Union[str, None] = ('d1e2f3a4b5c6', 'e4b7c9d2a1f0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
