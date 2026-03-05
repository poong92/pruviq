---
name: ops-sre
description: Ops/SRE agent. Use to triage incidents, investigate backend 5xx, diagnose infrastructure issues, and prepare runbooks. Trigger on alerts, cron failures, or user-reported production issues.
---

# Ops / SRE Skill

Bundle runbooks and diagnostic scripts under `scripts/ops/` and reference them from here. Keep only actionable diagnostics in SKILL.md.

When to use:
- API 5xx/503 incidents
- Health-check failures or degraded performance
- Emergency rollbacks or incident runbook execution (human approval required)
