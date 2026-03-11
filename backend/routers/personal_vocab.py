"""Personal vocabulary router — translate, save, review."""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.core.qwen import translate_phrase
from backend.core.sm2 import QUALITY_MAP, sm2_update
from backend.database import get_session
from backend.models.personal_vocab import PersonalVocab
from backend.models.user import User
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/personal-vocab", tags=["personal-vocab"])


# ── Translate ────────────────────────────────────────────────────────────────


class TranslateRequest(BaseModel):
    text: str
    context: str = ""


class TranslateResponse(BaseModel):
    dutch: str
    english: str


@router.post("/translate", response_model=TranslateResponse)
def translate(
    req: TranslateRequest,
    _user: User = Depends(get_current_user),
):
    try:
        english = translate_phrase(req.text, req.context)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return TranslateResponse(dutch=req.text, english=english)


# ── Save ─────────────────────────────────────────────────────────────────────


class SaveRequest(BaseModel):
    dutch: str
    english: str
    source: str = "reading"
    context_sentence: str = ""


class PersonalVocabOut(BaseModel):
    id: int
    dutch: str
    english: str
    source: str
    context_sentence: str
    notes: str
    created_at: str
    interval: int
    ease_factor: float
    repetitions: int
    next_review: str
    mastered: bool


def _to_out(pv: PersonalVocab) -> PersonalVocabOut:
    return PersonalVocabOut(
        id=pv.id,
        dutch=pv.dutch,
        english=pv.english,
        source=pv.source,
        context_sentence=pv.context_sentence,
        notes=pv.notes,
        created_at=pv.created_at.isoformat(),
        interval=pv.interval,
        ease_factor=pv.ease_factor,
        repetitions=pv.repetitions,
        next_review=pv.next_review.isoformat(),
        mastered=pv.mastered,
    )


@router.post("/save", response_model=PersonalVocabOut)
def save(
    req: SaveRequest,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    # Dedup: same user + same dutch text
    existing = db.exec(
        select(PersonalVocab).where(
            PersonalVocab.user_id == user.id,
            PersonalVocab.dutch == req.dutch,
        )
    ).first()
    if existing:
        return _to_out(existing)

    pv = PersonalVocab(
        user_id=user.id,
        dutch=req.dutch,
        english=req.english,
        source=req.source,
        context_sentence=req.context_sentence,
    )
    db.add(pv)
    db.commit()
    db.refresh(pv)
    return _to_out(pv)


# ── List ─────────────────────────────────────────────────────────────────────


@router.get("", response_model=list[PersonalVocabOut])
def list_vocab(
    source: Optional[str] = None,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    stmt = select(PersonalVocab).where(PersonalVocab.user_id == user.id)
    if source:
        stmt = stmt.where(PersonalVocab.source == source)
    stmt = stmt.order_by(PersonalVocab.created_at.desc())  # type: ignore[union-attr]
    items = db.exec(stmt).all()
    return [_to_out(pv) for pv in items]


# ── Delete ───────────────────────────────────────────────────────────────────


@router.delete("/{item_id}")
def delete_vocab(
    item_id: int,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    pv = db.get(PersonalVocab, item_id)
    if not pv or pv.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(pv)
    db.commit()
    return {"ok": True}


# ── Update ───────────────────────────────────────────────────────────────────


class UpdateRequest(BaseModel):
    notes: Optional[str] = None
    english: Optional[str] = None


@router.patch("/{item_id}", response_model=PersonalVocabOut)
def update_vocab(
    item_id: int,
    req: UpdateRequest,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    pv = db.get(PersonalVocab, item_id)
    if not pv or pv.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")
    if req.notes is not None:
        pv.notes = req.notes
    if req.english is not None:
        pv.english = req.english
    db.commit()
    db.refresh(pv)
    return _to_out(pv)


# ── Review session ───────────────────────────────────────────────────────────


class SessionOut(BaseModel):
    cards: list[PersonalVocabOut]
    due_count: int


@router.get("/session", response_model=SessionOut)
def get_review_session(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    today = date.today()
    due = db.exec(
        select(PersonalVocab).where(
            PersonalVocab.user_id == user.id,
            PersonalVocab.mastered == False,  # noqa: E712
            PersonalVocab.next_review <= today,
        )
    ).all()
    cards = [_to_out(pv) for pv in due[:30]]
    return SessionOut(cards=cards, due_count=len(due))


# ── Review submit ────────────────────────────────────────────────────────────


class ReviewRequest(BaseModel):
    id: int
    rating: str  # "again" | "hard" | "good" | "easy" | "mastered"


class ReviewOut(BaseModel):
    next_review: str
    interval: int
    ease_factor: float
    mastered: bool


@router.post("/review", response_model=ReviewOut)
def submit_review(
    req: ReviewRequest,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    pv = db.get(PersonalVocab, req.id)
    if not pv or pv.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")

    if req.rating == "mastered":
        pv.mastered = True
        db.commit()
        db.refresh(pv)
        return ReviewOut(
            next_review=pv.next_review.isoformat(),
            interval=pv.interval,
            ease_factor=pv.ease_factor,
            mastered=True,
        )

    quality = QUALITY_MAP.get(req.rating)
    if quality is None:
        raise HTTPException(status_code=400, detail=f"Unknown rating: {req.rating}")

    state = {
        "interval": pv.interval,
        "ease_factor": pv.ease_factor,
        "repetitions": pv.repetitions,
        "direction": "nl_en",  # dummy, required by sm2_update
        "mastered": pv.mastered,
    }
    new_state = sm2_update(state, quality)

    pv.interval = new_state["interval"]
    pv.ease_factor = new_state["ease_factor"]
    pv.repetitions = new_state["repetitions"]
    pv.next_review = date.fromisoformat(new_state["next_review"])
    db.commit()

    return ReviewOut(
        next_review=new_state["next_review"],
        interval=new_state["interval"],
        ease_factor=new_state["ease_factor"],
        mastered=False,
    )
