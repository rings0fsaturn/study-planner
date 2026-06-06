#!/usr/bin/env bash
# post-read-index.sh — PostToolUse hook for the Read tool.
#
# Receives a JSON payload on stdin from Claude Code:
#   {"tool_name": "Read", "tool_input": {"file_path": "..."}, ...}
#
# Extracts the file path and hands off to update-index.py.
# MUST NOT block or fail — Claude's read has already happened; this is
# bookkeeping. All real errors are absorbed and logged.

set +e  # never bubble errors up to Claude Code

REPO_ROOT="$(pwd)"
HOOKS_DIR="${REPO_ROOT}/.claude/hooks"
MEMORY_DIR="${REPO_ROOT}/.claude/memory"
LOG="${MEMORY_DIR}/hook.log"

mkdir -p "${MEMORY_DIR}" 2>/dev/null

# Parse stdin JSON to extract file_path. Use python (a hard dep).
FILE_PATH="$(python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
    tool = data.get("tool_name", "")
    if tool != "Read":
        sys.exit(0)
    fp = data.get("tool_input", {}).get("file_path", "")
    if fp:
        print(fp)
except Exception:
    pass
' 2>/dev/null)"

if [ -z "${FILE_PATH}" ]; then
    exit 0
fi

# Only index files inside the repo. Reject absolute paths outside,
# and resolve relative paths against the repo root.
if [ "${FILE_PATH:0:1}" = "/" ]; then
    case "${FILE_PATH}" in
        "${REPO_ROOT}"/*) ;;  # OK, inside repo
        *) exit 0 ;;          # outside repo, skip
    esac
fi

# Hand off to the python worker. Detach so we never delay Claude.
python3 "${HOOKS_DIR}/update-index.py" "${FILE_PATH}" >>"${LOG}" 2>&1 &
disown 2>/dev/null

exit 0
