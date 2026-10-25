# Travel Route Planner

A static, browser-only multi-city trip planner built with React, TypeScript, Vite, Zustand, and Zod. Plans stay on the device unless you export a JSON backup.

## Run locally

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm test
npm run lint
npm run build
```

`npm run build` type-checks with `tsc -b` and then produces a static production bundle in `dist/`. To inspect that bundle locally, run `npm run preview`.

## Plan data

- Valid changes autosave a recovery draft to this browser's `localStorage`.
- On a genuinely first load (no local draft exists yet, e.g. a fresh browser or after clearing data), the app automatically loads a bundled starter plan — a sample "Rajasthan Circuit" trip — as a normal, fully editable plan, validated through the same schema as any import. It autosaves immediately, so from that point on it behaves exactly like any plan you built yourself; edit or replace it freely. See `src/data/defaultTripPlan.ts`.
- Use **Data & settings** to export the complete plan as a versioned JSON file, preview and import a backup, clear local recovery, or start a new plan.
- Import validates the file before replacement. Invalid or cancelled imports leave the current plan untouched.
- Clearing local recovery or starting a new plan both immediately clear the active plan, session undo history, and local recovery draft after an in-app confirmation step (no native browser dialogs), landing back on the setup screen with no reload required.
- Same-day activities are checked for overlapping times using either an explicit end time or a start time plus duration, and show a non-blocking warning on each conflicting activity.
- Route stops can be reordered by dragging or with dedicated "Move up"/"Move down" buttons on each stop card, so reordering does not require pointer-based drag.

See [`docs/plan-json-format.md`](docs/plan-json-format.md) for the portable format and validation rules.

## Hosting

The production build is fully static and has no server dependency — import/export use only browser `File`, `Blob`, and `URL` APIs, and the recovery draft uses `localStorage`. This means the same build works identically from `localhost`, a GitHub Pages sub-path, or any static file host.

### GitHub Pages deployment

`.github/workflows/deploy.yml` builds and deploys automatically on every push to `main`:

1. `npm ci`, `npm test`, `npm run lint`, and `npm run build` all run first; the deploy step never runs on a failing build.
2. The `dist/` output is uploaded as a Pages artifact and published via `actions/deploy-pages`.
3. In the repository's **Settings → Pages**, set the source to **GitHub Actions** (one-time setup).

`vite.config.ts` computes the Vite `base` path automatically so asset URLs resolve correctly once deployed:

- Inside GitHub Actions, it derives `/<repository-name>/` from `GITHUB_REPOSITORY` (or `/` for a `*.github.io` user/org site).
- Locally, you can simulate the deployed sub-path with `VITE_BASE_PATH=<repository-name> npm run build && npm run preview`.
- With no overrides (plain local dev/build), the base path is `/`.
