<!-- PR 템플릿: What / Why / Result / Next 형식 - 이 템플릿을 채워주세요 -->

## What
- 간결히 무엇을 변경했는지 적어주세요.

## Why
- 이 변경이 왜 필요한지, 어떤 문제를 해결하는지 설명해주세요.

## Result
- 변경 결과(빌드 통과 여부, 테스트 결과, 스모크 체크, 관련 아티팩트 링크 등)를 적어주세요.

## Next
- 다음 단계(리뷰, 배포, 모니터링 등)을 적어주세요.

---

### Check list (필수)
- [ ] `npm run build` locally passes (또는 CI에서 통과 확인)
- [ ] PR 본문에 What / Why / Result / Next가 기재되어 있음
- [ ] 변경이 backend/ 또는 READ ONLY 영역을 건드리지 않음(건드리면 JEPO 승인 필요)

### Automerge
- 라벨 `automerge`를 붙이면 Agents가 자동으로 병합을 시도할 수 있습니다 (자동 병합은 AUTONOMY.md의 조건들을 만족해야만 작동합니다).
