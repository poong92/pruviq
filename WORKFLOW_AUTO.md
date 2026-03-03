# WORKFLOW_AUTO.md

Purpose
- Provide a minimal, deterministic startup checklist used by the post-compaction audit and startup automation.
- If a required file is missing, record an actionable report and create a minimal placeholder so the runtime can continue.

Required files (in repo root or memory/ as noted)
- SOUL.md
- USER.md
- IDENTITY.md
- MEMORY.md
- memory/summaries/latest (preferred) or memory/summaries/YYYY-MM-DD.summary.md

Startup order
1. Validate presence of the required files above.
2. Load in order: SOUL.md → USER.md → IDENTITY.md → memory/summaries/latest (if present) → MEMORY.md (full) only if needed.
3. If memory/summaries/latest is missing, run the summarizer: `python3 scripts/summarize_memories.py --recent 7 --out memory/summaries/latest.summary.md`.
4. Run `scripts/validate_skill.py` (if present) to validate SKILL.md files.
5. Run health-checks (cron/health-check) and fail early if critical checks fail.

Fallback behavior
- If a required file is missing:
  1. Create a minimal placeholder in `.tmp/startup-placeholders/` with a timestamp and the expected filename.
  2. Write a report file `reports/startup-missing-YYYYMMDD-HHMMSS.md` describing which files were missing and any created placeholders.
  3. (Optional) Create a GitHub issue describing the missing startup file and attach the report. Automation should not merge or change production state without explicit human approval.

Operational notes
- Summaries are preferred to reduce context size. A summarizer script (scripts/summarize_memories.py) should exist and be used by default.
- CI should include a check that verifies WORKFLOW_AUTO.md exists and is readable. Example CI step name: `validate-startup-files`.
- The post-compaction audit should consult memory/summaries/latest first; if it cannot find required summaries it should run the summarizer before failing.

Contact
- Responsible: ops-sre (assign to JEPO when opening issues)

Version history
- v0.1 — initial draft; created by PRUVIQ Bot
