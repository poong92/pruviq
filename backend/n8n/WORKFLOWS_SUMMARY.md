# n8n Workflows Summary — JEPO System

3개 워크플로우 개요 (설정/배포 1시간, 운영 무인화)

---

## 1️⃣ telegram-error-handler.json

**트리거**: Telegram webhook (PRUVIQ Alert 봇)

**흐름**:
```
메시지 수신 → 에러 분류 → 중복 확인 → 자동복구 분기
  ├── LaunchAgent 크래시 → SSH bootout/bootstrap → 상태 보고
  ├── n8n 타임아웃 → n8n API 재시도 → 상태 보고
  ├── 로그 과부하 → SSH logrotate → 상태 보고
  └── 복구 불가 → 이재풍에게 에스컬레이션
→ Mem0 저장 (패턴 학습)
```

**필수 환경변수**:
```
TELEGRAM_BOT_TOKEN      # PRUVIQ Alert 봇 토큰
TELEGRAM_CHAT_ID        # 에러 수신 채팅 ID
N8N_API_KEY             # n8n 재시도용
```

**SSH 명령어** (DO 서버):
- `launchctl bootout/bootstrap` (서비스 재시작)
- `logrotate -f` (로그 로테이션)

**테스트**:
```bash
curl -X POST http://localhost:5678/webhook/telegram-error-handler \
  -H "Content-Type: application/json" \
  -d '{"message": {"text": "🚨 LaunchAgent crashed"}}'
```

**데이터 흐름 검증**:
- Parse Message: `errorType` (7가지), `severity` (low/medium/high/critical)
- Route Error: Switch 4가지 경로 분기 가능
- Recovery Status: 각 경로 실행 후 성공/실패 반환

**주의사항**:
- ❌ 동일 에러 1시간 내 3회 이상 → 자동처리 중단, 수동 에스컬레이션 전환 (현재 placeholder, Mem0 연동 필요)
- SSH timeout 설정: 10초 (응답 없으면 continueOnFail)

---

## 2️⃣ oos-validation-pipeline.json

**트리거**: 매주 일요일 09:00 UTC

**흐름**:
```
스케줄 시작
  → OOS 경과일 계산 (2026-03-09 기준)
  ├─ <90일: "진행중 X/90일" 알림 → 종료
  └─ >=90일:
      → PRUVIQ API 조회 (/simulate, 90일)
      → 8개 기준 검증:
         ✓ Profit Factor > 1.5
         ✓ Win Rate > 45%
         ✓ Max Drawdown < 15%
         ✓ Total Trades > 150
         ✓ Sharpe Ratio > 1.0
         ✓ Max Consecutive Losses < 8
         ✓ Monthly PnL 양수 (3/3)
         ✓ OOS >= 90일
      → 결과 분기:
         8/8 ✅ → "재개 준비 완료" (Green)
         6-7/8 🟡 → "X/8 충족, 미달: [목록]" (Yellow)
         <6 ❌ → "전략 수정 필요" (Red)
      → Mem0 저장
```

**필수 환경변수**:
```
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

**PRUVIQ API 호출**:
```bash
POST https://api.pruviq.com/simulate
{
  "strategy": "bb-squeeze",
  "direction": "short",
  "sl_pct": 10,
  "tp_pct": 8,
  "date_range_days": 90
}
```

**테스트**:
```bash
# 현재 OOS 진행도 조회 (테스트)
curl -X POST http://localhost:5678/api/v1/executions/<workflow_id>/test
```

**데이터 흐름 검증**:
- Calculate OOS Days: `daysElapsed`, `daysRemaining`, `percentComplete`
- Fetch PRUVIQ Metrics: 14개 지표 (PF, WR, MDD%, Sharpe, Sortino, Calmar 등)
- Validate OOS Criteria: 8개 기준 각각 boolean met 필드
- Readiness Score: 0-100% (기준 충족도)

**현재 상태** (2026-03-14 기준):
- OOS 경과: 5일 / 90일 (5% 진행중)
- 다음 재개 준비: 2026-06-07 이후 (약 85일)

---

## 3️⃣ health-monitoring-extended.json

**트리거**: 매 30분 자동 실행

**흐름**:
```
30분 간격 시작
  → 3개 엔드포인트 병렬 검사:
    ├── GET https://api.pruviq.com/rankings/daily
    │   └─ Validate: 500+ coins 있는가?
    ├── GET https://api.pruviq.com/health
    │   └─ Validate: status = "ok" or "healthy"?
    └── POST https://api.pruviq.com/simulate
        └─ Validate: 지표 유효한가? (PF, WR, 거래수 > 0)
  → 결과 집계:
    ├─ 3/3 OK → ✅ HEALTHY → Mem0 저장
    └─ <3/3 → ⚠️ UNHEALTHY → Telegram 알림 + Mem0 저장
```

**필수 환경변수**:
```
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

**API 엔드포인트** (모두 public, auth 불필요):
```bash
curl https://api.pruviq.com/rankings/daily | jq '.data | length'
curl https://api.pruviq.com/health | jq '.status'
curl -X POST https://api.pruviq.com/simulate \
  -d '{"strategy":"bb-squeeze","direction":"short","sl_pct":10,"tp_pct":8,"date_range_days":7}'
```

