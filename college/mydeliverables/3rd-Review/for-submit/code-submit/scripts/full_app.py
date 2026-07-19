#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


REPO_ROOT = Path(__file__).resolve().parents[1]
STATE_DIR = REPO_ROOT / ".dev" / "full-app"
STATE_FILE = STATE_DIR / "state.json"
LOG_DIR = STATE_DIR / "logs"
STATE_VERSION = 1
START_TIMEOUT_SECONDS = 120.0
TERM_TIMEOUT_SECONDS = 5.0
HEALTH_POLL_SECONDS = 0.5


@dataclass(frozen=True)
class Service:
    name: str
    command: list[str]
    port: int
    health_url: str
    env: dict[str, str] = field(default_factory=dict)
    startup_timeout: float = START_TIMEOUT_SECONDS


@dataclass(frozen=True)
class Listener:
    pid: int
    command: str = ""


SERVICES: dict[str, Service] = {
    "intelligence": Service(
        name="intelligence",
        command=["pnpm", "dev:intelligence"],
        port=8000,
        health_url="http://127.0.0.1:8000/health",
    ),
    "app": Service(
        name="app",
        command=["pnpm", "dev:app"],
        port=5173,
        health_url="http://localhost:5173/study/sign-in",
        env={"VITE_INTELLIGENCE_URL": "http://127.0.0.1:8000"},
    ),
    "marketing": Service(
        name="marketing",
        command=["pnpm", "dev:marketing"],
        port=4321,
        health_url="http://localhost:4321/",
    ),
}

PROFILES: dict[str, list[str]] = {
    "full": ["intelligence", "app"],
    "all": ["intelligence", "app", "marketing"],
}


def empty_state() -> dict[str, Any]:
    return {"version": STATE_VERSION, "services": {}}


def load_state(state_file: Path | None = None) -> dict[str, Any]:
    path = state_file or STATE_FILE
    if not path.exists():
        return empty_state()
    with path.open("r", encoding="utf-8") as fh:
        state = json.load(fh)
    if not isinstance(state, dict) or not isinstance(state.get("services"), dict):
        raise RuntimeError(f"invalid full-app state file: {path}")
    state.setdefault("version", STATE_VERSION)
    return state


def save_state(state: dict[str, Any], state_file: Path | None = None) -> None:
    path = state_file or STATE_FILE
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(f"{path.name}.tmp")
    with tmp_path.open("w", encoding="utf-8") as fh:
        json.dump(state, fh, indent=2, sort_keys=True)
        fh.write("\n")
    tmp_path.replace(path)


def expand_profile(profile: str | None) -> list[str]:
    name = profile or "full"
    if name in PROFILES:
        return list(PROFILES[name])
    if name in SERVICES:
        return [name]
    valid = ", ".join(sorted([*PROFILES, *SERVICES]))
    raise ValueError(f"unknown profile '{name}'. Expected one of: {valid}")


def stop_order(service_names: list[str]) -> list[str]:
    return list(reversed(service_names))


def pid_alive(pid: int | None) -> bool:
    if not isinstance(pid, int) or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def process_group_id(pid: int) -> int | None:
    try:
        return os.getpgid(pid)
    except (ProcessLookupError, PermissionError, OSError):
        return None


