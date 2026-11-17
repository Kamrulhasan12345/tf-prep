# Rebuild the formula sheet in last-night.html from every chapter's "One-minute summary".
# Usage: python3 math/tools/build_lastnight.py
import re, glob, os
os.chdir(os.path.join(os.path.dirname(__file__), '..'))
parts = [('vc', 'Vector calculus'), ('cc', 'Complex calculus'), ('pde', 'PDE')]
out = []
for d, name in parts:
    out.append(f'<h2>{name}</h2>')
    for f in sorted(glob.glob(f'{d}/0*.html')):
        s = open(f).read()
        m = re.search(r'<h2[^>]*>One-minute summary</h2>(.*?)(?=<h2|</main>)', s, re.S)
        t = re.search(r'<h1>(.*?)</h1>', s).group(1)
        if m: out.append(f'<h3><a href="{f}">{t}</a></h3>{m.group(1).strip()}')
p = 'last-night.html'; s = open(p).read()
s = re.sub(r'(<!-- SHEET -->).*?(<!-- /SHEET -->)', lambda m: m.group(1) + '\n' + '\n'.join(out) + '\n' + m.group(2), s, flags=re.S)
open(p, 'w').write(s)
print('sheet sections:', len(out))
