---
name: security-ci
description: Security / CI agent. Use for dependency scanning, secret scanning, and security triage. Trigger on new dependency advisories, PR changes to CI config, or scheduled security scans.
---

# Security / CI Skill

Keep scanning outputs and remediation guidance as bundled resources. SKILL.md should describe triggers and acceptable remediation steps.

When to use:
- New vulnerabilities reported by `npm audit` or Snyk
- Secrets detected in repo or CI artifacts
- Dependency upgrades that require verification/testing
