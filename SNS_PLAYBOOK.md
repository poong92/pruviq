# PRUVIQ SNS 통합 플레이북 v2.1
> 2026-05-10 통합 작성. **이 파일이 SSoT** — 다른 SNS_*.md 발견 시 이 파일과 통합.

**관련 보조 문서** (운영 디렉토리, git 외부):
- `/Users/jepo/scripts/social/SNS_STABLE_LOCKIN.md` — 14일 데이터 락인 룰 + 포맷 변경 게이트 + 락인 포맷 사양

## 통합 이력
- v1.0 (2026-05-10 오전): 0해시/0이모지/소문자 톤 정의
- v2.0 (2026-05-10): SNS_AUTOMATION_PLAYBOOK 흡수 후 단일화. 포스트 4개 주제우선 구조(클레임→데이터→질문) + 섹션 10 팔로워 성장 엔진 추가.
- v2.1 (2026-05-15): 코드 정합 — plist 시각(08:00→20:30 KST), 큐 자동 archive(`archive_stale_queue()` 구현), 발행 정책(승인=즉시발행) 코드 동작과 일치. `scripts/social/SNS_PLAYBOOK.md`(137줄) → `SNS_STABLE_LOCKIN.md` rename (SSoT 동일명 충돌 해소).
- archive: `docs/archive/SNS_AUTOMATION_PLAYBOOK_20260510.md.archived`

---

## 섹션 1: 시스템 스펙

### 1-A. 자동화 파이프라인

```
[PRUVIQ API]          [OKX 238 coins]       [F&G Index]
ranking-fallback.json  OHLCV 데이터           시장 컨텍스트
        │                   │                     │
        └───────────────────┼─────────────────────┘
                            ▼
              ┌─────────────────────────┐
              │  sns_daily_post.py      │  ← 매일 20:30 KST LaunchAgent
              │  (896줄 메인 진입점)     │
              │                         │
              │  요일 판단 (월/수/목/금) │
              │  + 풀 선택              │
              │  + 콘텐츠 생성          │
              │  + 차트 PNG 생성        │
              └───────────┬─────────────┘
                          │
              ┌───────────▼─────────────┐
              │  validate_content()     │  ← sns_daily_post.py:225
              │  - 글자수 280/500 체크  │
              │  - BANNED_WORDS 14개   │
              │  - "#" 완전 차단        │
              └───────────┬─────────────┘
                          │ 통과
              ┌───────────▼─────────────┐
              │  Telegram 미리보기 발송  │  ← 사용자(제포) 승인 게이트
              │  [✅ Approve] [❌ Reject]│
              └───────────┬─────────────┘
                          │ 승인 클릭 즉시 발행 (Phase 1 수동 모드)
                          ▼
              ┌─────────────────────────┐
              │  social_poster.py       │  ← 718줄
              │  (718줄 발행 엔진)      │
              │                         │
              │  X API ──────────────▶ 📱  (즉시)
              │  (tweepy OAuth1.0a)     │
              │                         │
              │  Threads API ────────▶ 📱  (X 직후)
              │  (graph.threads.net)    │
              └─────────────────────────┘
                          │
              ┌───────────▼─────────────┐
              │  posted/ 저장           │
              │  post_id + url 기록     │
              │  Telegram 결과 알림     │
              └─────────────────────────┘
```

### 1-B. 코드 위치 (변경 시 이 경로 기준)

| 파일 | 줄수 | 역할 |
|------|------|------|
| `/Users/jepo/scripts/social/sns_daily_post.py` | 896 | 메인 진입점, 콘텐츠 생성, 검증, 큐 자동 archive |
| `/Users/jepo/scripts/social/social_poster.py` | 718 | X tweepy + Threads graph API 발행 |
| `/Users/jepo/scripts/social/telegram_approval_bot.py` | 484 | 승인/거절 콜백 핸들러 |
| `/Users/jepo/scripts/social/generate_chart.py` | 182 | 독립 차트 모듈 |
| `/Users/jepo/scripts/social/sns_approval_reminder.py` | 45 | 21:00 미승인 알림 |

**핵심 코드 라인** (`grep -n` 으로 재확인 권장 — 코드 변경 시 drift 가능):
- `sns_daily_post.py:34` — BANNED_WORDS 14개
- `sns_daily_post.py:225` — `validate_content()` 진입점
- `sns_daily_post.py:250` — `if "#" in text` 해시태그 절대 차단
- `sns_daily_post.py:705` — `archive_stale_queue()` (어제 이전 큐 자동 archive)
- `sns_daily_post.py:736` — `--auto` 플래그 (Phase 2 전환용, 현재 미사용)

### 1-C. LaunchAgent 3개 (현재 활성, plist 실측)

| Label | 트리거 (KST) | plist 경로 |
|-------|------------|-----------|
| `com.pruviq.sns-daily-post` | **20:30** (Hour=20, Minute=30) | `~/Library/LaunchAgents/com.pruviq.sns-daily-post.plist` |
| `com.pruviq.sns-preflight` | **08:30** (Hour=8, Minute=30) | `~/Library/LaunchAgents/com.pruviq.sns-preflight.plist` |
| `com.pruviq.sns-approval-reminder` | **21:00** (Hour=21, Minute=0) | `~/Library/LaunchAgents/com.pruviq.sns-approval-reminder.plist` |

