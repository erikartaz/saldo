from __future__ import annotations

import os
from pathlib import Path

TEST_DB = Path(__file__).parent / "test_saldo.db"
for suffix in ("", "-wal", "-shm"):
    candidate = Path(str(TEST_DB) + suffix)
    if candidate.exists():
        candidate.unlink()

os.environ["SALDO_DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["SALDO_JWT_SECRET"] = "test-secret-key-that-is-long-enough-for-hs256"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client
