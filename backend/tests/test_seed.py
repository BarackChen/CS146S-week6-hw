from backend.app import db
from backend.app.models import Base
from sqlalchemy import create_engine, text


def test_apply_seed_if_needed_after_schema_created(tmp_path, monkeypatch):
    db_path = tmp_path / "app.db"
    seed_path = tmp_path / "seed.sql"
    seed_path.write_text("""
        INSERT INTO notes (title, content) VALUES ('Seed note', 'Seed content');
        INSERT INTO action_items (description, completed) VALUES ('Seed item', 0);
        """)
    test_engine = create_engine(
        f"sqlite:///{db_path}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=test_engine)

    monkeypatch.setattr(db, "DEFAULT_DB_PATH", str(db_path))
    monkeypatch.setattr(db, "DEFAULT_SEED_PATH", seed_path)
    monkeypatch.setattr(db, "engine", test_engine)

    db.apply_seed_if_needed()
    db.apply_seed_if_needed()

    with test_engine.connect() as conn:
        note_count = conn.execute(text("SELECT COUNT(*) FROM notes")).scalar_one()
        action_item_count = conn.execute(
            text("SELECT COUNT(*) FROM action_items")
        ).scalar_one()

    assert note_count == 1
    assert action_item_count == 1
