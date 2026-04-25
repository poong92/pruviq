# PRUVIQ Infrastructure Architecture

> 작성일: 2026-02-15
> 작성자: 인프라 아키텍트 (Claude)
> 대상: 이재풍 전체 시스템 (autotrader + PRUVIQ)
> 버전: v0.1.0

---

## 1. 전체 시스템 토폴로지

```
                        ┌──────────────────────────────────────────┐
                        │              GitHub (pruviq)             │
                        │  ┌──────────────┐  ┌──────────────────┐  │
                        │  │  autotrader   │  │     pruviq       │  │
                        │  │  (private)    │  │    (private)     │  │
                        │  └──────┬───────┘  └────────┬─────────┘  │
                        └─────────┼───────────────────┼────────────┘
                                  │                   │
             ┌────────────────────┼───────────────────┼────────────────────┐
             │                    │     Tailscale VPN  │                    │
             │                    │    (100.x.x.x)     │                    │
             │    ┌───────────────┴───────────┐        │                   │
             │    │                           │        │                   │
    ┌────────▼────▼──────┐    ┌───────────────▼────────▼──────────┐       │
    │   MacBook Pro       │    │         Mac Mini                   │       │
    │   (jplee)           │    │         (jepo)                     │       │
    │                     │    │                                    │       │
    │  ~/Desktop/         │    │  ~/autotrader-backup/              │       │
    │   ├── autotrader/   │    │   └── (서버 데이터 백업)           │       │
    │   └── pruviq/       │    │                                    │       │
    │                     │    │  ~/pruviq/                         │       │
    │  역할:              │    │   ├── data/ (OHLCV 수집)          │       │
    │   - 개발            │    │   ├── logs/ (서비스 로그)          │       │
    │   - 테스트          │    │   └── (시뮬/컨텍스트 엔진)        │       │
    │   - git push        │    │                                    │       │
    │                     │    │  서비스:                           │       │
    │  Python venvs:      │    │   - n8n       :5678               │       │
    │   - .venv-at/       │    │   - Ollama    :11434              │       │
    │   - .venv-pv/       │    │   (PRUVIQ API는 DO :8080 — Mac Mini 호스팅 안 함)│       │ <!-- docs-lint-allow: 명시적 부정문 — Mac Mini가 호스팅 안 한다는 사실을 다이어그램에 못 박는 것이 의도 -->
    │                     │    │                                    │       │
    └──────────┬──────────┘    └────────────────────────────────────┘       │
               │                                                           │
               │    ┌──────────────────────────────────────┐               │
               │    │   DigitalOcean VPS                    │               │
               └────▶   167.172.81.145                      │               │
                    │                                      │               │
                    │   /opt/autotrader/                    │               │
                    │    └── Docker: autotrader_bot         │               │
                    │                                      │               │
                    │   역할:                              │               │
                    │    - autotrader v1.7.0 실거래 전용    │               │
                    │    - PRUVIQ 관련 아무것도 없음        │               │
                    │                                      │               │
                    └──────────────────────────────────────┘               │
                                                                           │
             └─────────────────────────────────────────────────────────────┘


    ┌──────────────────────────────────────────────────────────────┐
    │                      외부 서비스                              │
    │                                                              │
    │   Binance API ──────── autotrader (DO서버에서 직접 호출)     │
    │   Binance API ──────── PRUVIQ (Mac Mini에서 공개 데이터)     │
    │   Telegram Bot ─────── autotrader 알림                       │
    │   Telegram Bot ─────── PRUVIQ 모니터링 (선택)               │
    │   Mem0 Cloud ──────── Claude Code (MacBook/Mac Mini)         │
    │   Tailscale ─────────  MacBook <-> Mac Mini VPN              │
    └──────────────────────────────────────────────────────────────┘
```

### 데이터 흐름 요약

```
[autotrader 데이터 흐름]
  Binance API → DO서버 (실거래) → Mac Mini (백업) → MacBook (분석)

[PRUVIQ 데이터 흐름]
  Binance 공개 API → Mac Mini (수집/저장) → Mac Mini (시뮬레이션) → 웹 API
  뉴스/이벤트 API → Mac Mini (n8n 수집) → Mac Mini (Ollama 요약) → 웹 API

[배포 흐름]
  MacBook (개발) → GitHub → DO서버 (autotrader)
  MacBook (개발) → GitHub → Mac Mini (PRUVIQ)
```