**테스트**:
```bash
# 수동 실행
curl -X POST http://localhost:5678/api/v1/executions/<workflow_id>/test
```

**데이터 흐름 검증**:
- Check Rankings API: `hasData` (bool), `dataCount` (N), `dataValid` (count >= 500)
- Check Health: `status` (ok/degraded), `uptime` (hours), `healthStatus`
- Check Simulator: `status` (ok/failed), 지표들 (PF, WR, Sharpe)
- Aggregate Results: `overallStatus` (HEALTHY/UNHEALTHY), `failedChecks` (list), `severity` (green/yellow/red)

**실패 시 알림** 예시:
```
⚠️ Health Check Alert
Status: UNHEALTHY
Severity: RED
Failed Checks (2/3): Rankings API: no data, Simulator: invalid metrics
```

---

## ⚙️ 설정 체크리스트

- [ ] n8n 실행 중 (localhost:5678)
- [ ] 환경변수 설정 (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `N8N_API_KEY`)
- [ ] 3개 JSON 파일 import
- [ ] SSH 연결 테스트: `ssh -p 2222 root@167.172.81.145 'uptime'`
- [ ] PRUVIQ API 테스트: `curl https://api.pruviq.com/health`
- [ ] 각 워크플로우 수동 테스트 (Execute Workflow)
- [ ] Telegram 알림 수신 확인
- [ ] Workflows 토글 ON (활성화)

---

## 🔍 모니터링 주기

| 작업 | 빈도 | 담당 | 체크사항 |
|------|------|------|---------|
| telegram-error-handler | 즉각 | 자동 | SSH 명령 성공 여부 + 알림 발송 |
| oos-validation-pipeline | 주 1회 (일) | 자동 | 진행도 업데이트 + 기준 변경 모니터링 |
| health-monitoring-extended | 30분마다 | 자동 | 실패 패턴 누적 + Mem0 분석 |
| n8n 실행 로그 | 주 1회 | 수동 | 에러율 및 타임아웃 검토 |

---

## 📊 성능 기대값

| 메트릭 | telegram-error-handler | oos-validation | health-monitoring |
|--------|----------------------|-----------------|-------------------|
| 실행 시간 | 3-8초 (SSH 포함) | 5-15초 | 2-5초 |
| 타임아웃 설정 | 10초 (SSH) | 30초 (PRUVIQ) | 15초 (각 endpoint) |
| 에러율 목표 | <1% (SSH 포함) | <5% | <2% |
| Mem0 저장 | 매실행 | 매실행 | 매실행 |

---

## 🛠️ 자동복구 보장 범위

✅ **자동 처리 가능**:
- LaunchAgent 크래시 (restart via launchctl)
- n8n 타임아웃 (API 재시도 or 수동 보정)
- 로그 과부하 (logrotate 강제 실행)

⚠️ **부분 자동**:
- API 503/504 (HTTP timeout, 재시도는 수동)
- 디스크 부족 (로그 로테이션 만으로 부족 시 수동)

❌ **수동 개입 필수**:
- 데이터베이스 연결 실패
- Cloudflare 차단
- DO 서버 SSH 키 문제
- OOM (Out of Memory) 에러

---

## 📝 파일 위치

```
/Users/jepo/pruviq/backend/n8n/
├── telegram-error-handler.json          # 에러 자동처리
├── oos-validation-pipeline.json         # OOS 주간 검증
├── health-monitoring-extended.json      # 헬스 30분마다
├── SETUP_GUIDE.md                       # 상세 설정 가이드 ← 읽어야 할 파일
├── WORKFLOWS_SUMMARY.md                 # 이 파일 (빠른 참고)
├── README.md                            # 기존 n8n 소개
├── daily-report-workflow.json           # 기존 (수정 안함)
├── data-sync-workflow.json              # 기존 (수정 안함)
├── monitoring-workflow.json             # 기존 (수정 안함)
└── weekly-review-workflow.json          # 기존 (수정 안함)
```

---

## 🚀 시작하기

### 1. 환경 준비 (5분)
```bash
# 1. n8n 실행 확인
curl http://localhost:5678

# 2. 환경변수 설정
echo "TELEGRAM_BOT_TOKEN=$(grep TELEGRAM_BOT_TOKEN ~/.env | cut -d= -f2)"
echo "TELEGRAM_CHAT_ID=$(grep TELEGRAM_CHAT_ID ~/.env | cut -d= -f2)"

# 3. SSH 테스트
ssh -p 2222 root@167.172.81.145 'uptime'

# 4. PRUVIQ API 테스트
curl https://api.pruviq.com/health
```

### 2. 워크플로우 Import (10분)
- n8n UI 열기: http://localhost:5678
- "Workflows" → "Import from file"
- 3개 JSON 파일 순서대로 import

### 3. 수동 테스트 (15분)
- 각 워크플로우 클릭 → "Execute Workflow"
- 로그 확인: "Execute" 탭
- Telegram 알림 수신 확인

### 4. 활성화 (5분)
- 각 workflow 토글 ON
- 스케줄 확인 (특히 cron expression)

**총 소요: ~35분**

---

**v0.1.0** | 2026-03-14 | Ready for deployment
