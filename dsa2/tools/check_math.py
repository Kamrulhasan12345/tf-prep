# Fails if any maths in a dsa2 page contains a raw "<", which the browser reads as a tag and silently cuts the text.
# Write &lt; instead. Run: python3 dsa2/tools/check_math.py
import os, re, sys
root = os.path.join(os.path.dirname(__file__), '..')
H = [r'\\\((.*?)\\\)', r'\\\[(.*?)\\\]']
J = [r'\\\\\((.*?)\\\\\)', r'\\\\\[(.*?)\\\\\]']
bad = 0
for a, _, fs in os.walk(root):
    for f in fs:
        if not f.endswith('.html'): continue
        p = os.path.join(a, f); s = open(p).read(); pos = 0; parts = []
        for m in re.finditer(r'<script[^>]*>(.*?)</script>', s, re.S):
            parts += [(s[pos:m.start(1)], H), (m.group(1), J)]; pos = m.end(1)
        parts.append((s[pos:], H))
        for seg, pats in parts:
            for pat in pats:
                for m in re.finditer(pat, seg, re.S):
                    if '<' in m.group(1): bad += 1; print(os.path.relpath(p, root), m.group(0)[:70])
print('raw < inside maths:', bad); sys.exit(1 if bad else 0)
