from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import asc, desc, func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import ActionItem
from ..schemas import ActionItemCreate, ActionItemPatch, ActionItemRead, CountRead

router = APIRouter(prefix="/action-items", tags=["action_items"])


def apply_action_item_filters(stmt, completed: Optional[bool]):
    if completed is not None:
        stmt = stmt.where(ActionItem.completed.is_(completed))
    return stmt


def apply_action_item_sort(stmt, sort: str):
    sort_field = sort.lstrip("-")
    order_fn = desc if sort.startswith("-") else asc
    if hasattr(ActionItem, sort_field):
        return stmt.order_by(order_fn(getattr(ActionItem, sort_field)))
    return stmt.order_by(desc(ActionItem.created_at))


@router.get("/", response_model=list[ActionItemRead])
def list_items(
    db: Session = Depends(get_db),
    completed: Optional[bool] = None,
    skip: int = 0,
    limit: int = Query(50, le=200),
    sort: str = Query("-created_at"),
) -> list[ActionItemRead]:
    stmt = apply_action_item_sort(
        apply_action_item_filters(select(ActionItem), completed), sort
    )

    rows = db.execute(stmt.offset(skip).limit(limit)).scalars().all()
    return [ActionItemRead.model_validate(row) for row in rows]


@router.get("/count", response_model=CountRead)
def count_items(
    db: Session = Depends(get_db),
    completed: Optional[bool] = None,
) -> CountRead:
    stmt = apply_action_item_filters(
        select(func.count()).select_from(ActionItem), completed
    )
    total = db.execute(stmt).scalar_one()
    return CountRead(total=total)


@router.post("/", response_model=ActionItemRead, status_code=201)
def create_item(
    payload: ActionItemCreate, db: Session = Depends(get_db)
) -> ActionItemRead:
    item = ActionItem(description=payload.description, completed=False)
    db.add(item)
    db.flush()
    db.refresh(item)
    return ActionItemRead.model_validate(item)


@router.put("/{item_id}/complete", response_model=ActionItemRead)
def complete_item(item_id: int, db: Session = Depends(get_db)) -> ActionItemRead:
    item = db.get(ActionItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="找不到待辦事項")
    item.completed = True
    db.add(item)
    db.flush()
    db.refresh(item)
    return ActionItemRead.model_validate(item)


@router.patch("/{item_id}", response_model=ActionItemRead)
def patch_item(
    item_id: int, payload: ActionItemPatch, db: Session = Depends(get_db)
) -> ActionItemRead:
    item = db.get(ActionItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="找不到待辦事項")
    if payload.description is not None:
        item.description = payload.description
    if payload.completed is not None:
        item.completed = payload.completed
    db.add(item)
    db.flush()
    db.refresh(item)
    return ActionItemRead.model_validate(item)
