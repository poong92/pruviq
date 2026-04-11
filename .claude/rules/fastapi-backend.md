# FastAPI Backend Code Standards

## Pydantic 모델
- 모든 API 입출력에 `BaseModel` 사용
- 필드명은 프론트엔드와 100% 일치 (1글자 차이도 silent fail 유발)
- 캐시 저장 시 반드시 `.model_dump()` 후 저장 (Pydantic 객체 직접 캐싱 금지)

## 에러 핸들링
- `HTTPException`에 구체적 `detail` 메시지 포함
- bare 500 응답 금지 → 원인 식별 가능한 메시지 반환
- `Header(alias="...")` 사용 시 `default=""` 설정 (없으면 422 반환)

## 수학 계산
- Sharpe: `mean(returns) / std(returns) * sqrt(period)` — 기간 정규화 필수
- Sortino TDD: `sqrt(mean(min(returns, 0)^2))` — 전체 N으로 나눔 (N_down 아님)
- MDD: `(peak - equity) / peak * 100` — peak 대비 % 표시
- PF 무손실: `999.99` 반환 (0.001 사용 금지)

## 응답 크기
- 단일 응답 1MB 초과 금지
- equity curve 등 대용량 데이터는 downsample 후 반환

## 외부 API 연동 로깅 (CRITICAL — 디버깅 필수)

외부 API 호출 코드 작성 시 처음부터 요청/응답 로그 필수:
```python
logger.warning("→ %s %s body=%s", method, url, {k: v for k, v in data.items() if "secret" not in k})
resp = await client.post(url, data=data)
logger.warning("← status=%s body=%s", resp.status_code, resp.text[:500])
```
- 요청/응답 둘 다 `WARNING` 레벨 (INFO는 기본 필터링됨)
- secret 키는 로그에서 제외
- 근거: 로그 없으면 외부 API 오류 시 추측→수정→재테스트 무한루프 (OKX OAuth 53010 사건 2026-04-11)

## Rate Limit
- 무거운 엔드포인트 (`/simulate`, `/backtest`)에 rate limit 적용
- DoS 방지: IP 기반 제한 권장

## 캐시
- LRU 캐시 사용 시 최대 크기 설정 (기본 500)
- 캐시 키에 모든 파라미터 반영 (부분 키 = 오답 반환)
