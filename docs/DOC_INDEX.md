# Documentation Index

전체 문서 TOC. 새 .md 추가 시 이 인덱스에 반드시 등록 (PR5 가드가 누락 감지).

---

## 루트 (`/Users/jepo/pruviq/*.md`)

**정책/프로토콜**:
- [AGENTS.md](../AGENTS.md) — 에이전트 세션 초기화 가이드
- [AUTONOMY.md](../AUTONOMY.md) — 자동화 정책, PR 플로우
- [VERSIONING.md](../VERSIONING.md) — Platform vs Strategy SemVer 규칙
- [WORKFLOW_AUTO.md](../WORKFLOW_AUTO.md) — CI 스타트업 체크리스트
- [CONTRIBUTING.md](../CONTRIBUTING.md) — 기여 가이드
- [SECURITY.md](../SECURITY.md) — 보안 취약점 보고 정책
- [README.md](../README.md) — 프로젝트 소개

**에이전트 페르소나**:
- [IDENTITY.md](../IDENTITY.md) — PRUVIQ Bot 정체
- [SOUL.md](../SOUL.md) — 권한/임무
- [USER.md](../USER.md) — 오너 정보 (제포)
- [HEARTBEAT.md](../HEARTBEAT.md) — (placeholder)
- [MEMORY.md](../MEMORY.md) — 메모리 인덱스 (로컬 `~/.claude/` 메모리 포인터)
- [TOOLS.md](../TOOLS.md) — 개발 도구 inventory

---

## docs/ (현행 리빙 문서)

**제품 전략**:
- [MASTER_PLAN.md](MASTER_PLAN.md) — 전체 문서 허브
- [PRUVIQ_ROADMAP_v1.2.md](PRUVIQ_ROADMAP_v1.2.md) — 현행 로드맵
- [BUSINESS_MODEL.md](BUSINESS_MODEL.md) — 수익 모델
- [SERVICE_PLAN.md](SERVICE_PLAN.md) — 서비스 플랜
- [AFFILIATE_APPLICATION_STRATEGY.md](AFFILIATE_APPLICATION_STRATEGY.md) — 제휴 전략
- [REFERRAL_PROGRAMS_RESEARCH.md](REFERRAL_PROGRAMS_RESEARCH.md) — 레퍼럴 프로그램

**설계/아키텍처**:
- [ARCHITECTURE.md](ARCHITECTURE.md) — 시스템 아키텍처
- [INFRASTRUCTURE.md](INFRASTRUCTURE.md) — 배포 토폴로지
- [OKX_BROKER_ARCHITECTURE.md](OKX_BROKER_ARCHITECTURE.md) — OKX 브로커 통합
- [DESIGN_SPEC_V2.md](DESIGN_SPEC_V2.md) — 디자인 스펙
- [UX_DESIGN.md](UX_DESIGN.md) — UX 설계
- [SIMULATOR_REDESIGN_PLAN_v1.md](SIMULATOR_REDESIGN_PLAN_v1.md) — 시뮬레이터 리디자인 플랜
- [AGENT_GOVERNANCE.md](AGENT_GOVERNANCE.md) — 에이전트 거버넌스
- [MOBILE_TOUCH_TARGETS.md](MOBILE_TOUCH_TARGETS.md) — 모바일 터치 타깃 WCAG

**브랜드**:
- [BRAND_CONCEPT.md](BRAND_CONCEPT.md) — 브랜드 컨셉
- [BRAND_DESIGN.md](BRAND_DESIGN.md) — 디자인 시스템
- [BRAND_VOICE_PRINCIPLES.md](BRAND_VOICE_PRINCIPLES.md) — 카피 원칙

**QA/검증** (영구 레퍼런스):
- [QA_AUTOMATION.md](QA_AUTOMATION.md) — 9-레이어 자동화 아키텍처 ⭐
- [SIMULATION_QA.md](SIMULATION_QA.md) — 시뮬레이터 검증
- [SEO_AUDIT.md](SEO_AUDIT.md) — SEO 감사 룰북
- [QA_SWEEP_FINDINGS_20260422.md](QA_SWEEP_FINDINGS_20260422.md) — 2026-04-22 QA 스윕 결과 (최근)
- [QA_SWEEP_PLAN_20260422.md](QA_SWEEP_PLAN_20260422.md) — 2026-04-22 QA 스윕 플랜

