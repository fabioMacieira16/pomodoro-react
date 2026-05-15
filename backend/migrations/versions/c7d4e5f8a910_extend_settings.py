"""Extend settings table with new columns.

Revision ID: c7d4e5f8a910
Revises: a3f9c2e8b471
Create Date: 2026-05-14
"""
from alembic import op
import sqlalchemy as sa

revision = "c7d4e5f8a910"
down_revision = "a3f9c2e8b471"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # All columns are nullable with server defaults so existing rows are safe.
    with op.batch_alter_table("settings", schema=None) as batch_op:
        batch_op.add_column(sa.Column("work_duration_minutes",  sa.Integer(), nullable=False, server_default="25"))
        batch_op.add_column(sa.Column("short_break_minutes",    sa.Integer(), nullable=False, server_default="5"))
        batch_op.add_column(sa.Column("long_break_minutes",     sa.Integer(), nullable=False, server_default="15"))
        batch_op.add_column(sa.Column("language",               sa.String(),  nullable=False, server_default="pt"))
        batch_op.add_column(sa.Column("ai_provider_preference", sa.String(),  nullable=False, server_default=""))
        batch_op.add_column(sa.Column("weekly_goal_minutes",    sa.Integer(), nullable=False, server_default="600"))
        batch_op.add_column(sa.Column("notifications_enabled",  sa.Boolean(), nullable=False, server_default=sa.true()))
        batch_op.add_column(sa.Column("desktop_notifications",  sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    with op.batch_alter_table("settings", schema=None) as batch_op:
        batch_op.drop_column("desktop_notifications")
        batch_op.drop_column("notifications_enabled")
        batch_op.drop_column("weekly_goal_minutes")
        batch_op.drop_column("ai_provider_preference")
        batch_op.drop_column("language")
        batch_op.drop_column("long_break_minutes")
        batch_op.drop_column("short_break_minutes")
        batch_op.drop_column("work_duration_minutes")
