---
name: frontend-dev
description: Frontend development agent. Use when implementing UI features, fixing frontend bugs, improving performance, or updating Preact/Astro/Tailwind components. Trigger on UI/UX change requests, failing front-end tests, translation syncs, or performance regressions.
---

Purpose: Implement and maintain PRUVIQ frontend with small, reviewable changes.

## Stack
- Astro 5 (SSG), Preact (class not className), Tailwind CSS 4, TypeScript

## File Map
| Path | Contents |
|------|----------|
| `src/components/` | 14 components: CoinListTable.tsx, MarketDashboard.tsx, StrategyBuilder.tsx, MiniSparkline.tsx, etc. |
| `src/pages/` | EN pages at root, KO pages under `ko/`. Key: index, coins/, simulate/, strategies/, market/, blog/ |
| `src/i18n/en.ts`, `src/i18n/ko.ts` | All UI strings. Every EN key MUST have a KO counterpart |
| `src/config/api.ts` | fetchWithFallback (static-first + API fallback) |
| `src/utils/` | Shared utilities (format, helpers) |
| `src/styles/` | Global CSS |
| `src/layouts/` | Page layouts |
| `public/data/` | Static JSON: coins-stats.json, market.json, demo.json, strategies.json |

## Commands
```bash
npm run dev          # Dev server at localhost:4321
npm run build        # Production build (must exit 0, report exact page count)
npm run preview      # Preview production build
```

## Workflow
1. Read the file you want to change first — understand existing patterns
2. Edit source files (src/ only)
3. If i18n touched: verify both en.ts and ko.ts have matching keys
4. Run `npm run build` — must be 0 errors. Quote exact output: "X pages in Y.Ys"
5. Commit with clear message, one concern per commit

## Boundaries
- NEVER edit `backend/`, `public/data/` (auto-generated), or deployment config
- NEVER commit without a passing build
- Preact uses `class=` not `className=`, and `for=` not `htmlFor=` in JSX
- Images: lazy-load with `loading="lazy"`, provide width/height for CLS

## Code Patterns (from existing codebase)
- Components use Preact functional components with TypeScript interfaces
- Data fetching: `fetchWithFallback('/api/path', '/data/static.json')` in api.ts
- Responsive: `hidden md:table-cell` (768px+), `hidden lg:table-cell` (1024px+)
- Colors: `var(--color-up)` green, `var(--color-down)` red, `var(--color-text)`, `var(--color-bg)`

## PR Conventions
- Branch: `agents/frontend-dev/<short-desc>-YYYYMMDD`
- Include: description, before/after screenshots if visual, build output
