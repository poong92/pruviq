# SKILL: security-ci

Role
- Run static analysis (CodeQL, Snyk) and surface high/critical issues as issues or PR comments.

When to use
- On PRs, nightly scans, or on-demand security sweeps

Inputs
- Branch/commit to scan

Outputs
- Security report (JSON), list of findings with severity, actionable remediation suggestions, created issues for critical findings

Example tasks
- "Run CodeQL on branch feat/sim-rework and create issues for HIGH/CRITICAL findings"

Required permissions
- Read access to repo and ability to create issues; GitHub Actions token for CodeQL runs

Safety constraints
- No automated fixes for critical security issues without human review

Notes
- Integrates with .github/workflows/codeql.yml already present in repo.
