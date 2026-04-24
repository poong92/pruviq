# HEARTBEAT.md — placeholder (not-active)

> 파일명 유지 (`.github/workflows/validate-startup-files.yml` 계약).
> 본 파일은 **현재 능동 instrumentation 아님**.

## 이전 의도

초기 계획에서 크론 폴링 heartbeat 파일로 설계됐으나 (2026-02-21),
실제 모니터링은 Grafana Cloud Prometheus + Loki 로 이관됨 (2026-04
`#1197`, `#1237`).

## 현행 heartbeat 대체

- **API 헬스체크**: `https://api.pruviq.com/health` — uptime, coins_loaded, version
- **Layer 4 freshness monitor**: `.github/workflows/freshness-monitor.yml` (15-min cron)
- **Layer 7 nightly QA**: `.github/workflows/nightly-qa.yml` (02:00 UTC)
- **Grafana 대시보드**: `backend/deploy/grafana/dashboard-pruviq-api.json` 18 패널
- **알림**: Telegram `@PRUVIQ` 봇 (7 alert rule)

## 관련 문서

- `docs/ARCHITECTURE.md` § QA Assurance Layer
- `docs/QA_AUTOMATION.md`