> launchd는 시스템 로컬 TZ(KST) 기준. JSON 큐의 `created` 필드(`+00:00`) + `social_poster.py` 내부 timestamp는 UTC. 로그 파일 mtime(`ls -la`)은 KST.

### 1-D. queue/posted/failed 정책

| 디렉토리 | 경로 | 정책 |
|---------|------|------|
| queue/ | `/Users/jepo/scripts/social/queue/` | 다음 sns-daily-post 실행 시작 시 어제(KST) 이전 created 항목 자동 `.archived` 처리 (`sns_daily_post.py:705 archive_stale_queue()`). 당일 재실행은 보존. |
| posted/ | `/Users/jepo/scripts/social/posted/` | 영구 보존 (발행 기록) |
| failed/ | `/Users/jepo/scripts/social/failed/` | 영구 보존 (디버깅 자료) |

### 1-E. 플랫폼별 기술 제약

| 항목 | X | Threads |
|------|---|---------|
| 최대 글자 | 280자 | 500자 |
| 최소 글자 | 50자 | 50자 |
| 해시태그 | **0개** (`sns_daily_post.py:250` 강제 차단; cashtag `$BTC`는 `$` 사용으로 허용) | **0개** |
| 이미지 | 수/금 필수, 나머지 선택 | 선택 |
| 링크 | 첫 댓글에만 (본문 X) | 첫 댓글에만 |
| 권장 발행 시각 | KST 22:00 | KST 22:30 |

> Phase 1 현재 자동 발행 코드는 없음. 사용자가 Telegram Approve를 누른 시점에 `telegram_approval_bot.py:242,331`이 `social_poster.post_x/post_threads`를 즉시 호출. 위 "권장 시각"은 수동 발행 가이드.

### 1-F. 차트 데이터 정책 (`generate_chart.py` + `generate_chart_for_day`)

**SSoT 규칙**: 차트의 모든 숫자는 (a) 라이브 ranking API, (b) `_verified_fallback` 검증된 정적 데이터, (c) `data/*_seed.json` 시드 파일 중 한 곳에서만 옴. 함수 내부 하드코딩 금지.

**단위 일관성**: 차트 막대 라벨은 본문과 동일한 환산식 사용 (`pf_to_plain`: PF × 100 = `$X out`). 차트의 `$100 → $X` 와 본문의 `every $100 → $X`는 같은 값. matplotlib에서 `$` 는 `\$`로 escape 필수 (`generate_chart.py:_dollar_label`).

**검증 앵커**: 모든 차트 footer 왼쪽에 데이터 스코프 표시 (`"238 coins · 2y real ohlcv"` 등). `_verified=false` 시드는 자동으로 `· verification pending` 추가. `_verified_fallback` 데이터는 자동으로 `· verified YYYY-MM-DD` 추가.

**시드 파일**:
| 시드 | 경로 | 사용처 |
|------|------|--------|
| Monday F&G regime | `~/scripts/social/data/monday_regime_seed.json` | `sns_daily_post.py:563-583` chart_regime |

새 시드 추가 시 `_meta.{_verified, source_commit, last_verified, verification_anchor}` 필드 의무.

**Best/Worst 식별**: `chart_insight`는 입력 배열 순서가 아닌 **값으로 ranking** (`generate_chart.py:107-108`). 호출부 labels/values 순서 자유. 변수명 inversion 위험 제거.

**색 SSoT (`generate_chart.py:color_for_pf`)**: 모든 차트의 PF→색 결정은 이 한 함수만 사용. 함수 내 inline 임계값 금지.

| Mode | PF < 1.0 | 1.0 ≤ PF < 1.3 | PF ≥ 1.3 |
|------|----------|----------------|----------|
| `tier3` (기본, `chart_insight` / `chart_regime`) | RED | BLUE | GREEN |
| `binary` (`chart_comparison`: winner/loser 강한 대비) | RED | RED | GREEN |

임계값 변경 시 `generate_chart.py:color_for_pf`만 수정. 자동으로 3개 차트 전부 동기화.

---

## 섹션 2: 30일 콘텐츠 캘린더

**발행 요일**: 월/수/목/금 (`sns_daily_post.py:409, 418, 444, 479` — `generate_content()` 내부 day 분기)
**휴식 요일**: 화/토/일 (코드 자동 스킵)

