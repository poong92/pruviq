# SKILL.md Schema (PRUVIQ)

이 파일은 PRUVIQ 에이전트(SKILL.md) 템플릿의 최소 필수 항목과 권장 필드를 정의합니다.
모든 에이전트는 이 스키마를 따르고, CI에서 자동으로 검증됩니다.

필수 필드 (문서 내 반드시 포함)
- name: 에이전트 식별자 (예: frontend-dev)
- description: 1-2문장 요약 — 에이전트의 목적
- responsibilities: 행동 범위(목록)
- when_to_use: 트리거/사용 시점(목록)
- outputs: 기대 산출물 (예: PR, report, artifact paths)
- constraints: 안전 제약(금지된 행동 예: DB 변경 등)
- no_hallucination: "Yes" 와 함께 짧은 설명 — 사실 확인 요구 방식
- language: 보고 시 사용 언어(ko/en)

권장 필드
- tools: 사용 도구 목록 (playwright, curl, gh 등)
- example_commands: 자주 사용하는 명령이나 스크립트 샘플
- contacts: 사람/팀 연락처(예: ops-sre 팀, JEPO)

검증 규칙(간단)
- 모든 필수 필드가 존재해야 함
- no_hallucination 항목은 반드시 포함되어야 함
- language 필드가 없으면 ko로 설정 권장

CI 연동: .github/workflows/validate-skill.yml이 SKILL.md 파일들을 검사합니다.

Notes
- 이 스키마는 에이전트 행동의 일관성과 감사 가능성을 보장하기 위해 도입합니다.
- 스키마 변경은 CODEOWNERS의 승인이 필요합니다.
