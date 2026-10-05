#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import time
from collections.abc import Callable
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
    port: int | None = None
    health_url: str | None = None
    env: dict[str, str] = field(default_factory=dict)
    startup_timeout: float = START_TIMEOUT_SECONDS


@dataclass(frozen=True)
class ContainerDep:
    """A Docker Compose dependency the local stack needs running.

    `compose_file` selects a standalone compose project (the GPU sidecar);
    None means the root `docker-compose.yml`. `profile` selects a Compose
    profile (Piston's `sandbox`). `bootstrap` runs once the container answers
    but before the readiness poll, and installs anything first-run (Piston's
    Python runtime).
    """

    name: str
    service: str
    port: int
    health_url: str
    health_predicate: Callable[[Any], bool]
    compose_file: str | None = None
    profile: str | None = None
    startup_timeout: float = 90.0
    bootstrap: Callable[[ContainerDep], None] | None = None


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
    # The ingestion + generation + grading worker has no HTTP health; it is
    # "healthy" once the process stays alive (the worker logs its own start).
    "worker": Service(
        name="worker",
        command=["pnpm", "dev:ingestion-worker"],
    ),
}

PISTON_PYTHON_VERSION = "3.12.0"
DOCKER_FALLBACK = "/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"


def _sidecar_ready(data: Any) -> bool:
    return (
        isinstance(data, dict)
        and data.get("status") == "ok"
        and data.get("loaded") is True
        and data.get("reranker_loaded") is True
    )


def _piston_runtimes_ready(data: Any) -> bool:
    if not isinstance(data, list):
        return False
    return any(
        isinstance(entry, dict)
        and entry.get("language") == "python"
        and str(entry.get("version", "")).startswith("3.12")
        for entry in data
    )


def _http_json(url: str, timeout: float = 2.0) -> Any | None:
    try:
        with urlopen(Request(url, method="GET"), timeout=timeout) as response:
            if not (200 <= response.status < 400):
                return None
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, OSError, ValueError):
        return None


def _http_post_json(url: str, payload: dict, timeout: float) -> None:
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=timeout) as response:
        response.read()


def _ensure_piston_runtime(dep: ContainerDep) -> None:
    """Install the pinned Python runtime into Piston on first use.

    Piston ships no language runtimes; the install persists in the
    `piston-packages` volume, so this is a no-op after the first run.
    """
    if _piston_runtimes_ready(_http_json(dep.health_url, timeout=10.0)):
        return
    print(f"{dep.name}: installing python {PISTON_PYTHON_VERSION} (first run; persists in volume)")
    packages_url = dep.health_url.replace("/runtimes", "/packages")
    try:
        _http_post_json(
            packages_url,
            {"language": "python", "version": PISTON_PYTHON_VERSION},
            timeout=600.0,
        )
    except (HTTPError, URLError, TimeoutError, OSError) as err:
        print(f"{dep.name}: runtime install failed: {err}", file=sys.stderr)


CONTAINERS: dict[str, ContainerDep] = {
    "sidecar": ContainerDep(
        name="sidecar",
        service="embedder",
        port=8200,
        health_url="http://127.0.0.1:8200/health",
        health_predicate=_sidecar_ready,
        compose_file="services/embedder/docker-compose.yml",
        # First boot downloads both model weight sets (~1.2 GB each).
        startup_timeout=180.0,
    ),
    "piston": ContainerDep(
        name="piston",
        service="piston",
        port=2000,
        health_url="http://127.0.0.1:2000/api/v2/runtimes",
        health_predicate=_piston_runtimes_ready,
        profile="sandbox",
        bootstrap=_ensure_piston_runtime,
    ),
}

PROFILES: dict[str, list[str]] = {
    # Containers start first: the worker reads PISTON_URL/EMBEDDER_URL at
    # process start, so the sandbox and sidecar must be up before it boots.
    "full": ["sidecar", "piston", "intelligence", "app", "worker"],
    "all": ["sidecar", "piston", "intelligence", "app", "marketing", "worker"],
}


def _docker_bin() -> str | None:
    for candidate in ("docker", DOCKER_FALLBACK):
        found = shutil.which(candidate)
        if found:
            return found
    return None


def _read_hf_token() -> str | None:
    path = REPO_ROOT / ".env.git.local"
    if not path.exists():
        return None
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("HF_TOKEN="):
            return line.split("=", 1)[1].strip()
    return None


def _compose_cmd(dep: ContainerDep, args: list[str]) -> list[str]:
    cmd = [_docker_bin() or "docker", "compose"]
    if dep.compose_file:
        cmd += ["-f", dep.compose_file]
    if dep.profile:
        cmd += ["--profile", dep.profile]
    cmd += args
    return cmd


