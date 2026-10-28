from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core import security
from app.core.supabase_auth import InvalidSupabaseToken, verify_supabase_token
from app.data.database import get_db
from app.data.repositories import user_repo
from app.domain.models import User
from app.api import dtos

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)


def _get_or_create_dev_user(db: Session) -> User:
    user = user_repo.get_by_username(db, settings.DEV_AUTH_USERNAME)
    if user is not None:
        return user

    first_user = user_repo.get_all(db, limit=1)
    if first_user:
        return first_user[0]

    return user_repo.create(
        db,
        {
            "username": settings.DEV_AUTH_USERNAME,
            "email": f"{settings.DEV_AUTH_USERNAME}@local.dev",
            "hashed_password": security.get_password_hash("admin123"),
            "is_active": True,
        },
    )


def _get_or_create_supabase_user(db: Session, claims: dict, credentials_exception: HTTPException) -> User:
    """Liga o usuário do Supabase (claim `sub`) a uma linha da tabela users."""
    auth_uid = claims.get("sub")
    email = (claims.get("email") or "").strip().lower()
    if not auth_uid or not email:
        raise credentials_exception

    # Com "Confirm email" ligado o Supabase nem emite token antes da confirmação;
    # esta checagem é uma segunda barreira caso a opção seja desligada por engano.
    email_verified = (claims.get("user_metadata") or {}).get("email_verified")
    if email_verified is False:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="E-mail ainda não verificado")

    user = user_repo.get_by_auth_uid(db, auth_uid)

    if user is None:
        existing = user_repo.get_by_email(db, email)
        if existing is not None:
            # Só vincula uma conta antiga pelo e-mail se o Supabase garante que ele é do dono.
            if existing.auth_uid or email_verified is not True:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="E-mail já vinculado a outra conta")
            user = user_repo.update(db, existing, {"auth_uid": auth_uid})
        else:
            username = email
            if user_repo.get_by_username(db, username):
                username = f"{email}#{auth_uid[:8]}"
            try:
                user = user_repo.create(
                    db,
                    {
                        "username": username,
                        "email": email,
                        "hashed_password": None,
                        "auth_uid": auth_uid,
                        "is_active": True,
                    },
                )
            except IntegrityError:
                # Várias requisições simultâneas no primeiro acesso: outra já criou o usuário.
                db.rollback()
                user = user_repo.get_by_auth_uid(db, auth_uid)
                if user is None:
                    raise

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conta desativada")
    return user


def get_current_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if settings.supabase_enabled:
        # Em modo Supabase só valem tokens do Supabase; o bypass de dev é ignorado.
        if not token:
            raise credentials_exception
        try:
            claims = verify_supabase_token(token)
        except InvalidSupabaseToken:
            raise credentials_exception
        return _get_or_create_supabase_user(db, claims, credentials_exception)

    if not token:
        if settings.ALLOW_DEV_AUTH_BYPASS:
            return _get_or_create_dev_user(db)
        raise credentials_exception

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = dtos.TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = user_repo.get_by_username(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user
