import os
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

load_dotenv()

DEFAULT_DB_PATH = os.getenv("DATABASE_PATH", "./data/app.db")
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SEED_PATH = PROJECT_ROOT / "data" / "seed.sql"

engine = create_engine(
    f"sqlite:///{DEFAULT_DB_PATH}", connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Iterator[Session]:
    session: Session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:  # noqa: BLE001
        session.rollback()
        raise
    finally:
        session.close()


@contextmanager
def get_session() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:  # noqa: BLE001
        session.rollback()
        raise
    finally:
        session.close()


def apply_seed_if_needed() -> None:
    db_path = Path(DEFAULT_DB_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    if not DEFAULT_SEED_PATH.exists():
        return

    with engine.begin() as conn:
        has_notes = conn.execute(
            text(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'notes'"
            )
        ).first()
        has_action_items = conn.execute(
            text(
                "SELECT name FROM sqlite_master "
                "WHERE type = 'table' AND name = 'action_items'"
            )
        ).first()

        note_count = (
            conn.execute(text("SELECT COUNT(*) FROM notes")).scalar_one()
            if has_notes
            else 0
        )
        action_item_count = (
            conn.execute(text("SELECT COUNT(*) FROM action_items")).scalar_one()
            if has_action_items
            else 0
        )
        if note_count > 0 or action_item_count > 0:
            return

        sql = DEFAULT_SEED_PATH.read_text()
        if sql.strip():
            for statement in [s.strip() for s in sql.split(";") if s.strip()]:
                conn.execute(text(statement))
