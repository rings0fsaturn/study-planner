#!/usr/bin/env bash
# post-read-index.sh — PostToolUse hook for file reads and edits.
#
# Receives a JSON payload on stdin from Codex hooks. Supports:
#   {"tool_name": "Read", "tool_input": {"file_path": "..."}, ...}
#   {"tool_name": "Bash", "tool_input": {"command": "sed -n '1,80p' file.ts"}, ...}
#   {"tool_name": "apply_patch", "tool_input": {"command": "*** Begin Patch\n..."}, ...}
#
# Extracts likely file paths and hands off to update-index.py.
# MUST NOT block or fail — Codex's tool call has already happened; this is
# bookkeeping. All real errors are absorbed and logged.

set +e  # never bubble errors up to Codex

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HOOKS_DIR="${REPO_ROOT}/.codex/hooks"
MEMORY_DIR="${REPO_ROOT}/.codex/memory"
LOG="${MEMORY_DIR}/hook.log"

mkdir -p "${MEMORY_DIR}" 2>/dev/null
cd "${REPO_ROOT}" 2>/dev/null || exit 0

log_event() {
    printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >>"${LOG}" 2>/dev/null
}

indexed_current() {
    python3 - "$1" <<'PY' >/dev/null 2>&1
import hashlib
import json
import os
import sys

root = os.getcwd()
path = sys.argv[1]
abs_path = path if os.path.isabs(path) else os.path.join(root, path)

try:
    rel_path = os.path.relpath(os.path.realpath(abs_path), root)
    with open(abs_path, "rb") as f:
        digest = hashlib.sha1(f.read()).hexdigest()
except OSError:
    sys.exit(1)

try:
    with open(os.path.join(root, ".codex", "memory", "index.jsonl"), encoding="utf-8") as f:
        for line in f:
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if row.get("path") == rel_path and row.get("hash") == digest:
                sys.exit(0)
except OSError:
    pass

sys.exit(1)
PY
}

# Parse stdin JSON to extract likely file paths. Use python (a hard dep).
FILE_PATHS="$(python3 -c '
import json, os, shlex, sys

repo = os.getcwd()
base = repo

def absolute_input_path(path: str) -> str:
    return path if os.path.isabs(path) else os.path.join(base, path)

def inside_repo(path: str) -> bool:
    if not path:
        return False
    abs_path = absolute_input_path(path)
    try:
        real = os.path.realpath(abs_path)
        root = os.path.realpath(repo)
    except OSError:
        return False
    return real == root or real.startswith(root + os.sep)

def existing_file(path: str) -> bool:
    abs_path = absolute_input_path(path)
    return inside_repo(path) and os.path.isfile(abs_path)

def emit(path: str, seen: set[str]) -> None:
    if not existing_file(path):
        return
    abs_path = absolute_input_path(path)
    try:
        rel = os.path.relpath(os.path.realpath(abs_path), repo)
    except ValueError:
        return
    if rel == ".codex/memory" or rel.startswith(".codex/memory/"):
        return
    if rel not in seen:
        seen.add(rel)
        print(rel)

def bash_read_paths(command: str) -> list[str]:
    try:
        words = shlex.split(command, posix=True)
    except ValueError:
        return []
    if not words:
        return []

    read_commands = {"cat", "sed", "nl", "head", "tail", "less", "more"}
    separators = {"|", ";", "&&", "||"}
    out = []
    i = 0
    while i < len(words):
        cmd = os.path.basename(words[i])
        if cmd not in read_commands:
            i += 1
            continue

        args = []
        i += 1
        while i < len(words) and words[i] not in separators:
            args.append(words[i])
            i += 1

        candidates = []
        skip_next = False
        saw_sed_script = cmd != "sed"
        for arg in args:
            if skip_next:
                skip_next = False
                continue
            if arg in {"-n", "-p", "-s", "-v", "-b"}:
                continue
            if arg in {"-e", "-f", "-n", "-c"}:
                skip_next = True
                continue
            if arg.startswith("-"):
                continue
            if cmd == "sed" and not saw_sed_script and not existing_file(arg):
                saw_sed_script = True
                continue
            candidates.append(arg)

        out.extend(candidates)
    return out

def apply_patch_paths(command: str) -> list[str]:
    out = []
    prefixes = (
        "*** Add File: ",
        "*** Update File: ",
        "*** Delete File: ",
        "*** Move to: ",
    )
    for raw in command.splitlines():
        line = raw.strip()
        for prefix in prefixes:
            if line.startswith(prefix):
                path = line[len(prefix):].strip()
                if path:
                    out.append(path)
                break
    return out

try:
    data = json.load(sys.stdin)
    base = data.get("cwd") or repo
    tool = data.get("tool_name", "")
    tool_input = data.get("tool_input", {}) or {}
    seen = set()
    if tool == "Read":
        emit(tool_input.get("file_path", ""), seen)
    elif tool == "Bash":
        for fp in bash_read_paths(tool_input.get("command", "")):
            emit(fp, seen)
    elif tool in {"apply_patch", "Edit", "Write"}:
        command = tool_input.get("command") or tool_input.get("patch") or ""
        for fp in apply_patch_paths(command):
            emit(fp, seen)
except Exception:
    pass
' 2>/dev/null)"

if [ -z "${FILE_PATHS}" ]; then
    exit 0
fi

while IFS= read -r FILE_PATH; do
    [ -n "${FILE_PATH}" ] || continue
    OUTPUT="$(python3 "${HOOKS_DIR}/update-index.py" "${FILE_PATH}" 2>&1)"
    STATUS=$?
    if [ "${STATUS}" -eq 0 ]; then
        if indexed_current "${FILE_PATH}"; then
            if [ -n "${OUTPUT}" ]; then
                log_event "indexed path=${FILE_PATH} output=${OUTPUT//$'\n'/ }"
            else
                log_event "indexed path=${FILE_PATH}"
            fi
        elif [ -n "${OUTPUT}" ]; then
            log_event "skipped path=${FILE_PATH} output=${OUTPUT//$'\n'/ }"
        else
            log_event "skipped path=${FILE_PATH}"
        fi
    else
        if [ -n "${OUTPUT}" ]; then
            log_event "index-failed path=${FILE_PATH} status=${STATUS} output=${OUTPUT//$'\n'/ }"
        else
            log_event "index-failed path=${FILE_PATH} status=${STATUS}"
        fi
    fi
done <<EOF
${FILE_PATHS}
EOF

exit 0
