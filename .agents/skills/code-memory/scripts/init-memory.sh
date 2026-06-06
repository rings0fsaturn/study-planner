#!/usr/bin/env bash
# init-memory.sh — one-time setup for code-memory in the current repo.
#
# Safe to re-run: idempotent. Creates .claude/memory/, installs the hook,
# adds the memory dir to .gitignore, verifies dependencies.

set -euo pipefail

# Locate skill's own scripts directory (this script lives in scripts/).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(pwd)"

CLAUDE_DIR="${REPO_ROOT}/.claude"
MEMORY_DIR="${CLAUDE_DIR}/memory"
HOOKS_DIR="${CLAUDE_DIR}/hooks"
SETTINGS_FILE="${CLAUDE_DIR}/settings.json"
HOOK_SCRIPT="${HOOKS_DIR}/post-read-index.sh"
GITIGNORE="${REPO_ROOT}/.gitignore"

echo "[init-memory] Setting up code-memory in ${REPO_ROOT}"

# 1. Create directories.
mkdir -p "${MEMORY_DIR}/flows" "${MEMORY_DIR}/toc" "${HOOKS_DIR}"

# 2. Seed empty index and toc if missing.
[ -f "${MEMORY_DIR}/index.jsonl" ] || : > "${MEMORY_DIR}/index.jsonl"
[ -f "${MEMORY_DIR}/toc.md" ] || cat > "${MEMORY_DIR}/toc.md" <<'EOF'
# Code Memory — Table of Contents

(empty — index grows as Claude reads files)

## Flows

(no flow files yet)
EOF

# 3. Install the hook script (copy from this skill's scripts/ dir).
cp "${SCRIPT_DIR}/post-read-index.sh" "${HOOK_SCRIPT}"
chmod +x "${HOOK_SCRIPT}"

# Also install the python workers next to the hook so the hook can find them.
cp "${SCRIPT_DIR}/update-index.py" "${HOOKS_DIR}/update-index.py"
cp "${SCRIPT_DIR}/regen-toc.py"    "${HOOKS_DIR}/regen-toc.py"
cp "${SCRIPT_DIR}/set-summary.py"  "${HOOKS_DIR}/set-summary.py"
cp "${SCRIPT_DIR}/gc-memory.py"    "${HOOKS_DIR}/gc-memory.py"

# 4. Register hook in .claude/settings.json (merge, don't clobber).
python3 - <<PYEOF
import json, os, sys
path = "${SETTINGS_FILE}"
hook_cmd = "bash .claude/hooks/post-read-index.sh"

if os.path.exists(path):
    with open(path) as f:
        try:
            cfg = json.load(f)
        except json.JSONDecodeError:
            print(f"[init-memory] WARNING: {path} is not valid JSON; backing up and replacing.")
            os.rename(path, path + ".bak")
            cfg = {}
else:
    cfg = {}

cfg.setdefault("hooks", {})
cfg["hooks"].setdefault("PostToolUse", [])

# Find existing Read matcher block, or create one.
read_block = None
for block in cfg["hooks"]["PostToolUse"]:
    if block.get("matcher") == "Read":
        read_block = block
        break
if read_block is None:
    read_block = {"matcher": "Read", "hooks": []}
    cfg["hooks"]["PostToolUse"].append(read_block)

read_block.setdefault("hooks", [])
if not any(h.get("command") == hook_cmd for h in read_block["hooks"]):
    read_block["hooks"].append({"type": "command", "command": hook_cmd})

with open(path, "w") as f:
    json.dump(cfg, f, indent=2)
print(f"[init-memory] Hook registered in {path}")
PYEOF

# 5. Add .claude/memory/ to .gitignore if not already there.
if [ -f "${GITIGNORE}" ]; then
    if ! grep -qE '^\.claude/memory/?$' "${GITIGNORE}"; then
        echo "" >> "${GITIGNORE}"
        echo "# code-memory: agent-only index, do not commit" >> "${GITIGNORE}"
        echo ".claude/memory/" >> "${GITIGNORE}"
        echo "[init-memory] Added .claude/memory/ to .gitignore"
    else
        echo "[init-memory] .claude/memory/ already in .gitignore"
    fi
else
    echo "# code-memory: agent-only index, do not commit" > "${GITIGNORE}"
    echo ".claude/memory/" >> "${GITIGNORE}"
    echo "[init-memory] Created .gitignore with .claude/memory/"
fi

# 6. Dependency checks.
MISSING=0
if ! command -v ctags >/dev/null 2>&1; then
    echo "[init-memory] ERROR: 'ctags' not found. Install universal-ctags:"
    echo "    macOS:   brew install universal-ctags"
    echo "    Ubuntu:  sudo apt install universal-ctags"
    echo "    Fedora:  sudo dnf install ctags"
    MISSING=1
else
    CTAGS_KIND="$(ctags --version | head -1)"
    echo "[init-memory] Found ctags: ${CTAGS_KIND}"
fi

if ! command -v python3 >/dev/null 2>&1; then
    echo "[init-memory] ERROR: 'python3' not found. Install Python 3.8+."
    MISSING=1
else
    echo "[init-memory] Found python3: $(python3 --version)"
fi

if [ "${MISSING}" -ne 0 ]; then
    echo "[init-memory] One or more dependencies missing — fix the above and re-run."
    exit 1
fi

echo "[init-memory] Done. Memory will populate as Claude explores files."
echo "[init-memory] NOTE: If hooks are not supported in this Claude Code environment,"
echo "[init-memory]       follow the 'Instruction-mode fallback' section of code-memory's SKILL.md."
