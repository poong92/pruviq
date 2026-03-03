# Generated static data

This repository contains generated JSON snapshots under `public/data/*.json` created by the static refresh pipeline. These files are useful for serving a snapshot of market and coin data, but they frequently cause merge conflicts when the static refresh runs and updates the files on main.

Recommended approach (implemented by this PR):

1. Keep a dedicated branch `generated-data` where the refresh pipeline publishes generated snapshots. This repository includes a convenience GitHub Actions workflow `.github/workflows/static-refresh-to-branch.yml` which can be triggered manually (or by a CI job) to capture the current `public/data` directory into the `generated-data` branch.

2. The static refresh pipeline (external scheduler) should push generated files to the `generated-data` branch and open a PR to `main` when updates are desired. This centralizes generated-data changes and reduces direct, frequent modifications to `main` which cause merge conflicts.

3. Long-term options (choose one):
   - Move generated files entirely to a separate storage (S3 or CDN) and fetch at build/serve time.
   - Write generated files to a build-time cache (e.g., `.cache/`) and add them to `.gitignore`.
   - Use a merge policy or bot to always accept `generated-data` branch into `main` via PRs.

Notes:
- This change is intentionally non-invasive: it does not remove tracked files from `main` to avoid breaking any build that expects shipped data. It provides an automation path to reduce direct commits to `main` from scheduled refreshes.
- Next step (ops): update the external static refresh job to push to `generated-data` and open a PR when significant changes occur.
