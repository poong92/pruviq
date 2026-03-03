# Runbook: API 5xx (502/503)

증상
- api.pruviq.com/coins/stats 또는 /market이 502/503을 반환한다.

목표
- 빠르게 원인(프론트/백엔드/외부 종속)을 확인하고 사용자 영향 최소화.

1) 증거 수집
- curl -v "https://api.pruviq.com/coins/stats" > /tmp/api-coins-stats-curl.txt
- curl -v "https://api.pruviq.com/market" > /tmp/api-market-curl.txt
- 최근 배포 해시 확인: git log -n 1 --pretty=format:'%h %s'

2) 프로세스 확인 (서버 접근 가능 시)
- ss -lntp | grep 8400
- ps aux | grep pruviq
- curl -s http://127.0.0.1:8400/health

3) 로그 확인
- journalctl -u pruviq-api --since "1 hour ago" --no-pager | tail -n 500 > /tmp/pruviq-api-log.txt
- docker logs <container> --since 1h > /tmp/pruviq-docker-log.txt

4) Sentry / Traces
- Sentry에서 최근 오류 트레이스 찾기(타임스탬프 기준)
- 추출: Trace ID, error message, stacktrace

5) 간이 대응
- 백엔드 점검 후 필요 시 graceful restart (ops 승인 필요): systemctl restart pruviq-api
- 컨테이너 사용시: docker restart <container>

6) 원인 추정 항목
- 내부 worker 실패(통계 생산 실패)
- 외부 API(예: CoinGecko) 호출 실패 → downstream timeout
- 새 배포로 인한 환경변수 변경/의존성 문제

7) 복구 후 확인
- curl -I https://api.pruviq.com/coins/stats → 200 예상
- check data freshness in public/data/coins-stats.json

8) 포스트모템
- 원인 및 교정 조치, 재발 방지(모니터링/재시도 정책) 문서화