---

## 2. 디바이스별 역할과 설정

### 2.1 MacBook Pro (jplee) -- 개발 전용

| 항목 | 설정 |
|------|------|
| 사용자 | jplee |
| OS | macOS Darwin 25.2.0 |
| 역할 | 개발, 테스트, git 관리, Claude Code 사용 |
| 네트워크 | Tailscale (100.x.x.x), 가정 Wi-Fi |

#### 디렉토리 레이아웃

```
~/Desktop/
├── autotrader/                  # autotrader 개발
│   ├── .venv-at/                # Python venv (autotrader 전용)
│   ├── src/live/                # 실거래 봇 코드
│   ├── scripts/                 # 분석/백테스트 스크립트
│   ├── data/                    # 로컬 데이터 + 서버 백업
│   └── .env                     # autotrader 환경변수 (git 미포함)
│
├── pruviq/                      # PRUVIQ 개발
│   ├── .venv-pv/                # Python venv (PRUVIQ 전용)
│   ├── src/                     # 소스 코드
│   ├── scripts/                 # 실행 스크립트
│   ├── data/                    # 로컬 테스트 데이터 (git 미포함)
│   ├── docs/                    # 문서
│   └── .env                     # PRUVIQ 환경변수 (git 미포함)
│
└── jepo/                        # JEPO 시스템 설정
```

#### Python 가상환경 분리

```
# autotrader 가상환경
cd ~/Desktop/autotrader
python3 -m venv .venv-at
source .venv-at/bin/activate
pip install -r requirements.txt

# PRUVIQ 가상환경
cd ~/Desktop/pruviq
python3 -m venv .venv-pv
source .venv-pv/bin/activate
pip install -r requirements.txt
```

**규칙**: 각 프로젝트 작업 시 해당 venv만 활성화. 절대 교차 사용하지 않음.

#### MacBook에서 하지 않는 것
- 서비스 상시 실행 (크론, 데몬 등)
- 데이터 수집 자동화
- 프로덕션 서빙

---

### 2.2 Mac Mini (jepo) -- 운영 서버

| 항목 | 설정 |
|------|------|
| 사용자 | **jepo** (jplee 아님 -- 중요!) |
| 역할 | PRUVIQ 운영, autotrader 백업, AI/자동화 |
| 네트워크 | LAN 172.30.1.16, Tailscale 100.93.138.124 |
| 상시 가동 | 24/7, 절전 비활성화 |

#### 디렉토리 레이아웃

```
~/                                    # /Users/jepo/
├── pruviq/                           # PRUVIQ 운영 환경
│   ├── .venv/                        # Python venv
│   ├── src/                          # 소스 (git pull로 동기화)
│   ├── scripts/                      # 실행 스크립트
│   ├── data/                         # 수집된 데이터 (주 저장소)
│   │   ├── spot/                     # 현물 OHLCV (전체 코인)
│   │   ├── futures/                  # 선물 OHLCV (전체 코인)
│   │   └── market_events/            # 뉴스/이벤트 JSON
│   ├── logs/                         # 서비스 로그
│   │   ├── cron/                     # 크론 실행 로그
│   │   ├── n8n/                      # n8n 워크플로우 로그
│   │   └── api/                      # API 서버 로그 (Phase 1+)
│   └── .env                          # PRUVIQ 환경변수
│
├── autotrader-backup/                # autotrader 서버 데이터 백업
│   ├── trades/                       # 거래 JSON
│   ├── logs/                         # 서버 로그
│   └── binance_api/                  # Income API 백업
│
├── .n8n/                             # n8n 데이터 (기존)
└── .ollama/                          # Ollama 모델 (기존)
```

#### 상시 실행 서비스 (LaunchAgents)

| 서비스 | 포트 | plist 파일 | 용도 |
|--------|------|-----------|------|
| n8n | 5678 | com.n8n.server.plist | 자동화 파이프라인 |
| Ollama | 11434 | com.ollama.server.plist | AI 시황 요약 |
| (구 계획) PRUVIQ API on Mac Mini 8400 | — | — | **이행 안 됨**. 실제 PRUVIQ API는 DigitalOcean :8080 (systemd `pruviq-api.service`) — 자세한 건 § 3.3 포트 표 참조 | <!-- docs-lint-allow: 의도적 역사 기록 — "이행 안 됨" 명시 -->

