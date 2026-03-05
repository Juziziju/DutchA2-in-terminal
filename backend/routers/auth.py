"""Authentication router — register and login."""

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.core.auth import create_access_token, hash_password, verify_password, decode_token
from backend.database import get_session
from backend.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, session: Session = Depends(get_session)):
    if len(req.username) < 2 or len(req.password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Username must be >= 2 chars; password >= 6 chars.",
        )
    existing = session.exec(select(User).where(User.username == req.username)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken.")

    user = User(username=req.username, hashed_password=hash_password(req.password))
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, username=user.username)


@router.post("/login", response_model=TokenResponse)
def login(req: RegisterRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.username == req.username)).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, username=user.username)


# ── Shared dependency ─────────────────────────────────────────────────────────

from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> User:
    try:
        payload = decode_token(token)
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user
