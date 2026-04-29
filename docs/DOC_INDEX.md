# Documentation Index

전체 문서 TOC. 새 .md 추가 시 이 인덱스에 반드시 등록 (`docs-lint.yml` Guard 5
가 docs/ 의 .md 파일 basename 이 이 파일에 등장하는지 검사 — 누락 시 PR fail).

---

## 루트 (`/Users/jepo/pruviq/*.md`)

**정책/프로토콜**:
- [AGENTS.md](../AGENTS.md) — 에이전트 세션 초기화 가이드
- [AUTONOMY.md](../AUTONOMY.md) — 자동화 정책, PR 플로우
- [VERSIONING.md](../VERSIONING.md) — Platform vs Strategy SemVer
- [WORKFLOW_AUTO.md](../WORKFLOW_AUTO.md) — CI 스타트업 체크리스트
- [CONTRIBUTING.md](../CONTRIBUTING.md) — 기여 가이드
- [SECURITY.md](../SECURITY.md) — 보안 정책
- [README.md](../README.md) — 프로젝트 소개

**에이전트 페르소나**:
- [IDENTITY.md](../IDENTITY.md) — PRUVIQ Bot 정체
- [SOUL.md](../SOUL.md) — 권한/임무
- [USER.md](../USER.md) — 오너 정보
- [HEARTBEAT.md](../HEARTBEAT.md) — placeholder
- [MEMORY.md](../MEMORY.md) — 로컬 메모리 시스템 pointer
- [TOOLS.md](../TOOLS.md) — 개발 도구 inventory

---

## docs/ (현행 리빙 문서)

**제품 전략**:
- [MASTER_PLAN.md](MASTER_PLAN.md)
- [PRUVIQ_ROADMAP_v1.2.md](PRUVIQ_ROADMAP_v1.2.md)
- [BUSINESS_MODEL.md](BUSINESS_MODEL.md)
- [SERVICE_PLAN.md](SERVICE_PLAN.md)
- [AFFILIATE_APPLICATION_STRATEGY.md](AFFILIATE_APPLICATION_STRATEGY.md)
- [REFERRAL_PROGRAMS_RESEARCH.md](REFERRAL_PROGRAMS_RESEARCH.md)

**설계/아키텍처**:
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [INFRASTRUCTURE.md](INFRASTRUCTURE.md)
- [OKX_BROKER_ARCHITECTURE.md](OKX_BROKER_ARCHITECTURE.md)
- [DESIGN_SPEC_V2.md](DESIGN_SPEC_V2.md)
- [UX_DESIGN.md](UX_DESIGN.md)
- [SIMULATOR_REDESIGN_PLAN_v1.md](SIMULATOR_REDESIGN_PLAN_v1.md)
- [AGENT_GOVERNANCE.md](AGENT_GOVERNANCE.md)
- [MOBILE_TOUCH_TARGETS.md](MOBILE_TOUCH_TARGETS.md)

**브랜드**:
- [BRAND_CONCEPT.md](BRAND_CONCEPT.md)
- [BRAND_DESIGN.md](BRAND_DESIGN.md)
- [BRAND_VOICE_PRINCIPLES.md](BRAND_VOICE_PRINCIPLES.md)

**QA/검증**:
- [QA_AUTOMATION.md](QA_AUTOMATION.md) — 9-레이어 자동화 ⭐
- [SIMULATION_QA.md](SIMULATION_QA.md)
- [SEO_AUDIT.md](SEO_AUDIT.md)
- [QA_SWEEP_FINDINGS_20260422.md](QA_SWEEP_FINDINGS_20260422.md)
- [QA_SWEEP_PLAN_20260422.md](QA_SWEEP_PLAN_20260422.md)

**운영/비밀**:
- [BRAVE_API_KEY.md](BRAVE_API_KEY.md)

**Runbook**:
- [runbooks/incident-502.md](runbooks/incident-502.md)

**기타**:
- [branches-cleanup-2026-02-21.md](branches-cleanup-2026-02-21.md)
- [generated-data.md](generated-data.md)

---

## docs/marketing/

- [ACTION_PLAN.md](marketing/ACTION_PLAN.md)
- [medium-article-draft.md](marketing/medium-article-draft.md)
- [product-hunt-launch.md](marketing/product-hunt-launch.md)
- [reddit-algotrading-post.md](marketing/reddit-algotrading-post.md)
- [show-hn-post.md](marketing/show-hn-post.md)

---

## docs/design-references/

- [AS_IS_AUDIT.md](design-references/AS_IS_AUDIT.md)
- [COMPREHENSIVE_UX_AUDIT_20260321.md](design-references/COMPREHENSIVE_UX_AUDIT_20260321.md)
- [DESIGN_REFERENCE_ANALYSIS_20260321.md](design-references/DESIGN_REFERENCE_ANALYSIS_20260321.md)
- [HERO_REDESIGN_ANALYSIS.md](design-references/HERO_REDESIGN_ANALYSIS.md)
- [TO_BE_SPEC.md](design-references/TO_BE_SPEC.md)

---

## docs/design-audit-20260324/

- [DESIGN_AUDIT_20260324.md](design-audit-20260324/DESIGN_AUDIT_20260324.md)

---

## docs/seo/

- [issue-9-seo-action-plan.md](seo/issue-9-seo-action-plan.md)

---

## docs/internal/ (내부 작업 초안)

- [okx-support-email-draft.md](internal/okx-support-email-draft.md) — OKX OAuth Silent Drop 보고용 이메일 초안

---

## docs/archive/ (시점 스냅샷 — 편집 금지)

[README](archive/README.md) 참조. docs-lint 가드는 archive/ 제외.

**qa/**:
- [QA_REPORT_20260219.md](archive/qa/QA_REPORT_20260219.md)
- [SIMULATOR_BUGFIX_AUDIT_20260310.md](archive/qa/SIMULATOR_BUGFIX_AUDIT_20260310.md)
- [PRUVIQ_UX_AUDIT_20260312.md](archive/qa/PRUVIQ_UX_AUDIT_20260312.md)
- [PRUVIQ_UX_AUDIT_20260320.md](archive/qa/PRUVIQ_UX_AUDIT_20260320.md)

**audits/**:
- [COMPETITIVE_AUDIT_v0.1.0.md](archive/audits/COMPETITIVE_AUDIT_v0.1.0.md)
- [UNIFIED_AUDIT_v0.1.0.md](archive/audits/UNIFIED_AUDIT_v0.1.0.md)

**roadmap/**:
- [PRUVIQ_ROADMAP_v1.1.md](archive/roadmap/PRUVIQ_ROADMAP_v1.1.md)

**legal/**:
- [LEGAL_RESEARCH.md](archive/legal/LEGAL_RESEARCH.md)

**research/**:
- [PRUVIQ_ENGINE_PARITY_REPORT_20260222.md](archive/research/PRUVIQ_ENGINE_PARITY_REPORT_20260222.md)

---

## .claude/ (Claude 프로젝트 규칙)

- [.claude/CLAUDE.md](../.claude/CLAUDE.md)
- [.claude/rules/fastapi-backend.md](../.claude/rules/fastapi-backend.md)
- [.claude/rules/typescript-astro.md](../.claude/rules/typescript-astro.md)

---

## 메모리 (repo 외)

- `~/.claude/projects/-Users-jepo-pruviq/memory/`
- `~/.claude/projects/-Users-jepo/memory/`
