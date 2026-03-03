# SKILL: qa-e2e

Role
- Validate core user flows and visual integrity using Playwright + axe + visual diffing. Produce reproducible test artifacts and failure tickets.

When to use
- After a frontend change/PR is pushed or scheduled nightly runs
- Before merging feature branches that affect core flows (simulate, demo, coins, strategies)

Inputs
- Branch or preview URL, test matrix (Desktop/Mobile), acceptance threshold (visual tolerance)

Outputs
- Test artifacts: HTML reports, screenshots, console logs, axe reports
- Summary: pass/fail, failed assertions, flaky test notes
- Automatically created issue templates for failing checks (with steps & artifacts)

Example tasks
- "Run smoke tests for feat/sim-rework on Desktop + Mobile; upload artifacts"
- "Run accessibility run for /simulate and list WCAG violations"

Required permissions
- Read repo, run tests in CI context, upload artifacts to workflow run

Safety constraints
- Tests must be non-destructive (no form submits that alter production data)
- Limit screenshots/artifacts to avoid storing user PII

Notes
- Integrates with Actions workflow (.github/workflows/e2e.yml) and uses Playwright config in repo.