#### Mac Mini에서 하지 않는 것
- autotrader 실거래 봇 실행 (DO 서버 전용)
- autotrader 코드 수정 (MacBook 전용)
- git push (pull only, 배포 수신 전용)

---

### 2.3 DigitalOcean 서버 (167.172.81.145) -- 트레이딩 전용

| 항목 | 설정 |
|------|------|
| 역할 | autotrader v1.7.0 실거래 전용 |
| 접속 | root@167.172.81.145 (SSH) |
| 컨테이너 | autotrader_bot (Docker) |
| 데이터 | /opt/autotrader/ |

#### 이 서버에 존재하는 것
- Docker: autotrader_bot 컨테이너
- /opt/autotrader: git repo (main 브랜치)
- 로그: /opt/autotrader/logs/
- 환경변수: Docker 내부 (.env)

#### 이 서버에 절대 올리지 않는 것
- PRUVIQ 관련 코드, 데이터, 설정
- n8n, Ollama, 기타 서비스
- 추가 Docker 컨테이너

---

## 3. 네트워크 구성

### 3.1 네트워크 다이어그램

```
                    ┌─────────────┐
                    │  Internet   │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐    ┌────▼────┐     ┌─────▼──────┐
    │ MacBook   │    │Mac Mini │     │ DO 서버    │
    │ Wi-Fi     │    │ LAN     │     │ Public IP  │
    └─────┬─────┘    └────┬────┘     │167.172.    │
          │               │          │  81.145    │
          │  Tailscale    │          └────────────┘
          │  Mesh VPN     │
          ├───────────────┤
          │               │
    100.x.x.x       100.93.138.124
    (MacBook)        (Mac Mini)
```

### 3.2 접속 경로 정리

| From | To | 방법 | 명령 |
|------|----|------|------|
| MacBook | Mac Mini (LAN) | SSH | `ssh jepo@172.30.1.16` |
| MacBook | Mac Mini (원격) | Tailscale SSH | `ssh jepo@100.93.138.124` |
| MacBook | DO 서버 | SSH | `ssh root@167.172.81.145` |
| Mac Mini | DO 서버 | SSH | `ssh root@167.172.81.145` |
| MacBook | n8n UI | 브라우저 | `http://100.93.138.124:5678` |
| MacBook | PRUVIQ API | HTTP | `https://api.pruviq.com/health` (DO via Cloudflare Tunnel) |

### 3.3 포트 할당표

| 포트 | 디바이스 | 서비스 | 바인딩 | 비고 |
|------|---------|--------|--------|------|
| 5678 | Mac Mini | n8n | 127.0.0.1 + Tailscale | 외부 노출 금지 |
| 8080 | DigitalOcean | PRUVIQ API (FastAPI) | systemd `pruviq-api.service` | api.pruviq.com via Cloudflare Tunnel |
| 11434 | Mac Mini | Ollama | 127.0.0.1 + Tailscale | 내부 전용 |
| - | DO 서버 | autotrader Docker | 내부 전용 | 외부 포트 없음 |

### 3.4 Tailscale ACL 권장 설정

```
Mac Mini 접근 허용:
  - MacBook → Mac Mini: 모든 포트 허용
  - Mac Mini → DO 서버: SSH(22)만 허용
  - 외부 → Mac Mini: 차단 (Tailscale ACL)
```

---

## 4. 배포 파이프라인

### 4.1 autotrader 배포 (MacBook -> DO 서버)

```
┌─────────┐     git push     ┌─────────┐     git pull     ┌───────────┐
│ MacBook │ ───────────────► │ GitHub  │ ◄─────────────── │ DO 서버   │
│ 개발    │                  │ main    │    (수동 or 훅)  │ Docker    │
└─────────┘                  └─────────┘                  └───────────┘

배포 절차 (수동):
  1. MacBook: 코드 변경 + 테스트 + git push
  2. DO 서버: SSH 접속
  3. cd /opt/autotrader && git pull
  4. docker-compose down && docker-compose build --no-cache && docker-compose up -d
  5. docker-compose logs --tail=30 으로 확인
  6. 텔레그램 heartbeat 확인 (2시간 이내)

롤백:
  git log --oneline -5
  git checkout <이전커밋>
  docker-compose down && docker-compose build --no-cache && docker-compose up -d
```

