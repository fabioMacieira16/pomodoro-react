"""Validação de tokens emitidos pelo Supabase Auth.

Projetos novos assinam o JWT com chave assimétrica (JWKS publicado em
``/auth/v1/.well-known/jwks.json``); projetos antigos usam o segredo HS256
(``SUPABASE_JWT_SECRET``). Os dois formatos são aceitos.
"""
import threading
import time

import httpx
from jose import JWTError, jwt

from app.core.config import settings

_JWKS_TTL_SECONDS = 600
_jwks_lock = threading.Lock()
_jwks_cache: dict = {"keys": [], "fetched_at": 0.0}


class InvalidSupabaseToken(Exception):
    pass


def _issuer() -> str:
    return f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1"


def _fetch_jwks(force: bool = False) -> list[dict]:
    with _jwks_lock:
        fresh = time.time() - _jwks_cache["fetched_at"] < _JWKS_TTL_SECONDS
        if _jwks_cache["keys"] and fresh and not force:
            return _jwks_cache["keys"]
        try:
            response = httpx.get(f"{_issuer()}/.well-known/jwks.json", timeout=5.0)
            response.raise_for_status()
            keys = response.json().get("keys", [])
        except (httpx.HTTPError, ValueError) as exc:
            if _jwks_cache["keys"]:
                return _jwks_cache["keys"]  # usa o cache antigo se o Supabase oscilar
            raise InvalidSupabaseToken("Não foi possível obter as chaves do Supabase") from exc
        _jwks_cache.update(keys=keys, fetched_at=time.time())
        return keys


def _find_key(kid: str | None) -> dict:
    for force in (False, True):  # na segunda tentativa recarrega, caso a chave tenha rodado
        for key in _fetch_jwks(force=force):
            if kid is None or key.get("kid") == kid:
                return key
    raise InvalidSupabaseToken("Chave de assinatura desconhecida")


def verify_supabase_token(token: str) -> dict:
    """Retorna as claims do token ou levanta InvalidSupabaseToken."""
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "")
        if alg == "HS256":
            if not settings.SUPABASE_JWT_SECRET:
                raise InvalidSupabaseToken("SUPABASE_JWT_SECRET não configurado")
            key: str | dict = settings.SUPABASE_JWT_SECRET
        elif alg in ("RS256", "ES256"):
            key = _find_key(header.get("kid"))
        else:
            raise InvalidSupabaseToken("Algoritmo não suportado")

        return jwt.decode(
            token,
            key,
            algorithms=[alg],
            audience="authenticated",
            issuer=_issuer(),
        )
    except JWTError as exc:
        raise InvalidSupabaseToken(str(exc)) from exc
