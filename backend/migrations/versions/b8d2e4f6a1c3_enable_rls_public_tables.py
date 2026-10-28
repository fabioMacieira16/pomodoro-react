"""enable row level security on public tables (Postgres/Supabase only)

Revision ID: b8d2e4f6a1c3
Revises: a7c1d9e3b5f4
Create Date: 2026-10-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "b8d2e4f6a1c3"
down_revision = "a7c1d9e3b5f4"
branch_labels = None
depends_on = None

# Mesmo SQL de app/data/rls.py (cópia para a migração continuar autossuficiente).
ENABLE_RLS_SQL = """
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
"""


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute(sa.text(ENABLE_RLS_SQL))


def downgrade() -> None:
    # Propositalmente vazio: desligar o RLS reabriria as tabelas na Data API.
    pass
