# SKILL: frontend-dev

Role
- Implement UI/UX designs into code, produce safe, testable frontend changes (Astro + Preact + Tailwind).

When to use
- Converting a design or Figma spec to working components
- Adding new pages, PoCs (eg. One-Click Demo), accessibility fixes, responsive adjustments

Inputs
- Design/artifact (Figma URL or image) or issue/PR link
- Acceptance criteria (KPI, screenshot expectations)

Outputs
- Feature branch with commits (one logical change per commit)
- Build pass (npm run build) and Playwright smoke verification screenshots
- PR draft text (description, tests, QA notes)

Example tasks
- "Implement DemoRunner UI as in design file X, ensure Playwright smoke passes"
- "Add mobile touch target adjustments for simulate page" 

Required permissions
- Read/write repo (create branches, commit, push via SSH)

Safety constraints
- Never insert HTML inside Astro frontmatter (--- block)
- Never apply global display: !important rules
- Always run `npm run build` and Playwright smoke locally before committing

Notes
- This skill focuses on reliable, testable frontend work and hands-off ops changes (no server restarts).