### 4.2 PRUVIQ 배포 (MacBook -> Mac Mini)

```
┌─────────┐     git push     ┌─────────┐     git pull     ┌───────────┐
│ MacBook │ ───────────────► │ GitHub  │ ◄─────────────── │ Mac Mini  │
│ 개발    │                  │ main    │    (크론 or 수동) │ 운영      │
└─────────┘                  └─────────┘                  └───────────┘

배포 절차 (수동):
  1. MacBook: 코드 변경 + 테스트 + git push
  2. Mac Mini: SSH 접속 (ssh jepo@100.93.138.124)
  3. cd ~/pruviq && git pull
  4. source .venv/bin/activate && pip install -r requirements.txt
  5. 크론 작업은 자동 반영 (스크립트 경로 불변)
  6. API 서버가 있다면: launchctl kickstart -k gui/$(id -u)/com.pruviq.api

자동 배포 (Phase 1+ 선택):
  - Mac Mini 크론: 매시 git pull + 변경 감지 시 재시작
  - 또는 GitHub Webhook → n8n → 배포 스크립트
```

### 4.3 배포 격리 원칙

```
┌────────────────────────────────────────────────────────┐
│  절대 규칙:                                            │
│                                                        │
│  1. autotrader 배포는 DO 서버에만                       │
│  2. PRUVIQ 배포는 Mac Mini에만                         │
│  3. 두 프로젝트의 배포 스크립트는 교차하지 않음        │
│  4. .env 파일은 각 디바이스에서 직접 관리 (git 미포함) │
│  5. DO 서버에 PRUVIQ 흔적 0                            │
└────────────────────────────────────────────────────────┘
```

---

## 5. 크론/자동화 스케줄

### 5.1 Mac Mini 크론 스케줄 (crontab -e for jepo)

```crontab
# ═══════════════════════════════════════════════════════
#  Mac Mini (jepo) 크론 스케줄
#  마지막 수정: 2026-02-15
# ═══════════════════════════════════════════════════════

# ── autotrader 백업 (기존, 유지) ──────────────────────
# 매일 UTC 00:00 (KST 09:00) 서버 데이터 백업
0 0 * * *  /Users/jepo/autotrader-backup/scripts/backup_server_data.sh >> /Users/jepo/autotrader-backup/logs/cron_backup.log 2>&1

# ── PRUVIQ 데이터 수집 ───────────────────────────────
# 매시 5분: 현물 OHLCV 업데이트 (전체 코인, 1H 캔들)
5 * * * *  cd /Users/jepo/pruviq && .venv/bin/python scripts/collect_spot.py >> logs/cron/collect_spot.log 2>&1

# 매시 15분: 선물 OHLCV 업데이트 (전체 코인, 1H 캔들)
15 * * * *  cd /Users/jepo/pruviq && .venv/bin/python scripts/collect_futures.py >> logs/cron/collect_futures.log 2>&1

# 매 4시간: 시장 이벤트/뉴스 수집 (n8n 워크플로우 트리거)
0 */4 * * *  curl -s http://127.0.0.1:5678/webhook/collect-market-events >> logs/cron/market_events.log 2>&1

# ── PRUVIQ 배치 처리 ─────────────────────────────────
# 매일 UTC 01:00 (KST 10:00): 전략 시뮬레이션 배치 실행
0 1 * * *  cd /Users/jepo/pruviq && .venv/bin/python scripts/run_daily_simulation.py >> logs/cron/simulation.log 2>&1

# 매일 UTC 02:00 (KST 11:00): AI 시황 요약 생성 (Ollama)
0 2 * * *  cd /Users/jepo/pruviq && .venv/bin/python scripts/generate_market_summary.py >> logs/cron/market_summary.log 2>&1

# ── 유지보수 ─────────────────────────────────────────
# 매주 일요일 UTC 03:00: 로그 로테이션 (30일 이상 삭제)
0 3 * * 0  find /Users/jepo/pruviq/logs -name "*.log" -mtime +30 -delete
0 3 * * 0  find /Users/jepo/autotrader-backup/logs -name "*.log" -mtime +30 -delete

# 매일 UTC 00:30: 디스크 사용량 체크
30 0 * * *  /Users/jepo/pruviq/scripts/check_disk_usage.sh >> logs/cron/disk_check.log 2>&1

# 매주 월요일 UTC 04:00: PRUVIQ 코드 자동 업데이트 (git pull)
0 4 * * 1  cd /Users/jepo/pruviq && git pull >> logs/cron/git_pull.log 2>&1
```

