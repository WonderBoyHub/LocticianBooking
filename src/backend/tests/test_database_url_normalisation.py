from app.core.database import _normalise_async_database_url


def test_postgres_scheme_is_upgraded():
    url = "postgresql://user:pass@example.com/db"
    normalised = _normalise_async_database_url(url)
    assert normalised.startswith("postgresql+asyncpg://user:pass@example.com/db")


def test_postgres_short_hand_is_supported():
    url = "postgres://user:pass@example.com/db"
    normalised = _normalise_async_database_url(url)
    assert normalised.startswith("postgresql+asyncpg://user:pass@example.com/db")


def test_sslmode_parameter_removed():
    url = (
        "postgresql://user:pass@example.com/db"
        "?sslmode=require&application_name=myapp"
    )
    normalised = _normalise_async_database_url(url)
    assert "sslmode" not in normalised
    assert "application_name=myapp" in normalised


def test_non_postgres_url_unchanged():
    sqlite_url = "sqlite+aiosqlite:///./test.db"
    assert _normalise_async_database_url(sqlite_url) == sqlite_url
