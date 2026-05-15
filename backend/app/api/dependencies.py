from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core import security
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


def get_current_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

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
