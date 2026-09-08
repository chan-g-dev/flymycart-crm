"""Always run tests against a disposable database, never the configured CRM."""
import os
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
_database_dir = tempfile.TemporaryDirectory(prefix="fmc-tests-")
os.environ["DATABASE_URL"] = "sqlite:///" + str(Path(_database_dir.name) / "test.db").replace("\\", "/")
os.environ["DEBUG"] = "false"
os.environ["STORAGE_PROVIDER"] = "local"


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database():
    from app.database import Base, engine, SessionLocal
    from app.seed import seed_database
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_database(db)
    yield
    engine.dispose()
    _database_dir.cleanup()