```
┌──────┬─────────────────────┬─────────────────────┬─────────────────────┬─────────────────────┐
│ WEEK │        MON          │        WED          │        THU          │        FRI          │
│      │      통념 깨기        │     전략 부검실       │      실수 일지        │      히든 성공        │
│      │  INSIGHTS pool 회전  │  ranking-fallback   │  MISTAKES pool 회전  │  ranking-fallback   │
├──────┼─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┤
│  1   │ LONG 전략 0 엣지     │ Momentum Breakout   │ WR 52.7%인데 손실    │ BB Squeeze SHORT    │
│ 5/11 │ (97K trades, 2y)    │ LONG (PF 0.72 live) │ (1,914 trades 실측)  │ (PF 2.22 live)      │
├──────┼─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┤
│  2   │ 같은 전략 다른 시장   │ 이번주 최하위 live    │ 코인 많을수록 안전?   │ 이번주 최상위 live    │
│ 5/18 │ neutral vs fear     │ (ranking API 실시간) │ 569 vs 15 coins     │ (ranking API 실시간) │
├──────┼─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┤
│  3   │ 공포에 사라?          │ 이번주 최하위 live    │ 포지션 줄이면 해결?   │ 이번주 최상위 live    │
│ 5/25 │ F&G<25, PF 0.91     │ (ranking API 실시간) │ PF 1.48→1.21 실측   │ (ranking API 실시간) │
├──────┼─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┤
│  4   │ 화요일 쉬었더니       │ 이번주 최하위 live    │ DCA가 답이다?         │ 이번주 최상위 live    │
│ 6/1  │ return +19%↑        │ (ranking API 실시간) │ edge 없으면 무의미    │ (ranking API 실시간) │
└──────┴─────────────────────┴─────────────────────┴─────────────────────┴─────────────────────┘
```

**풀 회전 방식**: `date.toordinal() % len(pool)` (date hash, 반복 시 30일 내 충돌 2건 발생 — pool 확장 권장)
- INSIGHTS pool: `sns_daily_post.py:352` (`INSIGHTS = [...]`)
- MISTAKES pool: `sns_daily_post.py:445` (`mistakes = [...]`)
- 풀 회전: `week_num % len(pool)` (`sns_daily_post.py:410`, `:471`)

---

## 섹션 3: 실제 화면 — 다른 사용자 피드뷰

> 다른 사람이 X/Threads 피드를 스크롤할 때 보이는 화면 기준.

---

### 3-A. 월요일 — 통념 깨기

#### X 모바일 피드뷰:
```
┌─────────────────────────────────────────────────────┐
│  ←  Home                           🔔  ✉            │
├─────────────────────────────────────────────────────┤
│  For you   Following                                 │
├─────────────────────────────────────────────────────┤
│  🟣  PRUVIQ  @pruviq_io  ·  4h                      │
│                                                     │
│  extreme fear isn't a buy signal.                   │
│                                                     │
│  everyone in my feed said it was.                   │
│  238 coins. 2 years. 891 trades.                    │
│  long when F&G drops below 20.                      │
│                                                     │
│  profit factor: 0.91.                               │
│  (below 1.0 = losing on balance)                    │
│                                                     │
│  the crowd consensus almost cost me.                │
│                                                     │
│  when do you actually buy?                          │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  [F&G 구간별 PF 바 차트 — matplotlib 자동생성] │   │
│  │  Extreme Fear: 0.91  │  Neutral: 1.93       │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  💬 44   🔁 112   ❤️ 387   📊 9.8K                 │
│  ↳ PRUVIQ: "test on pruviq.com/simulate ↓"         │
└─────────────────────────────────────────────────────┘
```

#### Threads 모바일 피드뷰 (3파트):
```
┌─────────────────────────────────────────────────────┐
│  🟣  pruviq_io  ·  4h                     ···       │
│                                                     │
│  extreme fear isn't a buy signal.                   │
│                                                     │
│  tracked it. 238 coins. 2 years. 891 trades.       │
│  long when F&G drops below 20.                      │
│  profit factor: 0.91. (below 1.0 = losing)         │
│                                                     │
│  when do you actually buy?                          │
│                                                     │
│  ❤️ 89   💬 Reply                                   │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─         │
│  🟣  pruviq_io                                      │
│                                                     │
│  why?                                               │
│  extreme fear = markets in free fall.               │
│  every buy is catching a falling knife.             │
│  profit factor went from 1.93 (neutral)             │
│  to 0.91 (extreme fear).                            │
│                                                     │
│  ❤️ 67   💬 Reply                                   │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─         │
│  🟣  pruviq_io                                      │
│                                                     │
│  sometimes doing nothing is the trade.              │
│                                                     │
│  have you ever bought extreme fear                  │
│  and watched it keep falling?                       │
│                                                     │
│  ❤️ 134   💬 Reply                                  │
└─────────────────────────────────────────────────────┘
```

---

### 3-B. 수요일 — 전략 부검실

#### X 모바일 피드뷰:
```
┌─────────────────────────────────────────────────────┐
│  🟣  PRUVIQ  @pruviq_io  ·  2h                      │
│                                                     │
│  the most dangerous strategies look clean.          │
│                                                     │
│  almost deployed this last quarter.                 │
│  momentum breakout LONG. 4H. 90 days.               │
│  1,534 trades. profit factor: 0.72.                 │
│  (for every $1 won, losses took $1.39)              │
│                                                     │
│  net negative. every month.                         │
│  the backtest saved me.                             │
│                                                     │
│  what strategy almost got you?                      │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  [손익 곡선 — 우하향 빨간 그래프]               │   │
│  │  Momentum Breakout LONG · 238 coins · 90d   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  💬 31   🔁 58   ❤️ 203   📊 4.1K                  │
│  ↳ PRUVIQ: "see all rankings: pruviq.com/..."      │
└─────────────────────────────────────────────────────┘
```

