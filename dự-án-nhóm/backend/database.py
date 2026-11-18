import os
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


BACKEND_DIR = Path(__file__).resolve().parent
ENV_FILE = BACKEND_DIR / ".env"


def load_environment_file():
    if not ENV_FILE.exists():
        return

    for raw_line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


load_environment_file()

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///orange_team.db")
parsed_url = make_url(DATABASE_URL)

if parsed_url.drivername == "sqlite" and parsed_url.database not in (None, ":memory:"):
    database_path = Path(parsed_url.database)
    if not database_path.is_absolute():
        database_path = BACKEND_DIR / database_path
    database_path.parent.mkdir(parents=True, exist_ok=True)
    DATABASE_URL = URL.create("sqlite", database=str(database_path))

engine_options = {"pool_pre_ping": True}
if parsed_url.drivername == "sqlite":
    engine_options["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    database = SessionLocal()
    try:
        yield database
    finally:
        database.close()


def init_db():
    from backend.models import AuthSession, User

    Base.metadata.create_all(bind=engine)
    user_columns = {column["name"] for column in inspect(engine).get_columns("users")}
    if "role" not in user_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE users ADD COLUMN role VARCHAR(5) NOT NULL DEFAULT 'user' "
                    "CHECK (role IN ('user', 'admin'))"
                )
            )
    if "avatar_data" not in user_columns:
        avatar_column_type = {
            "postgresql": "BYTEA",
            "mysql": "MEDIUMBLOB",
        }.get(engine.dialect.name, "BLOB")
        with engine.begin() as connection:
            connection.execute(
                text(f"ALTER TABLE users ADD COLUMN avatar_data {avatar_column_type}")
            )
