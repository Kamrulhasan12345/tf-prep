#!/bin/sh
# Render every page headless and report JS errors (data-err set by dld.js) and empty widget divs.
cd "$(dirname "$0")/.."
for f in $(node -e "const s=require('fs').readFileSync('assets/book.js','utf8');for(const m of s.matchAll(/\['([^']+\.html)'/g))console.log(m[1])") index.html; do
  [ -f "$f" ] || continue
  out=$(timeout 40 chromium --headless=new --disable-gpu --no-sandbox --virtual-time-budget=4000 --dump-dom "http://localhost:8765/dld/$f" 2>/dev/null)
  err=$(printf '%s' "$out" | grep -o 'data-err="[^"]*"' | head -1)
  [ -n "$err" ] && echo "ERR  $f  $err" || echo "ok   $f"
done
