from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Engine, text
from sqlalchemy.engine import Connection

from .database import Base
from .models import Payee  # noqa: F401 - registra la tabella nei metadata

SCHEMA_VERSION = 1


def _columns(connection: Connection, table: str) -> set[str]:
    rows = connection.execute(text(f'PRAGMA table_info("{table}")')).all()
    return {row[1] for row in rows}


def _add_payee_column(connection: Connection, table: str) -> None:
    if "payee_id" not in _columns(connection, table):
        connection.execute(
            text(
                f'ALTER TABLE "{table}" '
                'ADD COLUMN payee_id INTEGER REFERENCES payees(id) ON DELETE SET NULL'
            )
        )


def run_migrations(engine: Engine) -> None:
    """Create missing tables and apply additive schema migrations.

    SQLite's create_all() creates new tables but never alters existing ones.
    Existing installations already contain transactions and recurring rows,
    so the payee columns are added explicitly and recorded in schema_migrations.
    """
    Base.metadata.create_all(bind=engine)

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INTEGER PRIMARY KEY,
                    applied_at TEXT NOT NULL
                )
                """
            )
        )
        current = connection.execute(
            text("SELECT COALESCE(MAX(version), 0) FROM schema_migrations")
        ).scalar_one()

        if current < 1:
            _add_payee_column(connection, "transactions")
            _add_payee_column(connection, "recurring_transactions")

            for statement in (
                "CREATE INDEX IF NOT EXISTS ix_transactions_payee_id ON transactions(payee_id)",
                "CREATE INDEX IF NOT EXISTS ix_transactions_user_payee_date ON transactions(user_id, payee_id, date)",
                "CREATE INDEX IF NOT EXISTS ix_recurring_transactions_payee_id ON recurring_transactions(payee_id)",
            ):
                connection.execute(text(statement))

            connection.execute(
                text("INSERT INTO schema_migrations (version, applied_at) VALUES (:version, :applied_at)"),
                {
                    "version": 1,
                    "applied_at": datetime.now(timezone.utc).isoformat(),
                },
            )
