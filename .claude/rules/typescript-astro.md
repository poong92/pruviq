# TypeScript/Astro Code Standards

## i18n
- 모든 사용자 대면 텍스트는 `t.key` 사용, 하드코딩 문자열 금지
- 새 텍스트 추가 시 `en.json` + `ko.json` 동시 업데이트

## 접근성 (a11y)
- 인터랙티브 요소: 적절한 ARIA 속성 필수 (`aria-label`, `role` 등)
- 에러 표시: `role="alert" aria-live="assertive"` 필수
- 터치 타겟: 최소 44px x 44px
- 키보드 내비게이션 지원 필수

## 타입 안전성
- `any` 사용 금지 → 구체적 타입 또는 `unknown` + 타입 가드
- 모든 컴포넌트 props에 `interface` 정의
- API 응답에 타입 정의 필수

## 성능
- 이미지: `loading="lazy"` 기본 적용
- 컴포넌트: Astro islands architecture 준수 (`client:load`, `client:visible` 등)
- 번들 크기 의식: 불필요한 클라이언트 JS 최소화

## 스타일
- Tailwind 클래스 사용, 인라인 스타일 지양
- 반응형: mobile-first 접근

## 빌드
- PR 전 `npm run build` 성공 확인 필수
- TypeScript 에러 0건 유지