#### Threads 모바일 피드뷰 (3파트):
```
┌─────────────────────────────────────────────────────┐
│  🟣  pruviq_io  ·  2h                     ···       │
│                                                     │
│  the most dangerous strategies look clean.          │
│                                                     │
│  almost deployed this last quarter.                 │
│  momentum breakout LONG. 1,534 trades. 90d.        │
│  profit factor: 0.72. net negative every month.    │
│                                                     │
│  ❤️ 89   💬 Reply                                   │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─         │
│  🟣  pruviq_io                                      │
│                                                     │
│  why did it fail?                                   │
│  momentum strategies need trending markets.         │
│  last 90 days: sideways.                            │
│  the strategy wasn't wrong. the regime was.        │
│                                                     │
│  ❤️ 67   💬 Reply                                   │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─         │
│  🟣  pruviq_io                                      │
│                                                     │
│  momentum needs trending markets.                   │
│  the last 90 days were sideways.                    │
│                                                     │
│  the data saved me before i deployed it.            │
│  what saved you?                                    │
│                                                     │
│  ❤️ 134   💬 Reply                                  │
└─────────────────────────────────────────────────────┘
```

---

### 3-C. 목요일 — 실수 일지

#### X 모바일 피드뷰:
```
┌─────────────────────────────────────────────────────┐
│  ←  Home                           🔔  ✉            │
├─────────────────────────────────────────────────────┤
│  For you   Following                                 │
├─────────────────────────────────────────────────────┤
│  🟣  PRUVIQ  @pruviq_io  ·  8h                      │
│                                                     │
│  win rate is a vanity metric.                       │
│                                                     │
│  i ran 52% WR for months.                           │
│  felt like progress.                                │
│                                                     │
│  pulled the actual numbers.                         │
│  1,914 trades. 238 coins.                           │
│  profit factor: 0.94.                               │
│  (below 1.0 = net loss. 52% WR, still down.)        │
│                                                     │
│  tracking the wrong number for months.              │
│                                                     │
│  anyone else figure this out late?                  │
│                                                     │
│  💬 61   🔁 143   ❤️ 521   📊 11.2K                 │
│  ↳ @pruviq_io: "check your PF, not WR ↓ [link]"   │
└─────────────────────────────────────────────────────┘
```

#### Threads 모바일 피드뷰 (3파트):
```
┌─────────────────────────────────────────────────────┐
│  🟣  pruviq_io  ·  8h                     ···       │
│                                                     │
│  win rate is a vanity metric.                       │
│                                                     │
│  ran 52% WR for months. felt like progress.        │
│  pulled the numbers. 1,914 trades. 238 coins.      │
│  profit factor: 0.94.                               │
│  (below 1.0 = net loss. winning 52%, still down.)  │
│                                                     │
│  anyone else figure this out late?                  │
│                                                     │
│  ❤️ 112   💬 Reply                                  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─         │
│  🟣  pruviq_io                                      │
│                                                     │
│  the math:                                          │
│  52% win rate sounds like you're winning.           │
│  but if your wins average $80 and                   │
│  losses average $100 — you're down.                 │
│                                                     │
│  ❤️ 89   💬 Reply                                   │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─         │
│  🟣  pruviq_io                                      │
│                                                     │
│  now i check profit factor first.                   │
│  win rate is the last thing i look at.              │
│                                                     │
│  what number do you check first?                    │
│                                                     │
│  ❤️ 198   💬 Reply                                  │
└─────────────────────────────────────────────────────┘
```

---

### 3-D. 금요일 — 히든 성공

#### X 모바일 피드뷰:
```
┌─────────────────────────────────────────────────────┐
│  🟣  PRUVIQ  @pruviq_io  ·  6h                      │
│                                                     │
│  regime beats strategy every time.                  │
│                                                     │
│  BB Squeeze SHORT: 68.6% WR, PF 2.22.              │
│  238 coins. 2,898 trades. MDD 14%.                 │
│  ran it when ADX > 30 (trending market).            │
│  fell apart completely.                             │
│                                                     │
│  same strategy. different regime. opposite result. │
│                                                     │
│  what's your sideways play?                         │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  [전략 랭킹 스크린샷 — pruviq.com/ranking]   │   │
│  │  #1  BB Squeeze SHORT  PF 2.22  WR 68.6%    │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  💬 28   🔁 74   ❤️ 312   📊 7.2K                  │
│  ↳ PRUVIQ: "test it free: pruviq.com/simulate ↓"  │
└─────────────────────────────────────────────────────┘
```

#### Threads 모바일 피드뷰 (3파트):
```
┌─────────────────────────────────────────────────────┐
│  🟣  pruviq_io  ·  6h                     ···       │
│                                                     │
│  regime beats strategy every time.                  │
│                                                     │
│  BB Squeeze SHORT: 68.6% WR, PF 2.22.              │
│  ran it in a trending market (ADX > 30).           │
│  fell apart. same data, different regime.           │
│                                                     │
│  ❤️ 123   💬 Reply                                  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─         │
│  🟣  pruviq_io                                      │
│                                                     │
│  why does it work?                                  │
│  bollinger band squeeze = low volatility period.    │
│  short breakout = volatility expansion downward.   │
│  2,898 trades says this pattern holds.             │
│                                                     │
│  ❤️ 89   💬 Reply                                   │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─         │
│  🟣  pruviq_io                                      │
│                                                     │
│  the catch: only works when markets go nowhere.     │
│  trending? it breaks.                               │
│                                                     │
│  the quiet ones always have a condition.            │
│  tested it on your coins yet?                       │
│                                                     │
│  ❤️ 234   💬 Reply                                  │
└─────────────────────────────────────────────────────┘
```

