import json

import pytest

from scripts import full_app


def test_expand_profile_uses_dependency_order() -> None:
    assert full_app.expand_profile("full") == ["intelligence", "app"]
    assert full_app.expand_profile("all") == ["intelligence", "app", "marketing"]
    assert full_app.expand_profile("app") == ["app"]


def test_expand_profile_rejects_unknown_profile() -> None:
    with pytest.raises(ValueError, match="unknown profile"):
        full_app.expand_profile("nope")


def test_state_round_trip(tmp_path) -> None:
    state_file = tmp_path / "state.json"
    state = {
        "version": 1,
        "services": {
            "app": {
                "pid": 123,
                "pgid": 123,
                "command": ["pnpm", "dev:app"],
            }
        },
    }

    full_app.save_state(state, state_file)

    assert json.loads(state_file.read_text()) == state
    assert full_app.load_state(state_file) == state


def test_prune_stale_services_removes_dead_pids(monkeypatch) -> None:
    state = {
        "version": 1,
        "services": {
            "app": {"pid": 123, "pgid": 123},
            "intelligence": {"pid": 456, "pgid": 456},
        },
    }

    monkeypatch.setattr(full_app, "pid_alive", lambda pid: pid == 456)

    stale = full_app.prune_stale_services(state)

    assert stale == ["app"]
    assert set(state["services"]) == {"intelligence"}


def test_port_blocked_by_foreign_process(monkeypatch) -> None:
    service = full_app.SERVICES["app"]
    state = {"version": 1, "services": {}}
    listener = full_app.Listener(pid=999, command="node other-server")

    monkeypatch.setattr(full_app, "find_port_listener", lambda port: listener)

    blocked = full_app.foreign_port_blocker(service, state)

    assert blocked == listener


def test_port_listener_from_managed_process_group_is_not_blocker(monkeypatch) -> None:
    service = full_app.SERVICES["app"]
    state = {"version": 1, "services": {"app": {"pid": 123, "pgid": 123}}}
    listener = full_app.Listener(pid=999, command="vite")

    monkeypatch.setattr(full_app, "find_port_listener", lambda port: listener)
    monkeypatch.setattr(full_app, "process_group_id", lambda pid: 123)

    assert full_app.foreign_port_blocker(service, state) is None


def test_stop_order_is_reverse_dependency_order() -> None:
    assert full_app.stop_order(["intelligence", "app", "marketing"]) == [
        "marketing",
        "app",
        "intelligence",
    ]