### 5.2 n8n 워크플로우 (Mac Mini :5678)

| 워크플로우 | 트리거 | 동작 | Phase |
|-----------|--------|------|-------|
| collect-market-events | 크론 + Webhook | 뉴스 API 호출 -> JSON 저장 | Phase 0 |
| summarize-market | 스케줄 (매일) | 뉴스 JSON -> Ollama 요약 -> 결과 저장 | Phase 1 |
| alert-disk-full | 이벤트 | 디스크 80%+ -> Telegram 알림 | Phase 0 |
| alert-cron-failure | 이벤트 | 크론 실패 감지 -> Telegram 알림 | Phase 0 |
| deploy-pruviq | Webhook (GitHub) | git pull -> 서비스 재시작 | Phase 1+ |

### 5.3 타임라인 (UTC 기준, 24시간)

```
UTC  Mac Mini 작업
──── ─────────────────────────────────
00:00  autotrader 서버 백업
00:30  디스크 사용량 체크
01:00  PRUVIQ 전략 시뮬레이션 배치
02:00  AI 시황 요약 (Ollama)
03:00  (일) 로그 로테이션
04:00  (월) PRUVIQ git pull
 :05   ┐
 :15   ├ 매시 OHLCV 수집 (spot + futures)
       ┘
*/4h   시장 이벤트/뉴스 수집 (n8n)
```

---

## 6. 보안 체크리스트

### 6.1 SSH 키 관리

| 키 쌍 | 위치 | 용도 | 비고 |
|--------|------|------|------|
| MacBook -> DO 서버 | ~/.ssh/id_ed25519 | autotrader 배포 | 기존 |
| MacBook -> Mac Mini | ~/.ssh/id_ed25519 | PRUVIQ 개발/관리 | Tailscale |
| Mac Mini -> DO 서버 | ~/.ssh/id_ed25519 | autotrader 백업 | 기존 등록 완료 |
| Mac Mini -> GitHub | ~/.ssh/id_ed25519 | git pull | Deploy key (read-only) |

**규칙**:
- ed25519 키만 사용 (RSA 금지)
- passphrase 설정 (MacBook은 Keychain 연동)
- DO 서버 root 패스워드 로그인 비활성화 (`PasswordAuthentication no`)

### 6.2 API 키 관리

| 키 | 저장 위치 | 접근 범위 |
|----|----------|-----------|
| Binance API (트레이딩) | DO 서버 Docker .env | autotrader 전용 |
| Binance API (공개 데이터) | Mac Mini ~/pruviq/.env | PRUVIQ 전용 (Read-only, IP 제한) |
| Telegram Bot Token (autotrader) | DO 서버 Docker .env | autotrader 전용 |
| Telegram Bot Token (PRUVIQ) | Mac Mini ~/pruviq/.env | PRUVIQ 전용 (별도 봇) |
| Mem0 API Key | ~/.claude/ 설정 | Claude Code 전용 |
| n8n Credentials | Mac Mini ~/.n8n/ | n8n 내부 암호화 |

**규칙**:
- .env 파일은 절대 git에 포함하지 않음 (.gitignore 필수)
- PRUVIQ용 Binance API는 별도 생성 (거래 권한 없음, 데이터 읽기만)
- API 키는 디바이스별로 분리 (동일 키 공유 금지)
- 주기적 키 로테이션: 분기 1회 권장

### 6.3 네트워크 보안

```
┌────────────────────────────────────────────────────────┐
│  필수 체크리스트:                                       │
│                                                        │
│  [ ] Tailscale ACL 설정 (Mac Mini 외부 접근 차단)      │
│  [ ] DO 서버 UFW 방화벽 (22번만 허용)                   │
│  [ ] n8n: 127.0.0.1 바인딩 (Tailscale로만 접근)       │
│  [ ] Ollama: 127.0.0.1 바인딩                          │
│  [ ] PRUVIQ API: Phase 0에서는 Tailscale 전용          │
│  [ ] Mac Mini 공유기 포트포워딩 비활성화                │
│  [ ] SSH 키 인증만 허용 (패스워드 비활성화)             │
│  [ ] 불필요한 macOS 공유 서비스 비활성화                │
│  [ ] Mac Mini FileVault 활성화 (디스크 암호화)         │
└────────────────────────────────────────────────────────┘
```