**운영/비밀관리**:
- [BRAVE_API_KEY.md](BRAVE_API_KEY.md) — Brave API 키 프로비저닝

**Runbook**:
- [runbooks/incident-502.md](runbooks/incident-502.md) — 502 장애 대응

**기타**:
- [branches-cleanup-2026-02-21.md](branches-cleanup-2026-02-21.md) — 브랜치 정리 로그 (단발)
- [generated-data.md](generated-data.md) — generated-data 브랜치 규칙

---

## docs/marketing/ (마케팅 자료)

- [ACTION_PLAN.md](marketing/ACTION_PLAN.md)
- [medium-article-draft.md](marketing/medium-article-draft.md)
- [product-hunt-launch.md](marketing/product-hunt-launch.md)
- [reddit-algotrading-post.md](marketing/reddit-algotrading-post.md)

---

## docs/design-references/ (UX 레퍼런스)

- [AS_IS_AUDIT.md](design-references/AS_IS_AUDIT.md)
- [COMPREHENSIVE_UX_AUDIT_20260321.md](design-references/COMPREHENSIVE_UX_AUDIT_20260321.md)
- [DESIGN_REFERENCE_ANALYSIS_20260321.md](design-references/DESIGN_REFERENCE_ANALYSIS_20260321.md)
- [HERO_REDESIGN_ANALYSIS.md](design-references/HERO_REDESIGN_ANALYSIS.md)
- [TO_BE_SPEC.md](design-references/TO_BE_SPEC.md)
- `refs-extra/` — 레퍼런스 스크린샷 PNG

---

## docs/design-audit-20260324/ (단발 감사)

- [DESIGN_AUDIT_20260324.md](design-audit-20260324/DESIGN_AUDIT_20260324.md)

---

## docs/archive/ (시점 스냅샷 — 편집 금지)

[README](archive/README.md) 참조. docs-lint 가드는 이 디렉토리를 제외 처리.

**qa/**:
- [QA_REPORT_20260219.md](archive/qa/QA_REPORT_20260219.md)
- [SIMULATOR_BUGFIX_AUDIT_20260310.md](archive/qa/SIMULATOR_BUGFIX_AUDIT_20260310.md)
- [PRUVIQ_UX_AUDIT_20260312.md](archive/qa/PRUVIQ_UX_AUDIT_20260312.md)
- [PRUVIQ_UX_AUDIT_20260320.md](archive/qa/PRUVIQ_UX_AUDIT_20260320.md)

**audits/**:
- [COMPETITIVE_AUDIT_v0.1.0.md](archive/audits/COMPETITIVE_AUDIT_v0.1.0.md)
- [UNIFIED_AUDIT_v0.1.0.md](archive/audits/UNIFIED_AUDIT_v0.1.0.md)

**roadmap/**:
- [PRUVIQ_ROADMAP_v1.1.md](archive/roadmap/PRUVIQ_ROADMAP_v1.1.md) — v1.2가 현행

**legal/**:
- [LEGAL_RESEARCH.md](archive/legal/LEGAL_RESEARCH.md)

**research/**:
- [PRUVIQ_ENGINE_PARITY_REPORT_20260222.md](archive/research/PRUVIQ_ENGINE_PARITY_REPORT_20260222.md)

---

## .claude/ (Claude 규칙)

- [.claude/CLAUDE.md](../.claude/CLAUDE.md) — 프로젝트 OWNER DIRECTIVES
- [.claude/rules/fastapi-backend.md](../.claude/rules/fastapi-backend.md)
- [.claude/rules/typescript-astro.md](../.claude/rules/typescript-astro.md)

---

## 메모리 (repo 외)

`~/.claude/projects/-Users-jepo-pruviq/memory/` 에 PRUVIQ 전용 메모리. MEMORY.md 인덱스 참조. 세션별 상태 스냅샷 — 점차 `docs/` 영구 레퍼런스로 승격.
