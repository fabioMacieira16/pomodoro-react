"""anki_system_v2

Revision ID: a3f9c2e8b471
Revises: 61a8b75e1a78
Create Date: 2026-05-14 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f9c2e8b471'
down_revision: Union[str, None] = '61a8b75e1a78'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Modify anki_decks ──────────────────────────────────────────────────
    with op.batch_alter_table('anki_decks', schema=None) as batch_op:
        batch_op.add_column(sa.Column('description', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('color', sa.String(), nullable=True, server_default='#3b82f6'))
        batch_op.add_column(sa.Column('parent_deck_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_anki_decks_parent_deck_id',
            'anki_decks',
            ['parent_deck_id'],
            ['id'],
        )
        batch_op.add_column(sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True))
        # subject_id may already be NOT NULL in old schema - make it nullable
        batch_op.alter_column('subject_id', existing_type=sa.Integer(), nullable=True)

    # ── Modify flashcards ──────────────────────────────────────────────────
    with op.batch_alter_table('flashcards', schema=None) as batch_op:
        batch_op.add_column(sa.Column('card_type', sa.String(), nullable=True, server_default='qa'))
        batch_op.add_column(sa.Column('hint', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('tags', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('difficulty', sa.String(), nullable=True, server_default='Medium'))
        batch_op.add_column(sa.Column('repetitions', sa.Integer(), nullable=True, server_default='0'))
        batch_op.add_column(sa.Column('lapses', sa.Integer(), nullable=True, server_default='0'))
        batch_op.add_column(sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True))
        # Rename ease_factor -> easiness_factor if it exists; otherwise add it
        try:
            batch_op.alter_column('ease_factor', new_column_name='easiness_factor', existing_type=sa.Float())
        except Exception:
            batch_op.add_column(sa.Column('easiness_factor', sa.Float(), nullable=True, server_default='2.5'))

    # ── Create flashcard_options ───────────────────────────────────────────
    op.create_table(
        'flashcard_options',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('flashcard_id', sa.Integer(), sa.ForeignKey('flashcards.id'), nullable=True),
        sa.Column('text', sa.Text(), nullable=True),
        sa.Column('is_correct', sa.Boolean(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('flashcard_options', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_flashcard_options_id'), ['id'], unique=False)

    # ── Create flashcard_reviews ───────────────────────────────────────────
    op.create_table(
        'flashcard_reviews',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('flashcard_id', sa.Integer(), sa.ForeignKey('flashcards.id'), nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('quality', sa.Integer(), nullable=True),
        sa.Column('response_time_ms', sa.Integer(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('flashcard_reviews', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_flashcard_reviews_id'), ['id'], unique=False)


def downgrade() -> None:
    op.drop_table('flashcard_reviews')
    op.drop_table('flashcard_options')

    with op.batch_alter_table('flashcards', schema=None) as batch_op:
        batch_op.drop_column('created_at')
        batch_op.drop_column('lapses')
        batch_op.drop_column('repetitions')
        batch_op.drop_column('difficulty')
        batch_op.drop_column('tags')
        batch_op.drop_column('hint')
        batch_op.drop_column('card_type')
        try:
            batch_op.alter_column('easiness_factor', new_column_name='ease_factor', existing_type=sa.Float())
        except Exception:
            pass

    with op.batch_alter_table('anki_decks', schema=None) as batch_op:
        batch_op.drop_column('created_at')
        batch_op.drop_column('parent_deck_id')
        batch_op.drop_column('color')
        batch_op.drop_column('description')