---

## 섹션 4: 이모지 룰 — 전체 스펙

### 원칙
```
이모지 = 장식 아님. 기능 없으면 쓰지 않는다.
사이트 톤 근거: docs/BRAND_CONCEPT.md:79
"Precise. Blunt. Generous with data, stingy with hype."
```

### 허용 이모지 (3개만)

| 이모지 | 용도 | 위치 |
|--------|------|------|
| 📊 | 차트/데이터 있음 시그널 | 이미지 첨부 포스트에 1회 (선택) |
| ❌ | 잘못된 통념 마킹 | 통념깨기 리스트 마커 (선택) |
| — | 리스트 마커 대체 | 목록 2개 이상일 때 |

### 절대 금지 이모지 (크립토 hype = 신뢰도 즉시 0)

```
🚀  투더문 연상            🌙  동일
💰  광고 계정 신호          🤑  동일
💎  다이아몬드 핸즈 (죽은 밈) 🙌  마케팅 계정 패턴
🔥  과장                  ⚡  SaaS 광고
✨  동일                  🎉  기업 PR 패턴
🔴  가격 예측 암시          🟢  동일
```

### Before / After (5쌍)

```
❌  "97,000 trades 🚀 one pattern kept winning! 💰"
✅  "97,000 trades. one pattern kept winning."

❌  "BB Squeeze SHORT 🔥 PF 2.22 — incredible results! ✨"
✅  "BB Squeeze SHORT. PF 2.22. 2,898 trades."

❌  "fear & greed below 25 🌙 — time to buy? 💎🙌"
✅  "fear & greed below 25. we tested it. profit factor: 0.91."

❌  "this strategy is 🔥🔥🔥 everyone needs this"
✅  "68.6% win rate. 2,898 trades. data says it works."

❌  "HUGE finding 🚨🚨 — you won't believe this"
✅  "97,000 trades. one finding. here it is."
```

---

## 섹션 5: 말투 룰

### 5-A. AI 냄새 제거 10쌍

| AI 표현 | 자연스러운 버전 | 이유 |
|---------|--------------|------|
| "It's important to note that..." | *(삭제, 바로 본론)* | 선언 후 본론 = 에세이 구조 |
| "In conclusion, the data suggests..." | "0.72 PF. skip it." | "suggests" = 확신 없는 AI 표현 |
| "This demonstrates that our platform..." | "we tested it. here's what happened." | 자화자찬 구조 제거 |
| "We are committed to transparency." | "we post every losing strategy." | 행동으로 보여줌, 선언 X |
| "Leveraging our advanced backtesting..." | "238 coins. 2 years of data." | SaaS 광고 언어 제거 |
| "By utilizing this approach..." | *(동사 직결)* | "utilizing" = AI 과장어 |
| "This comprehensive analysis shows..." | "16 strategies. 11 failed." | 스스로 "comprehensive" 선언 금지 |
| "Key takeaways include:" | "three things:" | 보고서 구조 제거 |
| "As we can see from the chart..." | *(차트 수치 직접 인용)* | 독자를 가르치려는 구조 |
| "Furthermore, it is evident that..." | *(다음 문장으로 연결)* | 전환어 + 수동태 이중 AI 신호 |

### 5-B. 3줄 톤 가이드 (전부)

```
1. 숫자 먼저. 주장 나중.
2. 소문자. 마침표. 짧은 문장.
3. "I" — 회사 아닌 사람. 팔로워가 먼저, 브랜드는 나중.
```

### 5-B-1. "I vs we" 원칙 (CRITICAL)

| ❌ 홍보 톤 (we) | ✅ 소통 톤 (I) |
|--------------|--------------|
| "we tested it." | "i tracked what actually happened." |
| "we're posting this so you don't run it." | "glad i looked before jumping." |
| "we found that BB Squeeze works." | "nobody in my feed talks about this." |
| "our platform lets you test..." | *(본문에 플랫폼 언급 없음 — 링크는 첫 댓글)* |

**이유**: 팔로워를 먼저 모은다. 사람들은 회사 계정이 아닌 한 사람의 발견에 공감한다. @pruviq 핸들이 있으면 충분. 포스트 본문에서 PRUVIQ를 팔지 않는다.

### 5-C. 포스트 전체 Before / After

**Before (AI 냄새):**
```
It's important to note that our comprehensive analysis of 97,000 trades
demonstrates the significant advantages of utilizing data-driven approaches.
Key takeaways include improved profit factors and reduced drawdowns.
Furthermore, it is evident that our platform provides superior capabilities.
```

