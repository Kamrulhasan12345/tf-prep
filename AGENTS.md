# AGENTS.md

Instructions for AI coding agents working in this repo. (`CLAUDE.md` points here.)

## What this is

A static GitHub Pages site of term-final study notes. Plain HTML/CSS/JS, no build step, no framework, no package manager. Whatever is in the repo is what gets served.

## Rules

1. **Relative links only.** The site is served from a sub-path (`https://<user>.github.io/<repo>/`), so `href="/x"` breaks. Use `x.html`, `../assets/book.css`, etc.
2. **One subject = one self-contained folder** at the root (`dbms/`, `os/`, ...). A subject never reaches into another subject's folder. Copy assets instead of sharing them across subjects.
3. **Register every new subject** as an `<li>` in the root `index.html` (inside `<ul class="subjects">`) and as a row in `README.md`'s table.
4. **Each subject's `index.html` links back to the root** with `<a href="../">TF Prep</a>`.
5. **Chapters live in a lecture folder**, named `NN-slug.html` (e.g. `i04/03-comparisons-and-between.html`). Folder prefixes are per-subject (in `dbms/`: `i` = Ishrak sir, `s` = Sukarna sir, `l` = lecture-only).
6. **Table of contents is data.** In `dbms/`, the sidebar and the "All chapters" list both come from `BOOK.parts` in `dbms/assets/book.js`. Add a chapter there, or it will not appear in navigation or prev/next.
7. **No secrets in the repo.** It is public. API keys stay in local `.env` files outside the repo.
8. **Nothing server-side runs on Pages.** In `dbms/`, "AI check my answer" works on the live site by reading pre-built key points from `dbms/assets/keypoints.json` and calling Amos (free, no key) from the browser. After adding or editing exam questions (`.exam` blocks), run `python3 dbms/tools/build_keypoints.py` (needs chromium + `TYPELLM_API_KEY`), or new questions get no AI box. `dbms/tools/ai_proxy.py` is a local-only extra for photo reading.

## Common tasks

- Add a subject: follow `docs/adding-a-subject.md`.
- Add chapters: follow `docs/adding-chapters.md`.
- Preview: `python3 -m http.server 8000` from the repo root.
- Check for broken absolute links before committing: `grep -rn 'href="/\|src="/' --include=*.html .` should print nothing.
