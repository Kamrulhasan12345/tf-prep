#!/usr/bin/env python3
"""Pre-computes the key points of every exam question into assets/keypoints.json, so the
published site can mark answers without the local helper (the browser talks to Amos directly).

Run after adding or editing exam questions:  python3 tools/build_keypoints.py
Regenerate entries that fail the quality check (rambling, merged or cut-off points):  ... --fix
Needs chromium (renders each chapter so JS-drawn figure labels are included, exactly as the
browser sees them) and TYPELLM_API_KEY in the same .env ai_proxy.py reads. Resumable: questions
already in keypoints.json are skipped; questions no longer in any chapter are dropped.
"""
import json, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from ai_proxy import typellm   # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "keypoints.json"


def norm(s):   # mirrors text() in aicheck.js
    return re.sub(r"\s*\n\s*", "\n", re.sub(r"[ \t]+", " ", s)).strip()


def key(q):    # mirrors key() in aicheck.js: whitespace-free question text
    return re.sub(r"\s+", "", q)


class Exams(HTMLParser):
    """Collects textContent of .exam-q / .exam-a inside each .exam block."""
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}

    def __init__(self):
        super().__init__()
        self.stack, self.found, self.cur = [], [], None

    def handle_starttag(self, tag, attrs):
        if tag in self.VOID:
            return
        cls = (dict(attrs).get("class") or "").split()
        role = "exam" if "exam" in cls else "q" if "exam-q" in cls else "a" if "exam-a" in cls else None
        if role == "exam":
            self.cur = {"q": "", "a": ""}
        self.stack.append(role)

    def handle_endtag(self, tag):
        if tag in self.VOID or not self.stack:
            return
        if self.stack.pop() == "exam":
            self.found.append(self.cur)
            self.cur = None

    def handle_data(self, data):
        if self.cur is not None:
            for r in ("q", "a"):
                if r in self.stack:
                    self.cur[r] += data


def exams_in(page):
    dom = subprocess.run(["chromium", "--headless", "--disable-gpu", "--virtual-time-budget=3000", "--dump-dom",
                          page.as_uri()], capture_output=True, text=True, timeout=60).stdout
    p = Exams()
    p.feed(dom)
    return [(norm(e["q"]), norm(e["a"])) for e in p.found if e["q"].strip() and e["a"].strip()]


def points(q, a):
    res = typellm(
        f"Exam question:\n{q}\n\nModel answer:\n{a[:12000]}",
        {"points": {"type": "array", "minItems": 2, "maxItems": 8, "items": {"type": "string"},
                    "instructions": "List the separate key points a marker would look for in a full-mark answer, "
                                    "most important first. Each point is one short, self-contained claim in plain words "
                                    "(include the specific value, name or rule the answer must contain), at most 30 words. "
                                    "No duplicates, no reasoning or commentary, one claim per item."}})
    return [p.strip() for p in res.get("points") or [] if p and p.strip()][:8]


RAMBLE = re.compile(r"\b(actually|let's re|hmm|stick to|model answer says|depending on|or it is not)\b|\bwait, |', '|\?\s", re.I)


def bad(pts):
    """Fails when a point rambles, merges several points, or was cut off by the model."""
    return len(pts) < 2 or any(len(p) > 300 or RAMBLE.search(p) for p in pts)


def main():
    pages = sorted(p for p in ROOT.glob("*/*.html") if 'class="exam"' in p.read_text())
    with ThreadPoolExecutor(6) as pool:
        found = {key(q): (q, a) for exams in pool.map(exams_in, pages) for q, a in exams}
    old = json.loads(OUT.read_text()) if OUT.exists() else {}
    out = {k: v for k, v in old.items() if k in found}
    fix = "--fix" in sys.argv
    todo = [k for k in found if k not in out or (fix and bad(out[k]))]
    print(f"{len(pages)} chapters, {len(found)} distinct questions, {len(todo)} to generate", file=sys.stderr)

    def one(k):
        try:
            return k, points(*found[k])
        except Exception as e:
            print(f"  failed: {found[k][0][:60]!r}: {e}", file=sys.stderr)
            return k, None

    with ThreadPoolExecutor(6) as pool:
        for n, (k, pts) in enumerate(pool.map(one, todo), 1):
            if pts and (k not in out or not bad(pts)):   # --fix keeps the old entry if the retry is no better
                out[k] = pts
            if n % 20 == 0:   # save as we go so an interrupted run keeps its work
                OUT.write_text(json.dumps(out, ensure_ascii=False, indent=0))
                print(f"  {n}/{len(todo)}", file=sys.stderr)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=0))
    print(f"wrote {len(out)}/{len(found)} questions to {OUT.relative_to(ROOT)}; "
          f"{sum(bad(v) for v in out.values())} still fail the quality check", file=sys.stderr)


if __name__ == "__main__":
    main()
