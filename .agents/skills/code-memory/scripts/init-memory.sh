#!/usr/bin/env bash
# init-memory.sh — one-time setup for code-memory in the current repo.
#
# Safe to re-run: idempotent. Creates .codex/memory/, installs the hook,
# adds the memory dir to .gitignore, verifies dependencies.

set -euo pipefail

# Locate skill's own scripts directory (this script lives in scripts/).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(pwd)"

CODEX_DIR="${REPO_ROOT}/.codex"
MEMORY_DIR="${CODEX_DIR}/memory"
LEGACY_MEMORY_DIR="${REPO_ROOT}/.claude/memory"
HOOKS_DIR="${CODEX_DIR}/hooks"
CONFIG_FILE="${CODEX_DIR}/config.toml"
HOOKS_JSON="${CODEX_DIR}/hooks.json"
HOOK_SCRIPT="${HOOKS_DIR}/post-read-index.sh"
GITIGNORE="${REPO_ROOT}/.gitignore"

echo "[init-memory] Setting up code-memory in ${REPO_ROOT}"

# 1. Create directories and preserve any legacy Claude memory.
mkdir -p "${CODEX_DIR}" "${HOOKS_DIR}"
if [ ! -d "${MEMORY_DIR}" ] && [ -d "${LEGACY_MEMORY_DIR}" ]; then
    cp -R "${LEGACY_MEMORY_DIR}" "${MEMORY_DIR}"
    echo "[init-memory] Migrated existing .claude/memory/ into .codex/memory/"
fi
mkdir -p "${MEMORY_DIR}/flows" "${MEMORY_DIR}/toc"

# 2. Seed empty index and toc if missing.
[ -f "${MEMORY_DIR}/index.jsonl" ] || : > "${MEMORY_DIR}/index.jsonl"
[ -f "${MEMORY_DIR}/toc.md" ] || cat > "${MEMORY_DIR}/toc.md" <<'EOF'
# Code Memory — Table of Contents

(empty — index grows as Codex reads files)

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

# 4. Register hook inline in .codex/config.toml.
# Official Codex hook docs support either .codex/config.toml or
# .codex/hooks.json. Use TOML here because this project keeps local runtime
# setup in .codex/config.toml and one representation avoids duplicate hooks.
python3 - <<PYEOF
from pathlib import Path

path = Path("${CONFIG_FILE}")
path.parent.mkdir(parents=True, exist_ok=True)
text = path.read_text() if path.exists() else ""

hook_cmd = 'bash "\$(git rev-parse --show-toplevel)/.codex/hooks/post-read-index.sh"'
block = f"""

# code-memory: index files read through Codex shell commands.
[[hooks.PostToolUse]]
matcher = "^Bash$"

[[hooks.PostToolUse.hooks]]
type = "command"
command = '{hook_cmd}'
timeout = 30
statusMessage = "Indexing file reads"
"""

if hook_cmd not in text:
    path.write_text(text.rstrip() + block + "\\n")
    print(f"[init-memory] Hook registered in {path}")
else:
    print(f"[init-memory] Hook already registered in {path}")
PYEOF

# 4b. Remove legacy code-memory entries from .codex/hooks.json so Codex does
# not merge two project-local hook representations or call a stale path.
python3 - <<PYEOF
import json
from pathlib import Path

path = Path("${HOOKS_JSON}")
if not path.exists():
    raise SystemExit(0)

try:
    cfg = json.loads(path.read_text())
except json.JSONDecodeError:
    print(f"[init-memory] WARNING: {path} is not valid JSON; leaving it untouched.")
    raise SystemExit(0)

hooks = cfg.get("hooks", {})
removed = False
for event, groups in list(hooks.items()):
    if not isinstance(groups, list):
        continue
    kept_groups = []
    for group in groups:
        handlers = group.get("hooks", [])
        kept_handlers = []
        for handler in handlers:
            command = handler.get("command", "")
            if "post-read-index.sh" in command:
                removed = True
                continue
            kept_handlers.append(handler)
        if kept_handlers:
            group["hooks"] = kept_handlers
            kept_groups.append(group)
    if kept_groups:
        hooks[event] = kept_groups
    else:
        hooks.pop(event, None)

if not removed:
    raise SystemExit(0)

if hooks:
    cfg["hooks"] = hooks
    path.write_text(json.dumps(cfg, indent=2) + "\\n")
    print(f"[init-memory] Removed stale code-memory hook from {path}")
else:
    path.unlink()
    print(f"[init-memory] Removed stale {path}; hook is now inline in .codex/config.toml")
PYEOF

# 5. Add .codex/memory/ to .gitignore if not already there.
if [ -f "${GITIGNORE}" ]; then
    if ! grep -qE '^\.codex/memory/?$' "${GITIGNORE}"; then
        echo "" >> "${GITIGNORE}"
        echo "# code-memory: agent-only index, do not commit" >> "${GITIGNORE}"
        echo ".codex/memory/" >> "${GITIGNORE}"
        echo "[init-memory] Added .codex/memory/ to .gitignore"
    else
        echo "[init-memory] .codex/memory/ already in .gitignore"
    fi
else
    echo "# code-memory: agent-only index, do not commit" > "${GITIGNORE}"
    echo ".codex/memory/" >> "${GITIGNORE}"
    echo "[init-memory] Created .gitignore with .codex/memory/"
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

echo "[init-memory] Done. Memory will populate as Codex explores files."
echo "[init-memory] NOTE: If hooks are not trusted in this Codex environment,"
echo "[init-memory]       follow the 'Instruction-mode fallback' section of code-memory's SKILL.md."
