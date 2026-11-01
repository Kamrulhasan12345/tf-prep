# TF Prep

Term-final study notes, published as a static site on GitHub Pages. No build step: every file is served as-is.

| Subject | Folder | Course |
|---|---|---|
| Database Management Systems | [`dbms/`](dbms/) | CSE215 |
| Electronic Circuits | [`eee/`](eee/) | EEE263 |

## Layout

```
tf-prep/
├── index.html          # landing page: one card per subject
├── .nojekyll           # tells GitHub Pages to serve files untouched
├── <subject>/          # one self-contained book per subject
│   ├── index.html      # the subject's home page
│   ├── assets/         # shared CSS/JS for that subject
│   └── <chapter dirs>/ # lecture folders with chapter .html files
└── docs/               # how to add and publish content
```

## Docs

- [Adding a subject](docs/adding-a-subject.md)
- [Adding chapters to an existing subject](docs/adding-chapters.md)
- [Publishing to GitHub Pages](docs/publishing.md)

## Preview locally

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```
