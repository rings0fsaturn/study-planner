#!/usr/bin/env bash
# post-read-index.sh — PostToolUse hook for file reads.
#
# Receives a JSON payload on stdin from Codex hooks. Supports:
#   {"tool_name": "Read", "tool_input": {"file_path": "..."}, ...}
#   {"tool_name": "Bash", "tool_input": {"command": "sed -n '1,80p' file.ts"}, ...}
#
# Extracts likely read-only file paths and hands off to update-index.py.
# MUST NOT block or fail — Codex's tool call has already happened; this is
# bookkeeping. All real errors are absorbed and logged.

set +e  # never bubble errors up to Codex

REPO_ROOT="$(pwd)"
HOOKS_DIR="${REPO_ROOT}/.codex/hooks"
MEMORY_DIR="${REPO_ROOT}/.codex/memory"
LOG="${MEMORY_DIR}/hook.log"

mkdir -p "${MEMORY_DIR}" 2>/dev/null

# Parse stdin JSON to extract likely file paths. Use python (a hard dep).
FILE_PATHS="$(python3 -c '
import json, os, shlex, sys

repo = os.getcwd()

def inside_repo(path: str) -> bool:
    if not path:
        return False
    abs_path = path if os.path.isabs(path) else os.path.join(repo, path)
    try:
        real = os.path.realpath(abs_path)
        root = os.path.realpath(repo)
    except OSError:
        return False
    return real == root or real.startswith(root + os.sep)

def existing_file(path: str) -> bool:
    abs_path = path if os.path.isabs(path) else os.path.join(repo, path)
    return inside_repo(path) and os.path.isfile(abs_path)

def emit(path: str, seen: set[str]) -> None:
    if not existing_file(path):
        return
    abs_path = path if os.path.isabs(path) else os.path.join(repo, path)
    try:
        rel = os.path.relpath(os.path.realpath(abs_path), repo)
    except ValueError:
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

try:
    data = json.load(sys.stdin)
    tool = data.get("tool_name", "")
    tool_input = data.get("tool_input", {}) or {}
    seen = set()
    if tool == "Read":
        emit(tool_input.get("file_path", ""), seen)
    elif tool == "Bash":
        for fp in bash_read_paths(tool_input.get("command", "")):
            emit(fp, seen)
except Exception:
    pass
' 2>/dev/null)"

if [ -z "${FILE_PATHS}" ]; then
    exit 0
fi

while IFS= read -r FILE_PATH; do
    [ -n "${FILE_PATH}" ] || continue
    python3 "${HOOKS_DIR}/update-index.py" "${FILE_PATH}" >>"${LOG}" 2>&1
done <<EOF
${FILE_PATHS}
EOF

exit 0
