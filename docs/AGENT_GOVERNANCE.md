# Agent Governance (PRUVIQ)

목적: 에이전트가 안전하고 일관되게 동작하도록 하는 거버넌스 규칙

1) 역할과 범위
- 모든 에이전트는 skills/<agent-name>/SKILL.md 또는 skills/<agent-name>.md에 역할을 정의한다.
- 역할 변경은 PR로 관리하고 CODEOWNERS 승인 필요.

2) 안전 제약
- 에이전트는 절대 파괴적(운영 재시작, DB 변경, 시크릿 회전 등)인 작업을 직접 실행하지 않는다.
- 파괴적 작업이 필요하면 명확한 이슈/PR + JEPO(오너) 승인 레이블 필요 (예: needs-ops-approval).

3) 증거와 출처
- 에이전트가 제시하는 사실은 항상 원본 증거(파일 경로, 명령 출력, URL)와 함께 제공되어야 한다.
- 임의의 추측은 금지한다 (No Hallucination Policy).

4) 감사 및 로그
- 모든 에이전트 실행은 transcripts/ 또는 reports/ 디렉토리에 기록되어야 한다.
- MEMORY.md에 중요한 변경/결정은 append로 기록.

5) CI/PR 정책
- PR은 CI(빌드 + E2E + a11y + security)를 통과해야 병합 가능.
- 자동 PR 생성은 허용하되 병합은 사람 승인.

6) 주기적 검토
- 주간 에이전트 성능 리포트(성공률, 인간개입률, 평균 소요시간)를 작성하고 분기별로 거버넌스 리뷰를 실시.

