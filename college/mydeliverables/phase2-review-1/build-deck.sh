#!/usr/bin/env bash
# Render the Phase 2 Review-1 HTML deck to full-slide PNGs with the cached
# Chrome for Testing binary, then build the pixel-faithful PPTX.
#
# Output: phase2-review1-deck.pptx  (next to this script)
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$DIR/phase2-review1-deck.html"
OUT="$DIR/phase2-review1-deck.pptx"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# --- resolve Chrome, its NSS/ALSA deps, and a Linux Node -----------------------
CHROME="$(ls -d "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux*/chrome 2>/dev/null | head -1)"
if [ -z "${CHROME:-}" ]; then
  echo "ERROR: no Chrome for Testing binary found under $HOME/.cache/ms-playwright" >&2
  exit 1
fi
export LD_LIBRARY_PATH="$HOME/.local/chrome-deps/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
NODE="$(command -v node || echo "$HOME/.local/node/bin/node")"
export CHROME

# --- temp copy of the deck with capture logic injected --------------------------
TMPHTML="$WORK/deck.html"
python3 - "$SRC" "$TMPHTML" <<'PY'
import sys
src = open(sys.argv[1], encoding="utf-8").read()
inject = """<script>
(function(){
  try {
    var n = parseInt(new URLSearchParams(location.search).get('n') || '1', 10);
    var slides = document.querySelectorAll('.slide');
    var idx = Math.max(0, Math.min(slides.length - 1, n - 1));
    if (typeof show === 'function') show(idx);
    var junk = document.querySelectorAll('.navbar, .pbar, .hint');
    for (var i = 0; i < junk.length; i++) {
      var el = junk[i];
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
  } catch (e) {}
})();
// Force every family/weight the deck may use, so no slide falls back to
// Georgia/system-ui/monospace because its weight was never fetched.
(function(){
  var specs = [
    ['Fraunces', 400], ['Fraunces', 500], ['Fraunces', 600], ['Fraunces', 700],
    ['Inter Tight', 400], ['Inter Tight', 500], ['Inter Tight', 600], ['Inter Tight', 700],
    ['JetBrains Mono', 400], ['JetBrains Mono', 500]
  ];
  var holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:10px;height:10px;opacity:0;pointer-events:none;';
  specs.forEach(function (s) {
    var sp = document.createElement('span');
    sp.textContent = 'W';
    sp.style.fontFamily = '"' + s[0] + '", sans-serif';
    sp.style.fontWeight = s[1];
    holder.appendChild(sp);
  });
  document.body.appendChild(holder);
  specs.forEach(function (s) { document.fonts.load(s[1] + ' 16px "' + s[0] + '"'); });
})();
</script>"""
open(sys.argv[2], "w", encoding="utf-8").write(src.replace("</body>", inject + "</body>"))
PY

# --- capture each slide via CDP (viewport pinned to 1280x720, 2x PNG) -----------
mkdir -p "$WORK/slides"
PORT=$((9300 + RANDOM % 700))
"$NODE" "$DIR/capture-deck.mjs" "$TMPHTML" "$WORK/slides" "$PORT"

# --- build the PPTX -------------------------------------------------------------
python3 "$DIR/build_pptx.py" "$WORK/slides" "$OUT"
ls -l "$OUT"