### 6.4 환경변수 파일 템플릿

```
# ~/pruviq/.env.example (git에 포함, 실제 값은 .env에)

# Binance (데이터 수집 전용 - 거래 권한 없는 별도 API)
BINANCE_API_KEY=
BINANCE_SECRET_KEY=

# Telegram (PRUVIQ 전용 봇)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Ollama
OLLAMA_HOST=http://127.0.0.1:11434

# n8n Webhook
N8N_WEBHOOK_BASE=http://127.0.0.1:5678/webhook

# PRUVIQ API (DigitalOcean — host in DO_HOST secret)
PRUVIQ_API_HOST=0.0.0.0
PRUVIQ_API_PORT=8080
```

---

## 7. 디스크 용량 예상 및 관리

### 7.1 데이터 크기 예측

| 항목 | 단위 크기 | 일간 증가 | 월간 증가 | 연간 예상 |
|------|----------|-----------|-----------|-----------|
| **Spot OHLCV (1H)** | ~1MB/코인 (2년) | ~4KB/코인 | ~120KB/코인 | ~1.5MB/코인 |
| Spot 전체 (500+코인) | ~500MB | ~2MB | ~60MB | ~750MB |
| **Futures OHLCV (1H)** | ~1MB/코인 (2년) | ~4KB/코인 | ~120KB/코인 | ~1.5MB/코인 |
| Futures 전체 (535코인) | ~535MB | ~2.1MB | ~64MB | ~800MB |
| **시장 이벤트 JSON** | - | ~500KB | ~15MB | ~180MB |
| **시뮬레이션 결과** | - | ~10MB | ~300MB | ~3.6GB |
| **Ollama 모델** (qwen2.5:32b) | ~20GB | 0 | 0 | 0 (고정) |
| **autotrader 백업** | - | ~5MB | ~150MB | ~1.8GB |
| **로그** | - | ~5MB | ~150MB | ~300MB (로테이션 후) |

### 7.2 Mac Mini 디스크 사용 예상

```
초기 (Phase 0):
  Ollama 모델:         ~20 GB
  n8n 데이터:          ~1 GB
  PRUVIQ 데이터:       ~2 GB (spot + futures 초기 수집)
  autotrader 백업:     ~500 MB
  OS + 시스템:         ~30 GB
  ────────────────────────────
  합계:                ~54 GB

1년 후 (Phase 1-2):
  Ollama 모델:         ~20 GB
  n8n 데이터:          ~3 GB
  PRUVIQ 데이터:       ~8 GB (OHLCV + 이벤트 + 시뮬 결과)
  autotrader 백업:     ~2 GB
  OS + 시스템:         ~30 GB
  ────────────────────────────
  합계:                ~63 GB

Mac Mini 256GB 기준: 충분 (40%+ 여유)
Mac Mini 512GB 기준: 매우 여유
```

### 7.3 디스크 관리 정책

| 정책 | 기준 | 동작 |
|------|------|------|
| 로그 로테이션 | 30일 이상 | 자동 삭제 (크론) |
| OHLCV 데이터 | 보존 (삭제 안 함) | 시계열 데이터 유지 |
| 시뮬레이션 결과 | 90일 이상 | 아카이브 (압축) |
| autotrader 백업 | 60일 이상 로그 | 자동 삭제 (크론) |
| 경고 임계값 | 디스크 80%+ | Telegram 알림 |
| 긴급 임계값 | 디스크 90%+ | 수동 개입 필요 |

### 7.4 디스크 체크 스크립트 (check_disk_usage.sh 요구사항)

```
입력: 없음
동작:
  1. df -h / 로 디스크 사용률 확인
  2. du -sh ~/pruviq/data/ 로 데이터 크기 확인
  3. du -sh ~/autotrader-backup/ 로 백업 크기 확인
  4. 80% 초과 시 Telegram 알림 또는 stdout 경고
출력: 날짜, 전체 사용률, 항목별 크기
```

---

## 8. 모니터링 구성

