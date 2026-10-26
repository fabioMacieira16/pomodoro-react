"""Row Level Security nas tabelas do schema public (somente Postgres/Supabase).

O Supabase expõe o schema public numa API REST própria (Data API). Este app só
acessa o banco pelo backend, que conecta como `postgres` (ignora o RLS). Ligar o
RLS sem criar políticas bloqueia qualquer acesso direto por essa API, mesmo com a
publishable key, que fica visível no navegador.
"""
import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

ENABLE_RLS_SQL = """
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
"""


def enable_rls_on_public_tables(engine: Engine) -> None:
    """Liga o RLS nas tabelas que ainda não têm. Idempotente; não faz nada fora do Postgres."""
    if engine.dialect.name != "postgresql":
        return
    try:
        with engine.begin() as conn:
            conn.execute(text(ENABLE_RLS_SQL))
    except Exception:  # noqa: BLE001 - não derruba o app se o papel não tiver permissão
        logger.warning("Não foi possível ativar o RLS nas tabelas do schema public", exc_info=True)
