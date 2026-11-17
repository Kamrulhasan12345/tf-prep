#!/bin/bash
# Usage: math/tools/check.sh math/vc/06-green.html ...   (needs `python3 -m http.server 8000` at the repo root)
# Checks: inline JS parses, every solve()/worked() card renders, no KaTeX errors, no absolute links.
cd "$(dirname "$0")/../.." || exit 1
tmp=$(mktemp -d); rc=0
for f in "$@"; do
  f=${f#./}; awk '/<script>$/{on=1;next} /<\/script>/{on=0} on' "$f" > "$tmp/x.js"
  node --check "$tmp/x.js" 2>"$tmp/err" || { echo "FAIL $f: JS syntax"; head -5 "$tmp/err"; rc=1; continue; }
  want=$(grep -cE '^\s*(solve|worked)\(' "$tmp/x.js")
  dom=$(timeout 40 chromium --headless --disable-gpu --virtual-time-budget=8000 --dump-dom "http://localhost:8000/$f" 2>/dev/null)
  got=$(grep -o 'class="must solve' <<<"$dom" | wc -l); kerr=$(grep -o 'katex-error' <<<"$dom" | wc -l)
  abs=$(grep -cE '(href|src)="/' "$f")
  [ "$got" -ge "$want" ] && [ "$kerr" -eq 0 ] && [ "$abs" -eq 0 ] && echo "ok   $f ($got cards)" || { echo "FAIL $f: cards $got/$want, katex errors $kerr, absolute links $abs"; rc=1; }
  [ "$kerr" -gt 0 ] && grep -o 'katex-error"[^>]*title="[^"]*' <<<"$dom" | head -3
done
rm -rf "$tmp"; exit $rc