def _compose_env(dep: ContainerDep) -> dict[str, str]:
    env = os.environ.copy()
    if dep.name == "sidecar":
        token = _read_hf_token()
        if token:
            env["HF_TOKEN"] = token
    return env


def _compose_run(dep: ContainerDep, args: list[str], *, timeout: float = 600.0):
    return subprocess.run(
        _compose_cmd(dep, args),
        cwd=REPO_ROOT,
        env=_compose_env(dep),
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def _manual_hint(name: str) -> str:
    dep = CONTAINERS[name]
    if dep.compose_file:
        return f"docker compose -f {dep.compose_file} up -d"
    profile = f"--profile {dep.profile} " if dep.profile else ""
    return f"docker compose {profile}up -d {dep.service}"


def container_health_ok(dep: ContainerDep) -> bool:
    data = _http_json(dep.health_url)
    return data is not None and dep.health_predicate(data)


def _container_reachable(dep: ContainerDep) -> bool:
    return _http_json(dep.health_url) is not None


def _wait_for_container(
    dep: ContainerDep, predicate: Callable[[ContainerDep], bool], timeout: float
) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate(dep):
            return True
        time.sleep(HEALTH_POLL_SECONDS)
    return predicate(dep)


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
    if name in SERVICES or name in CONTAINERS:
        return [name]
    valid = ", ".join(sorted([*PROFILES, *SERVICES, *CONTAINERS]))
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
    if service.port is None:
        return None
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


def start_container(name: str) -> int:
    dep = CONTAINERS[name]
    if _docker_bin() is None:
        print(
            f"{name}: docker CLI not found; start manually: {_manual_hint(name)}",
            file=sys.stderr,
        )
        return 1
    if container_health_ok(dep):
        print(f"{name}: already running port={dep.port} health=healthy")
        return 0

    print(f"{name}: starting container (service={dep.service})")
    result = _compose_run(dep, ["up", "-d", dep.service])
    if result.returncode != 0:
        print(f"{name}: compose up failed: {result.stderr.strip()[:400]}", file=sys.stderr)
        print(f"{name}: retry manually: {_manual_hint(name)}", file=sys.stderr)
        return 1

    if not _wait_for_container(dep, _container_reachable, min(30.0, dep.startup_timeout)):
        print(f"{name}: container never answered {dep.health_url}", file=sys.stderr)
        print(f"{name}: see ./full-app logs {name}", file=sys.stderr)
        return 1
    if dep.bootstrap is not None:
        dep.bootstrap(dep)
    if _wait_for_container(dep, container_health_ok, dep.startup_timeout):
        print(f"{name}: started port={dep.port} health=healthy")
        return 0
    print(f"{name}: container up but not ready at {dep.health_url}", file=sys.stderr)
    print(f"{name}: see ./full-app logs {name}", file=sys.stderr)
    return 1


def stop_container(name: str) -> int:
    dep = CONTAINERS[name]
    if _docker_bin() is None:
        print(f"{name}: docker CLI not found; container left untouched")
        return 0
    # `stop` (never `down`): Piston runtimes and sidecar model layers must
    # survive, so the next `up -d` is fast and needs no re-download.
    result = _compose_run(dep, ["stop", dep.service])
    if result.returncode != 0:
        print(f"{name}: compose stop failed: {result.stderr.strip()[:400]}", file=sys.stderr)
        return 1
    print(f"{name}: stopped")
    return 0


def status_container(name: str) -> str:
    dep = CONTAINERS[name]
    if _docker_bin() is None:
        return f"{name}: unknown (docker CLI not found)"
    if container_health_ok(dep):
        return f"{name}: running port={dep.port} health=healthy"
    result = _compose_run(dep, ["ps", "-q", dep.service])
    if result.returncode == 0 and result.stdout.strip():
        return f"{name}: running port={dep.port} health=unhealthy"
    return f"{name}: stopped (start with './full-app start {name}')"


def run_container_logs(name: str, grep: str | None, tail: int, follow: bool) -> int:
    dep = CONTAINERS[name]
    if _docker_bin() is None:
        print(
            f"{name}: docker CLI not found; run manually: {_manual_hint(name)}",
            file=sys.stderr,
        )
        return 1
    args = ["logs", f"--tail={tail}"]
    if follow:
        args.append("--follow")
    args.append(dep.service)
    cmd = _compose_cmd(dep, args)
    if grep and not follow:
        result = subprocess.run(
            cmd,
            cwd=REPO_ROOT,
            env=_compose_env(dep),
            check=False,
            capture_output=True,
            text=True,
        )
        print("\n".join(line for line in result.stdout.splitlines() if grep in line))
        return result.returncode
    os.execvpe(cmd[0], cmd, _compose_env(dep))
    return 0  # unreachable; exec replaces the process


def start_service(name: str, state: dict[str, Any]) -> int:
    service = SERVICES[name]
    services = state.setdefault("services", {})
    entry = services.get(name)

    if entry and pid_alive(entry.get("pid")):
        if service.health_url and not wait_for_health(service, timeout=10.0):
            print(
                f"{name}: managed pid {entry.get('pid')} is alive but health check failed: "
                f"{service.health_url}",
                file=sys.stderr,
            )
            print(f"{name}: see log {entry.get('log')}", file=sys.stderr)
            return 1
        print(f"{name}: already running pid={entry.get('pid')} log={entry.get('log')}")
        return 0

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

    if service.health_url:
        started = wait_for_health(service)
    else:
        # Portless services (worker) get a short liveness window instead of
        # an HTTP poll; a process that survives the grace period is up.
        time.sleep(1.0)
        started = pid_alive(proc.pid)
    if started:
        port = f" port={service.port}" if service.port is not None else ""
        print(f"{name}: started pid={proc.pid}{port} log={log_file}")
        return 0

    if service.health_url:
        print(f"{name}: failed health check after start: {service.health_url}", file=sys.stderr)
    else:
        print(f"{name}: process exited shortly after start", file=sys.stderr)
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
            if service.health_url:
                health = "healthy" if health_ok(service) else "unhealthy"
            else:
                health = "running"
            port = f" port={service.port}" if service.port is not None else ""
            return f"{name}: running pid={pid}{port} health={health} log={entry.get('log')}"
        port = f" port={service.port}" if service.port is not None else ""
        return f"{name}: stale pid={pid}{port} log={entry.get('log')}"

    blocker = foreign_port_blocker(service, state)
    if blocker is not None:
        return f"{name}: blocked port={service.port} by {describe_listener(blocker)}"
    return f"{name}: stopped"


def run_start(service_names: list[str]) -> int:
    state = load_state()
    stale = prune_stale_services(state)
    if stale:
        save_state(state)
        print(f"removed stale state: {', '.join(stale)}")
    dep_failures = 0
    for name in service_names:
        if name in CONTAINERS:
            # Containers are best-effort: a GPU-less host still gets the app
            # and service. A failure is surfaced in the exit code and status.
            dep_failures = dep_failures or start_container(name)
            continue
        code = start_service(name, state)
        if code != 0:
            return code
        state = load_state()
    return dep_failures


def run_stop(service_names: list[str]) -> int:
    state = load_state()
    exit_code = 0
    for name in stop_order(service_names):
        if name in CONTAINERS:
            code = stop_container(name)
        else:
            code = stop_service(name, state)
        exit_code = exit_code or code
        state = load_state()
    return exit_code


def run_status(service_names: list[str]) -> int:
    state = load_state()
    for name in service_names:
        if name in CONTAINERS:
            print(status_container(name))
        else:
            print(status_service(name, state))
    return 0


def run_logs(service_name: str, grep: str | None, tail: int, follow: bool) -> int:
    log_file = log_path(service_name)
    if not log_file.exists():
        print(f"{service_name}: no log at {log_file}", file=sys.stderr)
        return 1
    if follow:
        os.execvp("tail", ["tail", "-F", f"-n{tail}", str(log_file)])
        return 0  # unreachable; exec replaces the process
    with log_file.open("rb") as fh:
        fh.seek(0, os.SEEK_END)
        size = fh.tell()
        # Last ~256 KB is plenty for a grep or tail; avoids loading GB logs.
        fh.seek(max(0, size - 262144))
        lines = fh.read().decode("utf-8", errors="replace").splitlines()
    lines = lines[-tail:]
    if grep:
        lines = [line for line in lines if grep in line]
    print("\n".join(lines))
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Manage the StudyTracker full app dev stack.")
    parser.add_argument("command", choices=["start", "stop", "restart", "status", "logs"])
    parser.add_argument(
        "profile",
        nargs="?",
        default="full",
        help=(
            "Profile or service: full, all, app, intelligence, marketing, worker, sidecar, piston"
        ),
    )
    parser.add_argument(
        "--grep",
        default=None,
        help="Only show log lines containing this text (e.g. a request id)",
    )
    parser.add_argument("--tail", type=int, default=100, help="Lines of log tail to inspect")
    parser.add_argument("--follow", action="store_true", help="Follow the log (tail -F)")
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
    if args.command == "logs":
        if len(service_names) != 1 or args.profile in ("full", "all"):
            print(
                "logs needs one service: ./full-app logs "
                "<app|intelligence|marketing|worker|sidecar|piston> [--grep X]",
                file=sys.stderr,
            )
            return 2
        name = service_names[0]
        if name in CONTAINERS:
            return run_container_logs(name, args.grep, args.tail, args.follow)
        return run_logs(name, args.grep, args.tail, args.follow)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
