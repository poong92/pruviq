# MEMORY.md

> **파일명 유지** (`.github/workflows/validate-startup-files.yml` 계약). 내용은
> 로컬 메모리 시스템으로 가는 pointer.

PRUVIQ 프로젝트의 세션 간 메모리는 **auto-load** 되는 별도 디렉토리에서
관리됩니다. 이 루트 파일은 역사적 역할만 수행.

## 실제 메모리 위치

- **PRUVIQ 전용 (auto-load)**: `~/.claude/projects/-Users-jepo-pruviq/memory/`
  - 인덱스: `MEMORY.md`
  - 현재 상태: `project_pruviq.md`
  - 최근 세션: `project_qa_automation_20260424.md` · `project_qa_sweep_20260422.md` 등

- **글로벌 user 전용**: `~/.claude/projects/-Users-jepo/memory/`
  - 인덱스: `MEMORY.md`
  - 시스템 아키텍처: `project_jepo_system.md`
  - 작업 스타일: `user_jaepung.md`
  - 피드백 룰: `feedback_*.md`

## 이전 역할 (historical)

2026-02~03에는 이 파일이 일별 세션 로그로 사용됨. 2026-04 PR #1358 에서
잘못된 유저 경로 (구 namespace) 수정 + pointer 역할로 전환.

## 참고 문서

- `docs/DOC_INDEX.md` — 전체 문서 TOC
- `docs/QA_AUTOMATION.md` — 9-레이어 QA 자동화 아키텍처
- `AGENTS.md` — 세션 초기화 가이드
