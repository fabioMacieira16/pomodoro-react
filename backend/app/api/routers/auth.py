from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app import dtos
from appcore import security
from appdata.database import get_db
from appdata.repositories import user_repo

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=dtos.UserResponse)
def register(user_in: dtos.UserCreate, db: Session = Depends(get_db)):
    user = user_repo.get_by_username(db, user_in.username)
    if user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = security.get_password_hash(user_in.password)
    new_user = user_repo.create(db, {
        "username": user_in.username,
        "email": user_in.email,
        "hashed_password": hashed_password
    })
    return new_user

@router.post("/login", response_model=dtos.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = user_repo.get_by_username(db, form_data.username)
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = security.create_access_token(subject=user.username)
    return {"access_token": access_token, "token_type": "bearer"}
