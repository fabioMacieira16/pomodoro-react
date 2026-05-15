"""add scheduler tables

Revision ID: e4b7c9d2a1f0
Revises: c7d4e5f8a910
Create Date: 2026-05-15
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4b7c9d2a1f0'
down_revision: Union[str, None] = 'c7d4e5f8a910'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'exams',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('exam_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('daily_hours', sa.Float(), nullable=False),
        sa.Column('available_days', sa.String(), nullable=False, server_default='[0,1,2,3,4]'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('exams', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_exams_id'), ['id'], unique=False)

    op.create_table(
        'exam_topics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('exam_id', sa.Integer(), nullable=False),
        sa.Column('subject_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('estimated_hours', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='2'),
        sa.ForeignKeyConstraint(['exam_id'], ['exams.id']),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('exam_topics', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_exam_topics_id'), ['id'], unique=False)

    op.create_table(
        'study_plan_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('exam_id', sa.Integer(), nullable=False),
        sa.Column('exam_topic_id', sa.Integer(), nullable=False),
        sa.Column('scheduled_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('session_type', sa.String(), nullable=False),
        sa.Column('review_interval', sa.Integer(), nullable=True),
        sa.Column('completed', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(['exam_id'], ['exams.id']),
        sa.ForeignKeyConstraint(['exam_topic_id'], ['exam_topics.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('study_plan_items', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_study_plan_items_id'), ['id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('study_plan_items', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_study_plan_items_id'))
    op.drop_table('study_plan_items')

    with op.batch_alter_table('exam_topics', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_exam_topics_id'))
    op.drop_table('exam_topics')

    with op.batch_alter_table('exams', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_exams_id'))
    op.drop_table('exams')