**After (실제 트레이더 문체):**
```
97,000 trades. 238 coins. 2 years.

11 strategies failed.
5 survived.

we're posting all of them.
```

---

## 섹션 6: 어그로(훅) 스코어링

> 스코어 = 피드 스크롤 멈춤 확률 (1-10). 8점 이상 = 즉시 사용.

| 순위 | 훅 | 점수 | 이유 |
|-----|---|------|------|
| 1 | "last week we lost $301." | **9** | 손실 공개 + 구체적 금액. 즉시 신뢰 신호. |
| 1 | "97,000 trades. one pattern kept winning." | **9** | 첫 단어 숫자. "하나"라는 명확한 답 예고. |
| 3 | "everyone says buy the dip. i tested it." | **8** | 대중 vs 데이터 충돌 구조. 결과 궁금. |
| 3 | "i stopped trading on tuesdays. here's why." | **8** | "화요일"이라는 초구체적 행동. |
| 3 | "fear & greed below 25. everyone says buy. we didn't." | **8** | 반전 3단 구조. |
| 6 | "most traders are wrong about win rate." | **7** | 독자 포함 가능성. 구조 과용 주의. |
| 7 | "tested 17 strategies. **3 survived.**" | **9** *(개선 후)* | 결과 추가만으로 6→9점. |
| 8 | "this coin beats BTC every bear market." | **6** | "this coin" 모호함. |
| 9 | "nobody talks about BB Squeeze SHORT." | **5** | "nobody talks about X" 2023 과용 패턴. |
| 10 | "the strategy that works when everything fails." | **3** | 수치 없는 광고 헤드라인. |

**기준선**: 8점↑ 즉시 사용 / 6-7점 개선 후 사용 / 5점↓ 재작성

---

## 섹션 7: 타겟 페르소나

### 30일 메인 타겟: P2 중급 트레이더 (en)

**근거**: `docs/SERVICE_PLAN.md:46-53`
- 경험 1-2년, 월 거래액 $1K-10K
- "백테스트는 좋은데 실전 실패, 파라미터 최적화 어려움"
- **X + Threads 활성층** — Reddit r/algotrading 동반

**콘텐츠 언어 가정**:
- PF / WR / MDD / BB Squeeze / Momentum Breakout 용어 자유 사용
- 수치 우선 (1,534 trades, PF 0.72, 68.6% WR)
- "직접 테스트해봐"가 CTA 전부

**절대 사용 금지**:
- "even beginners can..." (P1 타겟 혼재)
- "advanced algorithm" (P3 언어)
- 수익 보장 / 가격 예측

### 30일 후 병행 검토: 한국 트레이더 (ko)

**근거**: `docs/BUSINESS_MODEL.md:80-84` — "Korean traders average 4× volume ($200K/month)"
**트리거**: en 30일 KPI 전부 충족 시 ko 동시 발행 추가
**인프라**: `sns_daily_post.py` 내 ko 분기 추가 필요 (현재 en만)

### 범위 외 (이 플레이북 담당 아님)

| 페르소나 | 채널 | 담당 |
|---------|------|------|
| P1 초보 트레이더 | Telegram 커뮤니티 | 별도 Telegram 전략 |
| P3 퀀트/고급 | Hacker News, Reddit r/algotrading | 별도 HN/Reddit 전략 |

---

## 섹션 8: 발행 정책

### 1단계 (2026-05-11 ~ 2026-06-09, 30일): Telegram 수동 승인 모드

**권장 발행 시각**:
- X: KST 22:00
- Threads: KST 22:30 (30분 간격 — dwell time 알고리즘 분리)

> 현재 자동 발행 코드는 없음. 22:00/22:30 시각에 사용자가 직접 Telegram Approve 버튼을 눌러야 발행됨. 자동화는 Phase 2 (`--auto`) 전환 후.

**일일 승인 플로우 (실측 동작)**:
```
20:30 KST  com.pruviq.sns-daily-post → 콘텐츠 + 차트 생성 → Telegram 미리보기
           - 시작 시 archive_stale_queue() (sns_daily_post.py:705)
             → 어제 이전 큐 자동 .archived
           - queue/YYYYMMDD_HHMMSS-sns-daily.json 작성
              │
              ▼
21:00 KST  com.pruviq.sns-approval-reminder → 미승인 시 Telegram 알림
              │
              ▼ (사용자 제포가 22:00경 클릭 — 권장)
승인 시점   telegram_approval_bot.py:242,331 → social_poster import
           → post_x (즉시) → post_threads (즉시 또는 직후)
              │
              ▼
발행 직후  posted/ 저장 + Telegram 결과 알림 (social_poster.py:574-617)
```

**첫 댓글 정책** (X 알고리즘 도달 보호):
- 본문 발행 5분 이내, PRUVIQ 계정으로 첫 댓글
- 본문 링크 → 도달 30-40% 감소 (X 정책) → 첫 댓글에만 배치
- 댓글 템플릿:
  ```
  save this before running it:
  pruviq.com/simulate?strategy=[전략명]

  full rankings (updated weekly):
  pruviq.com/strategies/ranking
  ```
- "save this" / "bookmark if you trade alts" 앞에 붙이면 북마크율 상승 (북마크 > 좋아요 알고리즘 가중치)

