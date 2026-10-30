# Adding a subject

About 10 minutes, plus however long the notes take.

1. Create a folder at the repo root with a short lowercase name, e.g. `os/`.
2. Copy the shell from DBMS as a starting point:
   ```sh
   mkdir -p os && cp -r dbms/assets os/assets
   ```
3. In `os/assets/book.js`, replace the `BOOK.parts` list with your own lectures and chapters (`[file, title, slide-range]`).
4. Create `os/index.html`. Easiest path: copy `dbms/index.html`, keep the `<head>`, the back-link eyebrow (`<a href="../">TF Prep</a> · <COURSE CODE>`) and the "All chapters" script; delete the DBMS-specific sections.
5. Add chapter files in lecture folders: see [adding-chapters.md](adding-chapters.md).
6. Register the subject in the root `index.html`, inside `<ul class="subjects">`:
   ```html
   <li><a href="os/"><b>Operating Systems</b><span class="code">CSE313</span>
     <p>One-line summary of what the notes cover.</p></a></li>
   ```
7. Add a row to the table in `README.md`.
8. Preview with `python3 -m http.server 8000` and click through from the root page.

Notes don't have to use the DBMS book shell. Any static HTML works, as long as links are relative and the subject's `index.html` links back to `../`.
