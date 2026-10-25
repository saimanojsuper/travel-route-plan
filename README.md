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

## Plan data

- Valid changes autosave a recovery draft to this browser's `localStorage`.
- Use **Data & settings** to export the complete plan as a versioned JSON file, preview and import a backup, clear local recovery, or start a new plan.
- Import validates the file before replacement. Invalid or cancelled imports leave the current plan untouched.
- Clearing local recovery leaves the active in-memory plan open; editing it again creates a new recovery draft.
- Starting a new plan clears the active plan, session undo history, and local recovery after confirmation.

See [`docs/plan-json-format.md`](docs/plan-json-format.md) for the portable format and validation rules.

## Hosting

The production build is static. The included GitHub Actions workflow builds and deploys `dist/` to GitHub Pages with repository-aware Vite base-path handling.
