from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import asc, desc, func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Note
from ..schemas import CountRead, NoteCreate, NotePatch, NoteRead

router = APIRouter(prefix="/notes", tags=["notes"])


def apply_note_filters(stmt, q: Optional[str]):
    if q:
        stmt = stmt.where((Note.title.contains(q)) | (Note.content.contains(q)))
    return stmt


def apply_note_sort(stmt, sort: str):
    sort_field = sort.lstrip("-")
    order_fn = desc if sort.startswith("-") else asc
    if hasattr(Note, sort_field):
        return stmt.order_by(order_fn(getattr(Note, sort_field)))
    return stmt.order_by(desc(Note.created_at))


@router.get("/", response_model=list[NoteRead])
def list_notes(
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = Query(50, le=200),
    sort: str = Query("-created_at", description="依欄位排序；前綴 - 代表遞減排序"),
) -> list[NoteRead]:
    stmt = apply_note_sort(apply_note_filters(select(Note), q), sort)

    rows = db.execute(stmt.offset(skip).limit(limit)).scalars().all()
    return [NoteRead.model_validate(row) for row in rows]


@router.get("/count", response_model=CountRead)
def count_notes(
    db: Session = Depends(get_db),
    q: Optional[str] = None,
) -> CountRead:
    stmt = apply_note_filters(select(func.count()).select_from(Note), q)
    total = db.execute(stmt).scalar_one()
    return CountRead(total=total)


@router.post("/", response_model=NoteRead, status_code=201)
def create_note(payload: NoteCreate, db: Session = Depends(get_db)) -> NoteRead:
    note = Note(title=payload.title, content=payload.content)
    db.add(note)
    db.flush()
    db.refresh(note)
    return NoteRead.model_validate(note)


@router.patch("/{note_id}", response_model=NoteRead)
def patch_note(
    note_id: int, payload: NotePatch, db: Session = Depends(get_db)
) -> NoteRead:
    note = db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="找不到筆記")
    if payload.title is not None:
        note.title = payload.title
    if payload.content is not None:
        note.content = payload.content
    db.add(note)
    db.flush()
    db.refresh(note)
    return NoteRead.model_validate(note)


@router.get("/{note_id}", response_model=NoteRead)
def get_note(note_id: int, db: Session = Depends(get_db)) -> NoteRead:
    note = db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="找不到筆記")
    return NoteRead.model_validate(note)
