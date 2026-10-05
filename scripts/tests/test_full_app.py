import json
import subprocess

import pytest

from scripts import full_app


def test_expand_profile_uses_dependency_order() -> None:
    assert full_app.expand_profile("full") == [
        "sidecar",
        "piston",
        "intelligence",
        "app",
        "worker",
    ]
    assert full_app.expand_profile("all") == [
        "sidecar",
        "piston",
        "intelligence",
        "app",
        "marketing",
        "worker",
    ]
    assert full_app.expand_profile("app") == ["app"]


def test_expand_profile_accepts_container_names() -> None:
    assert full_app.expand_profile("sidecar") == ["sidecar"]
    assert full_app.expand_profile("piston") == ["piston"]


def test_stop_order_stops_containers_after_processes() -> None:
    ordered = full_app.stop_order(full_app.expand_profile("full"))
    assert ordered == ["worker", "app", "intelligence", "piston", "sidecar"]


def test_sidecar_health_predicate_requires_both_models() -> None:
    ready = full_app.CONTAINERS["sidecar"].health_predicate
    assert ready({"status": "ok", "loaded": True, "reranker_loaded": True})
    assert not ready({"status": "ok", "loaded": True, "reranker_loaded": False})
    assert not ready({"status": "ok", "loaded": False})
    assert not ready(None)


def test_piston_health_predicate_requires_python_312() -> None:
    ready = full_app.CONTAINERS["piston"].health_predicate
    assert ready([{"language": "python", "version": "3.12.0"}])
    assert not ready([{"language": "python", "version": "3.10.0"}])
    assert not ready([])
    assert not ready(None)


def test_piston_bootstrap_installs_missing_runtime(monkeypatch) -> None:
    posted: list[dict] = []
    monkeypatch.setattr(full_app, "_http_json", lambda url, timeout=2.0: [])
    monkeypatch.setattr(
        full_app, "_http_post_json", lambda url, payload, timeout: posted.append(payload)
    )

    full_app._ensure_piston_runtime(full_app.CONTAINERS["piston"])

    assert posted == [{"language": "python", "version": full_app.PISTON_PYTHON_VERSION}]


def test_piston_bootstrap_skips_install_when_present(monkeypatch) -> None:
    posted: list[dict] = []
    monkeypatch.setattr(
        full_app,
        "_http_json",
        lambda url, timeout=2.0: [{"language": "python", "version": "3.12.0"}],
    )
    monkeypatch.setattr(
        full_app, "_http_post_json", lambda url, payload, timeout: posted.append(payload)
    )

    full_app._ensure_piston_runtime(full_app.CONTAINERS["piston"])

    assert posted == []


def test_start_full_starts_containers_before_processes(monkeypatch) -> None:
    calls: list[str] = []
    monkeypatch.setattr(full_app, "load_state", lambda *a, **k: {"version": 1, "services": {}})
    monkeypatch.setattr(full_app, "save_state", lambda *a, **k: None)
    monkeypatch.setattr(full_app, "prune_stale_services", lambda state: [])
    monkeypatch.setattr(
        full_app, "start_container", lambda name: calls.append(f"container:{name}") or 0
    )
    monkeypatch.setattr(
        full_app, "start_service", lambda name, state: calls.append(f"service:{name}") or 0
    )

    code = full_app.run_start(full_app.expand_profile("full"))

    assert code == 0
    assert calls == [
        "container:sidecar",
        "container:piston",
        "service:intelligence",
        "service:app",
        "service:worker",
    ]


def test_start_container_failure_does_not_block_processes(monkeypatch) -> None:
    calls: list[str] = []
    monkeypatch.setattr(full_app, "load_state", lambda *a, **k: {"version": 1, "services": {}})
    monkeypatch.setattr(full_app, "save_state", lambda *a, **k: None)
    monkeypatch.setattr(full_app, "prune_stale_services", lambda state: [])
    monkeypatch.setattr(full_app, "start_container", lambda name: 1)
    monkeypatch.setattr(full_app, "start_service", lambda name, state: calls.append(name) or 0)

    code = full_app.run_start(full_app.expand_profile("full"))

    assert code == 1  # degraded dependency is surfaced, stack still starts
    assert calls == ["intelligence", "app", "worker"]


def test_stop_full_stops_processes_before_containers(monkeypatch) -> None:
    calls: list[str] = []
    monkeypatch.setattr(full_app, "load_state", lambda *a, **k: {"version": 1, "services": {}})
    monkeypatch.setattr(
        full_app, "stop_service", lambda name, state: calls.append(f"service:{name}") or 0
    )
    monkeypatch.setattr(
        full_app, "stop_container", lambda name: calls.append(f"container:{name}") or 0
    )

    code = full_app.run_stop(full_app.expand_profile("full"))

    assert code == 0
    assert calls == [
        "service:worker",
        "service:app",
        "service:intelligence",
        "container:piston",
        "container:sidecar",
    ]


def test_stop_container_uses_stop_not_down(monkeypatch) -> None:
    captured: dict[str, list[str]] = {}
    monkeypatch.setattr(full_app, "_docker_bin", lambda: "docker")
    monkeypatch.setattr(
        full_app,
        "_compose_run",
        lambda dep, args, **k: (
            captured.setdefault("args", list(args)),
            subprocess.CompletedProcess([], 0, "", ""),
        )[1],
    )

    code = full_app.stop_container("piston")

    assert code == 0
    assert captured["args"] == ["stop", "piston"]


def test_start_container_without_docker_warns(monkeypatch) -> None:
    monkeypatch.setattr(full_app, "_docker_bin", lambda: None)

    assert full_app.start_container("piston") == 1


def test_status_full_lists_containers_before_processes(monkeypatch, capsys) -> None:
    monkeypatch.setattr(full_app, "load_state", lambda: {"version": 1, "services": {}})
    monkeypatch.setattr(full_app, "status_container", lambda name: f"{name}: running")
    monkeypatch.setattr(full_app, "status_service", lambda name, state: f"{name}: stopped")

    full_app.run_status(full_app.expand_profile("full"))

    lines = capsys.readouterr().out.splitlines()
    assert lines[0] == "sidecar: running"
    assert lines[1] == "piston: running"


def test_worker_service_is_portless() -> None:
    service = full_app.SERVICES["worker"]
    assert service.port is None
    assert service.health_url is None
    state = {"version": 1, "services": {}}
    assert full_app.foreign_port_blocker(service, state) is None


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
