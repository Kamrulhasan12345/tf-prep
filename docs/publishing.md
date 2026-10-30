# Publishing to GitHub Pages

## First time (about 5 minutes)

1. Create an empty public repo on GitHub, e.g. `tf-prep`.
2. From this folder:
   ```sh
   git init -b main
   git add .
   git commit -m "Initial notes"
   git remote add origin git@github.com:<you>/tf-prep.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
4. Wait 1–2 minutes. The site is at `https://<you>.github.io/tf-prep/`.

## Every update after that

```sh
git add . && git commit -m "Add <what you added>" && git push
```

Pages redeploys on each push (about 1 minute).

## Why `.nojekyll`

Without it, GitHub runs Jekyll, which ignores files and folders starting with `_`. The empty `.nojekyll` file makes Pages serve everything as-is. Don't delete it.