### 8.1 모니터링 레이어

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: autotrader (기존, 변경 없음)                       │
│  ─────────────────────────────────────                       │
│  - Telegram heartbeat (2시간 간격)                          │
│  - 거래 알림 (진입/청산/에러)                                │
│  - daily_loss_limit 경고                                    │
│  - 소스: DO 서버 Docker                                      │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: PRUVIQ 데이터 파이프라인                            │
│  ─────────────────────────────────────                       │
│  - 크론 실행 성공/실패 (로그 기반)                           │
│  - 데이터 수집 완료 건수 (코인 수, 레코드 수)                │
│  - 수집 지연 감지 (마지막 수집 시각 > 2시간 전)              │
│  - 소스: Mac Mini 크론 로그                                  │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: 인프라 헬스                                        │
│  ─────────────────────────────────────                       │
│  - Mac Mini 디스크 사용률                                    │
│  - Mac Mini 메모리/CPU (Ollama 32b 모델 부하)               │
│  - n8n 프로세스 생존 체크                                    │
│  - Ollama 프로세스 생존 체크                                 │
│  - 네트워크 연결 (Tailscale, DO 서버 SSH)                    │
│  - 소스: Mac Mini 크론/n8n                                   │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 알림 채널

| 채널 | 용도 | 우선순위 |
|------|------|---------|
| Telegram (autotrader 봇) | 거래 알림, heartbeat | P0 (기존) |
| Telegram (PRUVIQ 봇) | 데이터 수집, 인프라 경고 | P1 (신규) |
| 크론 로그 파일 | 실행 이력, 디버깅 | P2 (기본) |
| n8n 실행 이력 UI | 워크플로우 상태 | P2 (기존) |

**Telegram 봇 분리 원칙**: autotrader와 PRUVIQ는 별도 봇 사용. 알림이 섞이면 긴급 거래 알림을 놓칠 위험.

### 8.3 헬스체크 항목

| 항목 | 체크 방법 | 주기 | 정상 기준 | 이상 시 |
|------|----------|------|-----------|---------|
| DO 서버 Docker | SSH + docker ps | 매시 (n8n) | 컨테이너 Up | Telegram 알림 |
| Mac Mini n8n | curl localhost:5678 | 매 5분 (크론) | HTTP 200 | launchctl restart |
| Mac Mini Ollama | curl localhost:11434 | 매 5분 (크론) | HTTP 200 | launchctl restart |
| OHLCV 수집 | 로그 파싱 (마지막 성공 시각) | 매시 | 1시간 이내 | Telegram 알림 |
| 디스크 사용률 | df -h | 매일 | < 80% | Telegram 알림 |
| 메모리 사용량 | vm_stat / top | 매시 | < 90% | 로그 기록 |
| Tailscale 연결 | tailscale status | 매시 | Connected | 로그 기록 |
| Git 동기화 | git status (Mac Mini) | 매주 | Clean | 수동 확인 |

### 8.4 장애 대응 가이드

```
┌─────────────────────────────────────────────────────────────┐
│  장애 시나리오별 대응:                                       │
│                                                             │
│  1. DO 서버 Docker 중단                                      │
│     → SSH 접속 → docker-compose up -d                        │
│     → 포지션 동기화 확인 (algo orders)                       │
│     → 우선순위: P0 (실거래 중단)                              │
│                                                             │
│  2. Mac Mini OHLCV 수집 실패                                  │
│     → 크론 로그 확인 → API 에러/네트워크 확인                │
│     → 수동 실행: python scripts/collect_spot.py              │
│     → 우선순위: P1 (데이터 갭 발생)                          │
│                                                             │
│  3. Mac Mini n8n 중단                                        │
│     → launchctl kickstart -k gui/$(id -u)/com.n8n.server     │
│     → 우선순위: P1 (자동화 중단)                              │
│                                                             │
│  4. Mac Mini Ollama 중단                                     │
│     → launchctl kickstart -k gui/$(id -u)/com.ollama.server  │
│     → 우선순위: P2 (시황 요약 지연)                          │
│                                                             │
│  5. Mac Mini 디스크 80%+                                     │
│     → 로그 정리: find ~/pruviq/logs -mtime +7 -delete       │
│     → 시뮬 결과 아카이브: tar -czf archive.tar.gz old_data/  │
│     → 우선순위: P1 (서비스 중단 위험)                        │
│                                                             │
│  6. Tailscale 연결 끊김                                      │
│     → Mac Mini LAN 접속 (172.30.1.16) 시도                  │
│     → tailscale up 재실행                                    │
│     → 우선순위: P2 (원격 관리 불가)                          │
│                                                             │
│  7. Mac Mini 전원 꺼짐 / 재부팅                               │
│     → LaunchAgents 자동 시작 확인                             │
│     → 크론 작업은 crontab에서 자동 복구                      │
│     → PRUVIQ 데이터 갭 확인 (수동 backfill 필요할 수 있음)   │
│     → 우선순위: P1                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 부록 A: Phase별 인프라 진화

```
Phase 0 (현재):
  MacBook: 개발
  Mac Mini: OHLCV 수집 (크론) + autotrader 백업 (크론)
  DO 서버: autotrader 실거래
  포트: n8n(5678), Ollama(11434)

