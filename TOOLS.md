# TOOLS.md — PRUVIQ 개발 도구 Inventory

> 현재 쓰는 툴/버전 레퍼런스. 버전 변경 시 이 파일 + `package.json` 동시 갱신.

## Frontend

- **Astro** 5.x — 정적 사이트 빌더 (`astro build` → `dist/`)
- **Preact** 10.x — islands hydration
- **Tailwind CSS** 4.x — 스타일링
- **TypeScript** 5.x — 타입 시스템
- **lightweight-charts** — 차트 (TradingView)
- **@astrojs/sitemap** — sitemap 자동 생성
- **@fontsource-variable/geist** — 폰트

## Backend

- **Python** 3.12
- **FastAPI** + **uvicorn** (워커 1개)
- **Pydantic** 2.x — 스키마
- **ccxt** — 거래소 API (OKX, Binance 등)
- **SQLite** + **MultiFernet** — okx_sessions.db 암호화 회전
- **litestream** — B2 백업

## Testing

- **Playwright** 1.5x — E2E + a11y + visual regression
- **@axe-core/playwright** — a11y 검사
- **Vitest** 4.x — unit test (jsdom 환경)
- **@lhci/cli** 0.14.0 — Lighthouse CI 예산 게이트
- **lychee** (CI) — markdown 링크 체커 (PR5 예정)

## DevOps

- **wrangler** — Cloudflare Pages 배포
- **gh** — GitHub CLI
- **Alloy** (Grafana) — 메트릭 스크래핑
- **cloudflared** — Tunnel
- **systemd** — 백엔드 서비스 관리 (DO droplet 상)

## 로컬 머신 (dev)

- **MacBook** (jplee) — 코드 작성 + 빌드 테스트
- **Mac Mini M4** (jepo) — OHLCV 수집 cron + autotrader 백업 + AI 리서치

## 환경변수 / Secrets (GitHub Actions)

- `DO_HOST` — DigitalOcean droplet 호스트 (백엔드)
- `DO_SSH_PRIVATE_KEY` — deploy-backend.yml 용
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` — data-deploy.yml
- `BRAVE_API_KEY` — 리서치 스크립트 (`docs/BRAVE_API_KEY.md` 참조)

## 주요 스크립트

- `scripts/discover-interactives.mjs` — Layer 1 인터랙티브 인벤토리
- `scripts/check-freshness.mjs` — Layer 4 데이터 freshness
- `scripts/check-broken-links.mjs` — Broken-link crawler
- `scripts/classify-flake.mjs` — Layer 8 flake 분류
- `scripts/summarize_memories.py` — memory/ auto-summary

## 참고

- `docs/DOC_INDEX.md` — 전체 문서 TOC
- `docs/ARCHITECTURE.md` — 시스템 아키텍처
- `docs/INFRASTRUCTURE.md` — 배포 토폴로지
- `docs/QA_AUTOMATION.md` — 9-레이어 QA 자동화
