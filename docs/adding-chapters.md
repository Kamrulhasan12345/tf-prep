# Adding chapters to a subject

1. Put the file in its lecture folder, named `NN-slug.html`, e.g. `dbms/s09/01-query-optimizer.html`.
2. Start from an existing chapter in the same subject so you get the same `<head>`, stylesheet links (`../assets/book.css`) and scripts (`../assets/book.js`).
3. Add it to `BOOK.parts` in `<subject>/assets/book.js`:
   ```js
   { title: 'Lec 09 · Query optimization', chapters: [
     ['s09/01-query-optimizer.html', 'The query optimizer', 's.1–12'],
   ] },
   ```
   The sidebar, prev/next buttons and the subject index's "All chapters" list all read from this, so one edit updates all three.
4. Reload the page in the local preview and check the sidebar entry and prev/next links.

## DBMS-specific helpers

- `dbms/assets/sqlplay.js`: live SQL playground (Oracle-flavoured syntax, loads a WASM engine from the internet).
- `dbms/assets/aicheck.js`: "AI check my answer" box on every `.exam` block. Key points come from `dbms/assets/keypoints.json`; marking goes to Amos from the browser.
  **After adding or editing exam questions, run** `python3 dbms/tools/build_keypoints.py` (needs chromium and `TYPELLM_API_KEY` in your local `.env`). It only generates the new ones. Questions missing from the JSON simply show no AI box.
- `dbms/tools/ai_proxy.py`: optional local helper. Adds photo upload when the book is opened from your own machine.
- Lecture folders can carry their own `lecture.css` / `lecture.js` for figures used only in that lecture.