Phase 1 (웹 대시보드 — 2026-02 초기 계획):
  + (초기 가정 — 이행 안 됨) Mac Mini가 PRUVIQ API 호스팅 예정이었음 <!-- docs-lint-allow: historical record of original plan, actual implementation went to DO -->
  ⚠️ 실제 이행: 2026-04 Phase 8 완료. PRUVIQ API는 DigitalOcean
  droplet (host in `DO_HOST` secret, :8080, systemd `pruviq-api.service`)
  로 이관됨. Mac Mini는 dev-only + autotrader 백업 + OHLCV 수집 크론만.
  + 프론트엔드 서빙: Cloudflare Pages (pruviq.com)
  + 외부 접근: Cloudflare Tunnel (api.pruviq.com → DO droplet)

Phase 2 (퍼블릭 서비스):
  + 별도 VPS 또는 클라우드 (PRUVIQ 퍼블릭 서빙)
  + Mac Mini: 데이터 수집/AI 전용 (백엔드)
  + CDN: 정적 자산 (Cloudflare)
  + DB: PostgreSQL 또는 SQLite (Mac Mini -> VPS 동기화)
  Mac Mini 역할 축소: 수집 + AI만, 서빙은 클라우드

Phase 3 (스케일):
  + Kubernetes 또는 Docker Swarm (클라우드)
  + Mac Mini: AI 추론 전용 (Ollama)
  + 멀티 거래소 데이터 수집 분산
```

## 부록 B: 프로젝트 격리 매트릭스

| 항목 | autotrader | PRUVIQ | 공유 |
|------|-----------|--------|------|
| GitHub Repo | pruviq/autotrader | pruviq/pruviq | X |
| 실행 서버 | DO 서버 | Mac Mini | X |
| Python venv | .venv-at | .venv-pv | X |
| Binance API Key | 거래 권한 | 읽기 전용 | X (별도 키) |
| Telegram Bot | autotrader_bot | pruviq_bot | X (별도 봇) |
| 데이터 디렉토리 | data/ | data/ | X (별도 경로) |
| .env 파일 | 각자 | 각자 | X |
| Docker | O (DO 서버) | X (Phase 0) | X |
| 크론 | X (DO Docker) | O (Mac Mini) | X |
| Claude Code | O | O | Mem0 공유 (project 태그 분리) |

## 부록 C: 핵심 명령어 치트시트

```bash
# ── MacBook 개발 ──
# autotrader
cd ~/Desktop/autotrader && source .venv-at/bin/activate

# PRUVIQ
cd ~/Desktop/pruviq && source .venv-pv/bin/activate

# ── Mac Mini 접속 ──
ssh jepo@100.93.138.124          # Tailscale
ssh jepo@172.30.1.16             # LAN

# ── Mac Mini 서비스 관리 ──
launchctl list | grep -E "n8n|ollama|pruviq"    # 서비스 상태
launchctl kickstart -k gui/$(id -u)/com.n8n.server       # n8n 재시작
launchctl kickstart -k gui/$(id -u)/com.ollama.server     # Ollama 재시작

# ── DO 서버 (autotrader) ──
ssh root@167.172.81.145
cd /opt/autotrader
docker-compose logs --tail=30
docker-compose down && docker-compose build --no-cache && docker-compose up -d

# ── 모니터링 ──
# Mac Mini 디스크
ssh jepo@100.93.138.124 "df -h / && du -sh ~/pruviq/data/ ~/autotrader-backup/"

# Mac Mini 서비스
ssh jepo@100.93.138.124 "curl -s localhost:5678/healthz && curl -s localhost:11434/api/tags"

# DO 서버 Docker
ssh root@167.172.81.145 "docker ps && docker-compose logs --tail=5"
```
