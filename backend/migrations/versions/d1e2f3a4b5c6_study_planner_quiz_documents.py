"""study planner, quiz, documents extensions

Revision ID: d1e2f3a4b5c6
Revises: c7d4e5f8a910
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

revision = 'd1e2f3a4b5c6'
down_revision = 'c7d4e5f8a910'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extend Exam ────────────────────────────────────────────────────────
    with op.batch_alter_table('exams') as batch_op:
        batch_op.add_column(sa.Column('cargo',     sa.String(), nullable=True))
        batch_op.add_column(sa.Column('banca',     sa.String(), nullable=True))
        batch_op.add_column(sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False))

    # ── Extend ExamTopic ───────────────────────────────────────────────────
    with op.batch_alter_table('exam_topics') as batch_op:
        batch_op.add_column(sa.Column('peso',               sa.Float(),  server_default='1.0', nullable=False))
        batch_op.add_column(sa.Column('incidencia',         sa.Float(),  server_default='0.5', nullable=False))
        batch_op.add_column(sa.Column('personal_difficulty', sa.String(), server_default='Medium', nullable=False))

    # ── Extend PomodoroSession ─────────────────────────────────────────────
    with op.batch_alter_table('pomodoro_sessions') as batch_op:
        batch_op.add_column(sa.Column('topic_id',      sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('early_stopped', sa.Boolean(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('focus_score',   sa.Float(),   nullable=True))

    # ── Extend Flashcard ───────────────────────────────────────────────────
    with op.batch_alter_table('flashcards') as batch_op:
        batch_op.add_column(sa.Column('from_error', sa.Boolean(), server_default='0', nullable=False))

    # ── Extend Exercise ────────────────────────────────────────────────────
    with op.batch_alter_table('exercises') as batch_op:
        batch_op.add_column(sa.Column('hint',            sa.Text(),  nullable=True))
        batch_op.add_column(sa.Column('difficulty_score', sa.Float(), server_default='0.5', nullable=False))

    # ── Extend ExerciseAttempt ─────────────────────────────────────────────
    with op.batch_alter_table('exercise_attempts') as batch_op:
        batch_op.add_column(sa.Column('quiz_session_id', sa.Integer(), nullable=True))

    # ── New: exercise_options ──────────────────────────────────────────────
    op.create_table(
        'exercise_options',
        sa.Column('id',          sa.Integer(), primary_key=True),
        sa.Column('exercise_id', sa.Integer(), sa.ForeignKey('exercises.id'), nullable=False),
        sa.Column('text',        sa.Text(),    nullable=False),
        sa.Column('is_correct',  sa.Boolean(), server_default='0', nullable=False),
        sa.Column('position',    sa.Integer(), server_default='0', nullable=False),
    )

    # ── New: study_plan_configs ────────────────────────────────────────────
    op.create_table(
        'study_plan_configs',
        sa.Column('id',               sa.Integer(), primary_key=True),
        sa.Column('user_id',          sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('exam_id',          sa.Integer(), sa.ForeignKey('exams.id'), nullable=True),
        sa.Column('exam_id_2',        sa.Integer(), sa.ForeignKey('exams.id'), nullable=True),
        sa.Column('is_multi_edital',  sa.Boolean(), server_default='0', nullable=False),
        sa.Column('compatibility_pct', sa.Float(), nullable=True),
        sa.Column('wizard_answers',   sa.JSON(), nullable=True),
        sa.Column('generated_plan',   sa.JSON(), nullable=True),
        sa.Column('shared_topics',    sa.JSON(), nullable=True),
        sa.Column('exclusive_topics', sa.JSON(), nullable=True),
        sa.Column('status',           sa.String(), server_default='draft', nullable=False),
        sa.Column('created_at',       sa.DateTime(timezone=True), server_default=sa.text('(datetime("now"))')),
        sa.Column('updated_at',       sa.DateTime(timezone=True), nullable=True),
    )

    # ── New: quiz_sessions ─────────────────────────────────────────────────
    op.create_table(
        'quiz_sessions',
        sa.Column('id',                   sa.Integer(), primary_key=True),
        sa.Column('user_id',              sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('pomodoro_session_id',  sa.Integer(), sa.ForeignKey('pomodoro_sessions.id'), nullable=True),
        sa.Column('subject_id',           sa.Integer(), sa.ForeignKey('subjects.id'), nullable=True),
        sa.Column('total_questions',      sa.Integer(), server_default='5', nullable=False),
        sa.Column('correct_answers',      sa.Integer(), server_default='0', nullable=False),
        sa.Column('score_pct',            sa.Float(),   server_default='0.0', nullable=False),
        sa.Column('difficulty_level',     sa.String(),  server_default='Medium', nullable=False),
        sa.Column('session_mode',         sa.String(),  server_default='quiz', nullable=False),
        sa.Column('completed',            sa.Boolean(), server_default='0', nullable=False),
        sa.Column('created_at',           sa.DateTime(timezone=True), server_default=sa.text('(datetime("now"))')),
    )

    # ── New: error_cards ───────────────────────────────────────────────────
    op.create_table(
        'error_cards',
        sa.Column('id',           sa.Integer(), primary_key=True),
        sa.Column('user_id',      sa.Integer(), sa.ForeignKey('users.id'),             nullable=False),
        sa.Column('attempt_id',   sa.Integer(), sa.ForeignKey('exercise_attempts.id'), nullable=False, unique=True),
        sa.Column('flashcard_id', sa.Integer(), sa.ForeignKey('flashcards.id'),        nullable=False, unique=True),
        sa.Column('subject_id',   sa.Integer(), sa.ForeignKey('subjects.id'),          nullable=True),
        sa.Column('subdeck',      sa.String(),  nullable=True),
        sa.Column('origin_text',  sa.Text(),    nullable=True),
        sa.Column('created_at',   sa.DateTime(timezone=True), server_default=sa.text('(datetime("now"))')),
    )

    # ── New: document_indexes ─────────────────────────────────────────────
    op.create_table(
        'document_indexes',
        sa.Column('id',            sa.Integer(), primary_key=True),
        sa.Column('user_id',       sa.Integer(), sa.ForeignKey('users.id'),     nullable=False),
        sa.Column('subject_id',    sa.Integer(), sa.ForeignKey('subjects.id'),  nullable=True),
        sa.Column('filename',      sa.String(),  nullable=False),
        sa.Column('file_path',     sa.String(),  nullable=False),
        sa.Column('file_type',     sa.String(),  server_default='pdf', nullable=False),
        sa.Column('file_size_kb',  sa.Integer(), nullable=True),
        sa.Column('concurso',      sa.String(),  nullable=True),
        sa.Column('disciplina',    sa.String(),  nullable=True),
        sa.Column('doc_type',      sa.String(),  server_default='material', nullable=False),
        sa.Column('page_count',    sa.Integer(), nullable=True),
        sa.Column('summary',       sa.Text(),    nullable=True),
        sa.Column('topics_json',   sa.JSON(),    nullable=True),
        sa.Column('metadata_json', sa.JSON(),    nullable=True),
        sa.Column('indexed_at',    sa.DateTime(timezone=True), server_default=sa.text('(datetime("now"))')),
        sa.Column('is_indexed',    sa.Boolean(), server_default='0', nullable=False),
    )


def downgrade() -> None:
    op.drop_table('document_indexes')
    op.drop_table('error_cards')
    op.drop_table('quiz_sessions')
    op.drop_table('study_plan_configs')
    op.drop_table('exercise_options')
    with op.batch_alter_table('exercise_attempts') as batch_op:
        batch_op.drop_column('quiz_session_id')
    with op.batch_alter_table('exercises') as batch_op:
        batch_op.drop_column('difficulty_score')
        batch_op.drop_column('hint')
    with op.batch_alter_table('flashcards') as batch_op:
        batch_op.drop_column('from_error')
    with op.batch_alter_table('pomodoro_sessions') as batch_op:
        batch_op.drop_column('focus_score')
        batch_op.drop_column('early_stopped')
        batch_op.drop_column('topic_id')
    with op.batch_alter_table('exam_topics') as batch_op:
        batch_op.drop_column('personal_difficulty')
        batch_op.drop_column('incidencia')
        batch_op.drop_column('peso')
    with op.batch_alter_table('exams') as batch_op:
        batch_op.drop_column('is_active')
        batch_op.drop_column('banca')
        batch_op.drop_column('cargo')