### 2단계 (2026-06-10 이후): KPI 기반 모드 결정

**--auto 전환 조건** (3개 모두 충족 시):
1. 30일 KPI 6개 지표 전부 충족
2. 사고 0건 (잘못된 데이터 발행 0회)
3. 사용자 승인률 80%+ (25일 이상 승인)

**전환 조치**:
```bash
# plist ProgramArguments에 --auto 추가 후 reload
launchctl unload ~/Library/LaunchAgents/com.pruviq.sns-daily-post.plist
# plist 수정: <string>--auto</string> 추가
launchctl load ~/Library/LaunchAgents/com.pruviq.sns-daily-post.plist
```

---

## 섹션 9: KPI (30일 측정 기준)

**측정 기간**: 2026-05-11 ~ 2026-06-09

**주요 KPI**: X + Threads 팔로워 합산 (베이스라인: 2026-05-11 수동 측정 → `~/scripts/social/data/follower-baseline-20260511.json`)

| 구분 | 지표 | 목표 | 측정 도구 |
|------|------|------|---------|
| **주요** | X + Threads 팔로워 합산 | +300 (스트레치 +700) | X Analytics + Threads Insights |
| 보조 | 평균 도달 (포스트당) | 3K+ | X Analytics |
| 보조 | 댓글 유발 포스트 | 주 2개+ | 수동 확인 |
| 보조 | 북마크 (포스트당) | 10+ | X Analytics |
| 보조 | 사이트 클릭 (월) | 300+ | CF Analytics (Phase 2 UTM 추적 후 유효) |

**팔로워 목표 근거**: 업계 baseline 60-90일 만에 500-1,000 팔로워 (일일 포스팅 + 인게이지먼트). 30일 = baseline 절반 +300이 현실적. +700은 리플라이 70/30 + 콘텐츠 톤 정합 모두 작동 시 스트레치.

**다음 단계 트리거** (주요 KPI 기준):
- +700 이상 → ko 병행 + --auto 전환 검토 (2단계)
- +300~700 → 30일 더 유지 (Phase 1.5)
- +300 미만 → 톤/타겟 재검토 (해시태그 1개 실험 또는 P1 혼합 실험)

---

## 섹션 10: 팔로워 성장 엔진

> 연구 기반 (2026-05-10). 팔로워 수치가 목표가 아님. 내 데이터에 반응하는 사람을 모으는 것이 목표.

### 10-A. X 알고리즘 가중치 (신호 우선순위)

| 액션 | 가중치 (추정) | 전략 |
|------|-------------|------|
| 댓글 → 상대방 답글 유발 | **+75** | 질문으로 끝내기. 가장 중요. |
| 리트윗 | **+20** | 데이터 요약 = RT 유발 포맷 |
| 북마크 | **+10** | "save this" 프리픽스 = 북마크율 상승 |
| 좋아요 | +0.5 | 의미 없음. 좋아요 구하지 말 것 |
| 본문 외부 링크 | **-50~90%** | 본문 링크 금지. 첫 댓글에만 배치 |

**가중치 출처 (2026-05-10 검증 상태)**:
- 2023-04 X(twitter)이 알고리즘 코드 일부 GitHub 공개 후 커뮤니티가 추정한 값
- 정확한 절대수치는 X 비공개. **상대 우선순위는 신뢰할 수 있음** (댓글루프 ≫ 리트윗 ≫ 북마크 ≫ 좋아요)
- 본문 링크 도달 감소는 X 공식 발표 (Elon Musk, 2023-12). 50-90%는 사용자 실측 분포

**핵심**: 좋아요 200개 < 댓글 3개 + 답글 루프. 절대치 모르더라도 우선순위 자체로 충분.

---

### 10-B. 리플라이 전략 (70/30 규칙)

**원칙**: 원본 포스팅 30%, 타 계정 리플라이 70%.

**왜 리플라이가 팔로워를 만드나**:
- 내 포스트 노출 = 내 팔로워 (제한적)
- 내 리플라이 노출 = 상대방 팔로워 전체 (노출 10-100배)
- 양질의 리플라이 → "누구야?" → 프로필 방문 → 팔로우

**일일 목표**: 10-20개 리플라이 (타겟 포스트 발행 15분 이내)

**타겟 계정 카테고리** (2026-05-10 실측 검증):

| 카테고리 | 계정 | 실측 |
|---------|------|------|
| quant/systematic | @robcarver7 | ✅ Robert Carver (systematic trading 저자, qoppac.blogspot.com) |
| quant/systematic | @_QuantTrader | ✅ "Systematic Trader, Quantitative Tape Reader" |
| crypto on-chain | @glassnode | ✅ 605.5K 팔로워, 온체인 분석 선도 |
| crypto on-chain | @woonomic | ✅ Willy Woo, 비트코인 온체인 선구자 |
| crypto data | @ki_young_ju | ✅ CryptoQuant CEO, 활발 |

**추가 발굴 카테고리** (이름은 직접 X에서 확인 필요):
- 교육형: 백테스팅/전략 설명 포스트 올리는 계정 (1K-50K 팔로워)
- retail trader: 포스트마다 100-500 좋아요 받는 일반 트레이더
- fintwit: bull/bear thesis 공유하는 펀더멘털 계정

