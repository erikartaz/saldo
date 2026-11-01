from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import LoginIn, PasswordChange, ProfileUpdate, SetupIn, TokenOut, UserOut
from ..security import create_access_token, hash_password, verify_password
from ..seed import seed_default_categories

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _token_response(user: User) -> TokenOut:
    return TokenOut(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.get("/status")
def auth_status(db: Session = Depends(get_db)) -> dict[str, bool]:
    count = db.scalar(select(func.count(User.id))) or 0
    return {"needs_setup": count == 0}


@router.post("/setup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def setup(payload: SetupIn, db: Session = Depends(get_db)) -> TokenOut:
    count = db.scalar(select(func.count(User.id))) or 0
    if count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account già configurato. Effettua l'accesso.",
        )
    email = payload.email.lower().strip()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Email già registrata")

    user = User(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        currency="EUR",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    seed_default_categories(db, user.id)
    return _token_response(user)


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    email = payload.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o password non corretti",
        )
    return _token_response(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/profile", response_model=UserOut)
def update_profile(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    email = payload.email.lower().strip()
    existing = db.scalar(select(User).where(User.email == email, User.id != user.id))
    if existing:
        raise HTTPException(status_code=409, detail="Email già usata da un altro account")
    user.name = payload.name.strip()
    user.email = email
    db.commit()
    db.refresh(user)
    return user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: PasswordChange,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="La password attuale non è corretta")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="La nuova password deve essere diversa")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
