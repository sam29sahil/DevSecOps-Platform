import os
import tempfile
import pytest
from app.models import init_db


@pytest.fixture(autouse=True)
def isolate_test_database(tmp_path, monkeypatch):
    """Ensure test suites run against an isolated SQLite database, protecting data/devsecops.db."""
    test_db = tmp_path / "test_run.db"
    monkeypatch.setenv("DEVSECOPS_DB_PATH", str(test_db))
    monkeypatch.setenv("TESTING", "true")
    monkeypatch.setenv("FLASK_ENV", "testing")
    init_db()
    yield