**타겟 추가 룰**: 새 타겟 계정 등록 전 (a) X 핸들 실재 확인 (b) 최근 7일 포스트 빈도 (c) 평균 인게이지먼트 100+ 충족 시에만 리스트 추가.

**리플라이 3가지 유형 (우선순위 순)**:

| 유형 | 예시 | 효과 |
|------|------|------|
| 데이터 추가 | "ran this on 238 coins. same result — PF 0.91 in extreme fear." | 신뢰도 +, 프로필 방문 유도 |
| 반론 + 근거 | "disagree. when ADX < 25 this flips to PF 2.1. regime matters." | 논쟁 유발 = 알고리즘 부스트 |
| 경험 공유 | "ran into this last quarter. momentum + sideways market = disaster." | 공감 = 팔로우 전환 |

**금지 리플라이**:
- "great post!" / "totally agree" — 내용 없음 = 노출 0
- 리플라이 본문에 링크 포함 — 스팸 신호
- 동일 계정에 하루 2회 이상 리플라이

---

### 10-C. 첫 30분 집중 플로우

X 알고리즘: 발행 후 30분 내 인게이지먼트로 전체 배포 범위 결정.

```
22:00  X 발행
22:05  첫 댓글 → "save this before running it: pruviq.com/simulate?..."
22:08  타겟 계정 최근 포스트 5개 → 데이터 추가형 리플라이
22:15  내 포스트 댓글 달린 경우 즉시 답글 (댓글 루프 = +75 가중치)
22:25  Threads 발행 준비 (22:30 자동 트리거)
```

**목표**: 30분 내 5+ 댓글 → 알고리즘 2차 배포 트리거

---

### 10-D. 북마크 유도 공식

북마크 = 가중치 +10 (좋아요의 20배). 가장 저평가된 신호.

**고북마크 포스트 구조**:
```
[카운터인튜이티브 클레임]

[수치 데이터 3-5줄]

save this — [이유 한 줄]
```

**예시**:
```
win rate is a vanity metric.

1,914 trades. 238 coins.
52% WR, PF 0.94.
still losing.

save this — most people track the wrong number.
```

**고북마크 콘텐츠 유형**:
- 전략 비교표 (PF vs WR — 어느 게 맞나)
- regime 조건별 전략 성과표
- "테스트해봤더니 틀렸던 것들" 목록

---

### 10-E. 성장 단계별 전략

**Phase 1 (현재 ~ +500 팔로워): 존재감 확립**
- 리플라이 70% 집중 (매일 10-15개)
- X 원본 포스트: 월/수/목/금 4일 (현행 유지)
- Threads: X 발행 30분 후 (현행 22:30 유지)
- 우선 타겟: 퀀트/알고트레이딩 계정들

**Phase 2 (+500 이후): 커뮤니티 형성**
- 팔로워에게 데이터 요청 ("what strategy should i run next?")
- 주 1회 Threads 스레드 (3-5파트, 교육형)
- 리플라이 비중 50/50으로 전환

**Phase 3 (+2K 이후): 권위 확립**
- Reddit r/algotrading 크로스포스팅 (원본 데이터 포스트)
- "주간 전략 랭킹" 고정 포맷 도입
- ko 병행 검토 (4× 매출 레버, BUSINESS_MODEL.md:80-84)

---

### 10-F. 매일 10분 실행 루틴

```
발행 당일 (10분):
  □ 22:05  첫 댓글 (링크 포함)
  □ 22:08  타겟 계정 5개 리플라이
  □ 22:15+ 내 포스트 댓글 즉시 답글

비발행일 (5분):
  □ 타겟 계정 피드 스캔 → 2-3개 리플라이
  □ 내 포스트 기존 댓글 답글 확인
```

**주간 체크 (5분)**:
```
  □ 금요일: 댓글수/북마크/팔로워 변화 기록
  □ 일요일: 다음 주 리플라이 타겟 계정 3개 사전 선정
```

---

## 섹션 11: 롤백 / 비상 절차

### 통합 이전 상태로 롤백 (5분)
```bash
cp /tmp/SNS_PLAYBOOK_pre_v2_20260510.bak /Users/jepo/pruviq/SNS_PLAYBOOK.md
mv /Users/jepo/pruviq/docs/archive/SNS_AUTOMATION_PLAYBOOK_20260510.md.archived \
   /Users/jepo/pruviq/SNS_AUTOMATION_PLAYBOOK.md
mv /Users/jepo/scripts/social/queue.archive_20260510/ \
   /Users/jepo/scripts/social/queue/
```

### 잘못된 포스트 발행 시 (즉시)
1. X: 트윗 삭제 (X 앱 → 삭제)
2. Threads: 게시물 삭제 (Threads 앱 → 삭제)
3. `failed/` 폴더로 수동 이동 후 원인 기록
4. Telegram에 실패 사유 메모

---

*SSoT: `/Users/jepo/pruviq/SNS_PLAYBOOK.md`*
*다음 갱신 트리거: 30일 KPI 측정 후 (2026-06-09) 또는 모드 변경 시*
