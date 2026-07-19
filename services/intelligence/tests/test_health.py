from fastapi.testclient import TestClient

from app.main import app, parse_cors_origins

client = TestClient(app)


def test_health_returns_200() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_parse_cors_origins_defaults_to_local_vite() -> None:
    assert parse_cors_origins(None) == ["http://localhost:5173"]
    assert parse_cors_origins("  ") == ["http://localhost:5173"]


def test_parse_cors_origins_accepts_comma_separated_values() -> None:
    assert parse_cors_origins("http://localhost:5173, https://studytracker.app") == [
        "http://localhost:5173",
        "https://studytracker.app",
    ]