def process_group_alive(pgid: int | None) -> bool:
    if not isinstance(pgid, int) or pgid <= 0:
        return False
    try:
        os.killpg(pgid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def pid_command(pid: int) -> str:
    try:
        result = subprocess.run(
            ["ps", "-p", str(pid), "-o", "command="],
            cwd=REPO_ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return ""
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


def find_port_listener(port: int) -> Listener | None:
    try:
        result = subprocess.run(
            ["lsof", "-nP", "-t", f"-iTCP:{port}", "-sTCP:LISTEN"],
            cwd=REPO_ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return None
    if result.returncode != 0:
        return None
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            pid = int(line)
        except ValueError:
            continue
        return Listener(pid=pid, command=pid_command(pid))
    return None


def managed_pgids(state: dict[str, Any]) -> set[int]:
    pgids: set[int] = set()
    for entry in state.get("services", {}).values():
        pgid = entry.get("pgid")
        if isinstance(pgid, int) and pgid > 0:
            pgids.add(pgid)
    return pgids


def foreign_port_blocker(service: Service, state: dict[str, Any]) -> Listener | None:
    listener = find_port_listener(service.port)
    if listener is None:
        return None
    listener_pgid = process_group_id(listener.pid)
    for entry in state.get("services", {}).values():
        if entry.get("pid") == listener.pid:
            return None
    if listener_pgid is not None and listener_pgid in managed_pgids(state):
        return None
    return listener


def prune_stale_services(state: dict[str, Any]) -> list[str]:
    stale: list[str] = []
    services = state.setdefault("services", {})
    for name, entry in list(services.items()):
        if not pid_alive(entry.get("pid")):
            stale.append(name)
            del services[name]
    return stale


def health_ok(service: Service, timeout: float = 2.0) -> bool:
    request = Request(service.health_url, method="GET")
    try:
        with urlopen(request, timeout=timeout) as response:
            return 200 <= response.status < 400
    except HTTPError as err:
        return 200 <= err.code < 400
    except (URLError, TimeoutError, OSError):
        return False


def wait_for_health(service: Service, timeout: float | None = None) -> bool:
    deadline = time.monotonic() + (timeout if timeout is not None else service.startup_timeout)
    while time.monotonic() < deadline:
        if health_ok(service):
            return True
        time.sleep(HEALTH_POLL_SECONDS)
    return health_ok(service)


def log_path(service_name: str) -> Path:
    return LOG_DIR / f"{service_name}.log"


def describe_listener(listener: Listener) -> str:
    command = f" ({listener.command})" if listener.command else ""
    return f"pid {listener.pid}{command}"


def start_service(name: str, state: dict[str, Any]) -> int:
    service = SERVICES[name]
    services = state.setdefault("services", {})
    entry = services.get(name)

    if entry and pid_alive(entry.get("pid")):
        if wait_for_health(service, timeout=10.0):
            print(f"{name}: already running pid={entry.get('pid')} port={service.port}")
            return 0
        print(
            f"{name}: managed pid {entry.get('pid')} is alive but health check failed: "
            f"{service.health_url}",
            file=sys.stderr,
        )
        print(f"{name}: see log {entry.get('log')}", file=sys.stderr)
        return 1

    if entry:
        print(f"{name}: removing stale pid={entry.get('pid')}")
        services.pop(name, None)
        save_state(state)

    blocker = foreign_port_blocker(service, state)
    if blocker is not None:
        print(
            f"{name}: port {service.port} is already in use by {describe_listener(blocker)}",
            file=sys.stderr,
        )
        print(
            f"{name}: refusing to kill a process not started by ./full-app",
            file=sys.stderr,
        )
        print(
            f"{name}: inspect with: lsof -nP -iTCP:{service.port} -sTCP:LISTEN",
            file=sys.stderr,
        )
        return 1

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_file = log_path(name)
    env = os.environ.copy()
    env.update(service.env)

    print(f"{name}: starting {' '.join(service.command)}")
    with log_file.open("ab") as log:
        proc = subprocess.Popen(
            service.command,
            cwd=REPO_ROOT,
            env=env,
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )

    pgid = process_group_id(proc.pid) or proc.pid
    services[name] = {
        "pid": proc.pid,
        "pgid": pgid,
        "command": service.command,
        "cwd": str(REPO_ROOT),
        "env": service.env,
        "port": service.port,
        "health_url": service.health_url,
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "log": str(log_file),
    }
    save_state(state)

    if wait_for_health(service):
        print(f"{name}: started pid={proc.pid} port={service.port} log={log_file}")
        return 0

    print(f"{name}: failed health check after start: {service.health_url}", file=sys.stderr)
    print(f"{name}: see log {log_file}", file=sys.stderr)
    return 1


def send_signal_to_group(pgid: int, sig: signal.Signals) -> None:
    os.killpg(pgid, sig)


def stop_service(name: str, state: dict[str, Any]) -> int:
    services = state.setdefault("services", {})
    entry = services.get(name)
    if not entry:
        print(f"{name}: not running")
        return 0

    pid = entry.get("pid")
    pgid = entry.get("pgid") or (process_group_id(pid) if isinstance(pid, int) else None)
    if not pid_alive(pid):
        print(f"{name}: stale pid={pid}; removing state")
        services.pop(name, None)
        save_state(state)
        return 0

    if not isinstance(pgid, int):
        print(f"{name}: cannot determine process group for pid={pid}", file=sys.stderr)
        return 1

    print(f"{name}: stopping pid={pid} pgid={pgid}")
    try:
        send_signal_to_group(pgid, signal.SIGTERM)
    except ProcessLookupError:
        services.pop(name, None)
        save_state(state)
        return 0
    except PermissionError as err:
        print(f"{name}: cannot terminate pgid={pgid}: {err}", file=sys.stderr)
        return 1

    deadline = time.monotonic() + TERM_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        if not process_group_alive(pgid):
            services.pop(name, None)
            save_state(state)
            print(f"{name}: stopped")
            return 0
        time.sleep(0.2)

    try:
        send_signal_to_group(pgid, signal.SIGKILL)
    except ProcessLookupError:
        services.pop(name, None)
        save_state(state)
        print(f"{name}: stopped")
        return 0
    except PermissionError as err:
        print(f"{name}: cannot kill pgid={pgid}: {err}", file=sys.stderr)
        return 1

    time.sleep(0.2)
    if process_group_alive(pgid):
        print(f"{name}: failed to stop pgid={pgid}", file=sys.stderr)
        return 1

    services.pop(name, None)
    save_state(state)
    print(f"{name}: stopped")
    return 0


def status_service(name: str, state: dict[str, Any]) -> str:
    service = SERVICES[name]
    entry = state.get("services", {}).get(name)
    if entry:
        pid = entry.get("pid")
        if pid_alive(pid):
            health = "healthy" if health_ok(service) else "unhealthy"
            return (
                f"{name}: running pid={pid} port={service.port} health={health} "
                f"log={entry.get('log')}"
            )
        return f"{name}: stale pid={pid} port={service.port} log={entry.get('log')}"

    blocker = foreign_port_blocker(service, state)
    if blocker is not None:
        return f"{name}: blocked port={service.port} by {describe_listener(blocker)}"
    return f"{name}: stopped port={service.port}"


def run_start(service_names: list[str]) -> int:
    state = load_state()
    stale = prune_stale_services(state)
    if stale:
        save_state(state)
        print(f"removed stale state: {', '.join(stale)}")
    for name in service_names:
        code = start_service(name, state)
        if code != 0:
            return code
        state = load_state()
    return 0


def run_stop(service_names: list[str]) -> int:
    state = load_state()
    exit_code = 0
    for name in stop_order(service_names):
        code = stop_service(name, state)
        exit_code = exit_code or code
        state = load_state()
    return exit_code


def run_status(service_names: list[str]) -> int:
    state = load_state()
    for name in service_names:
        print(status_service(name, state))
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Manage the StudyTracker full app dev stack.")
    parser.add_argument("command", choices=["start", "stop", "restart", "status"])
    parser.add_argument(
        "profile",
        nargs="?",
        default="full",
        help="Profile or service: full, all, app, intelligence, marketing",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    try:
        service_names = expand_profile(args.profile)
    except ValueError as err:
        print(err, file=sys.stderr)
        return 2

    if args.command == "start":
        return run_start(service_names)
    if args.command == "stop":
        return run_stop(service_names)
    if args.command == "restart":
        stop_code = run_stop(service_names)
        if stop_code != 0:
            return stop_code
        return run_start(service_names)
    if args.command == "status":
        return run_status(service_names)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
