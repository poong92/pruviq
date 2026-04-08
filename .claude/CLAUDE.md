# OWNER DIRECTIVES (최우선)

## 금지 사항 (STOP LIST)

다음을 하면 안 됨:
- 문서/프레임워크/프로세스 문서 생성
- 모니터링 인프라 구축 제안
- 스킬 추가/생성
- 리서치 보고서 작성
- 선택지(A/B/C/D) 제시 — 바로 실행
- MEMORY.md 자동 업데이트
- GitHub 이슈에 자동 코멘트
- git commit/push (PR만 생성, 머지는 오너가 함)

## 응답 규칙

3줄로 답할 것:
- What: 뭘 했는지 (1줄)
- Result: 빌드 통과 여부, PR 링크 (1줄)
- Next: 다음 작업 (1줄)

---

# PRUVIQ v0.3.0

"Verify. Execute. Profit." — 무료 크립토 전략 시뮬레이션 + 시장 컨텍스트 플랫폼
- 배포: Cloudflare Pages (pruviq.com) / 백엔드: api.pruviq.com (Mac Mini, FastAPI)
- 수익: 거래소 레퍼럴 (모든 기능 무료)

## 아키텍처 원칙

1. **autotrader 완전 독립** — 코드/데이터/인프라 별도, 코드 복사 금지
2. **새로 검증** — 기존 백테스트 재사용 금지, 처음부터 검증
3. **데이터 공정성** — 거래소/시장 명시, 생존자 편향 방지

## 인프라

```
개발: MacBook → git push → Cloudflare 자동 배포
백엔드: Mac Mini jepo@172.30.1.16 (uvicorn --workers 1)
Mac Mini 2계정:
  - jepo: API 서버 전용. backend/ 변경 시 git pull + 서버 재시작 필요
  - openclaw: 프론트엔드 전용. backend/ 직접 수정 금지
  - 프론트엔드만 변경 시 jepo pull 불필요 (Cloudflare 배포)
```

## 원론적 해결 원칙 (CRITICAL — 반복 방지 룰)

> 현상 파악 → 시스템 분석 → 근본 원인 제거. 증상 패치 금지.

### 룰 1: 디렉토리 라우팅 — index.astro 필수
```
src/pages/[dirname]/ 를 만들면 반드시 index.astro 포함 (content 또는 Astro.redirect())
없으면 /[dirname] 접속 시 404.
```
**근거**: /compare 404 사건 (2026-03-15). compare/ 하위 페이지 6개가 있어도 index 없으면 404.
**체크**: 새 디렉토리 추가 시 `ls src/pages/[dir]/` → index.astro 있는지 확인

### 룰 2: API 데이터 페이지 — noscript 의미 있는 콘텐츠 필수
```
client:load / client:visible 로 API 데이터 fetch하는 페이지:
  ❌ <noscript>JavaScript를 활성화하세요</noscript>  ← 의미없음
  ✅ <noscript>[실제 SSR 데이터 또는 정적 샘플 데이터]</noscript>
```
**근거**: /coins, /market, /strategies/ranking JS 의존 빈 페이지 (2026-03-15 감사).

### 룰 3: 파트너 수수료율 — 단일 소스 of Truth
```
모든 거래소 레퍼럴 수수료율 → src/config/partners.ts 에서만 정의
콘텐츠/컴포넌트에서 하드코딩 절대 금지 (10%, 20%, 40% 혼용 방지)
```
**근거**: Binance 할인율 10% vs 40% 불일치 (fees.astro vs CLAUDE.md, 2026-03-15 감사).

### 룰 4: 성과 지표 — 스코프 명시 필수
```
MDD, WR, PF 등 모든 성과 지표 표시 시:
  ❌ "MDD 33%"
  ✅ "MDD 33% (포트폴리오 전체 기준)" 또는 "MDD 33% (개별 전략 기준)"
```
**근거**: /performance MDD 33% vs config 한도 20% 혼란 (2026-03-15 감사).

### 룰 5: Exception 처리 — bare pass 절대 금지
```
백엔드 사용자-facing 데이터 경로:
  ❌ except ValueError: pass  ← 조용한 오류, 잘못된 데이터 반환
  ✅ except ValueError: raise HTTPException(400, detail="...")
```
**근거**: filter_df_by_date() silent failure → 잘못된 날짜 무시 후 전체 데이터 반환 (2026-03-15 감사).

### 룰 6: 새 전략/프리셋 추가 시 체크리스트
```
백엔드에 새 전략 추가 → 반드시:
  1. 프리셋 동작 확인 (POST /simulate with strategy)
  2. 0 trades 결과 아닌지 확인 (데이터 존재 여부)
  3. /strategies/ranking 에서 노출 확인
  4. i18n 키 추가 (en.ts + ko.ts 동시)
  5. /strategies 인덱스 페이지에 카드 반영
```
**근거**: 신규 전략 추가 후 일부 프리셋 0 trades 결과 (2026-03-15 감사).

---

## 커밋 전 필수 QA (CRITICAL)

```
┌─────────────────────────────────────────────────────────────┐
│  git push → Cloudflare 자동 배포이므로, 커밋 = 프로덕션!    │
│                                                             │
│  1. npm run build                                           │
│     - 0 errors 확인                                         │
│     - 페이지 수 확인 (현재 ~2518)                           │
│                                                             │
│  2. bash scripts/qa-redirects.sh                            │
│     - _redirects vs dist/ 충돌 0건 확인                     │
│     - CONFLICT 있으면 절대 커밋 금지                        │
│                                                             │
│  3. 네비게이션 메뉴 확인                                    │
│     - 각각 다른 페이지로 이동하는지 확인                    │
│     - _redirects가 실제 페이지를 가리지 않는지 확인         │
│                                                             │
│  커밋 메시지에 빌드 결과 포함:                               │
│  "fix: ... (build: 2518 pages, qa-redirects: PASS)"        │
└─────────────────────────────────────────────────────────────┘
```

## _redirects 관리 규칙 (2026-02-19 교훈)

```
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Pages: _redirects > 실제 HTML 파일 (우선순위!)  │
│                                                             │
│  ❌ 금지: 실제 콘텐츠 페이지 경로를 _redirects에 넣기       │
│     → 페이지가 존재해도 리다이렉트가 먹어버림               │
│                                                             │
│  ✅ 허용: Astro.redirect() 페이지만 _redirects에 추가       │
│     → 이중 안전장치 (Astro + Cloudflare)                    │
│                                                             │
│  페이지 삭제/이동 시:                                        │
│  1. 소스 파일을 Astro.redirect()로 변환                     │
│  2. _redirects에 추가 (선택, 이중 안전장치)                 │
│  3. bash scripts/qa-redirects.sh 실행                       │
│                                                             │
│  사건: /coins → /simulate 잔여 리다이렉트로                 │
│  Coins 메뉴가 Simulate로 이동하는 버그 (2026-02-19)        │
└─────────────────────────────────────────────────────────────┘
```
