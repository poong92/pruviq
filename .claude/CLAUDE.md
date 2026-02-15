# PRUVIQ

"Don't Believe. Verify." — 무료 크립토 전략 시뮬레이션 + 시장 컨텍스트 플랫폼

## 프로젝트 상태

```
버전: v0.1.3 (콘텐츠 피봇 완료)
Phase: 0 (기반 구축) → v0.2.0 준비 중
시작일: 2026-02-14
상태: 시뮬레이션 플랫폼으로 전환 완료, 인터랙티브 데모 준비
GitHub: poong92/pruviq-website (→ pruviq로 rename 예정)
배포: Cloudflare Pages (pruviq.com)

v0.1.x 완료 (2026-02-15):
  ✅ 모노레포 구조 (Astro + Python backend)
  ✅ SimulationEngine 5/5 테스트 PASS
  ✅ 랜딩 페이지: "live trading" → "simulation platform" 전환
  ✅ 전체 콘텐츠 "verified" 프레이밍 (12개 파일)
  ✅ autotrader 참조 제거 (fees, strategies, blog)
  ✅ P0 UX 버그 수정 (nav CTA 링크)
  ✅ 비즈니스 모델 문서 (무료 + 레퍼럴)
  ✅ 블로그 9개 + 전략 5개 + Graveyard + Changelog

버전 체계:
  v0.1.x — 기반 뼈대 (완료)
  v0.2.x — 시뮬레이션 데모 (다음)
  v0.3.x — 시장 컨텍스트
  v0.5.x — 테스트 오픈 (베타)
  v0.8.x — 오픈 준비 완료
  v1.0.0 — 정식 출시
```

## 핵심 콘셉트

### 기둥 1: 전략 시뮬레이션 (핵심 차별점)
- 사용자가 전략 선택 → 객관적 성과 데이터 제공
- 500+ 코인, 2년+ 데이터, 현실적 비용 모델링
- 코딩 불필요 — 파라미터 조정만으로 시뮬레이션
- 오픈소스 엔진 (투명성)

### 기둥 2: 시장 컨텍스트
- 뉴스, 이벤트, 거시경제, 시황 요약
- 전략 성과와 시장 이벤트 연결
- BTC 도미넌스, Fear & Greed, 펀딩률 등

### 수익 모델: 무료 + 레퍼럴
- 모든 기능 무료 (유료 티어 없음)
- 수익 = 거래소 레퍼럴 (Bybit 50%, Binance 20-41%)
- 자연스러운 통합: 시뮬레이션 → "실거래하려면?" → 할인 레퍼럴
- 투명한 공개: "커미션으로 무료 유지"

## 핵심 원칙

1. **autotrader와 완전 독립** — 코드/데이터/인프라 별도
2. **새로 검증** — 기존 백테스트 재사용 금지, 처음부터 검증
3. **데이터 공정성** — 거래소/시장 명시, 생존자 편향 방지
4. **단계적 고도화** — 한 단계씩 쌓아올리기
5. **투명성** — 비용 모델링 명시, 실패 전략도 공개
6. **무료 우선** — 유료 벽 없음, 레퍼럴만

## 디렉토리 구조 (모노레포)

```
pruviq/
├── src/                    # Astro 프론트엔드
│   ├── content/
│   │   ├── blog/           # 교육 블로그 (9개)
│   │   └── strategies/     # 전략 라이브러리 (5개)
│   ├── layouts/
│   ├── pages/
│   │   ├── index.astro     # 랜딩
│   │   ├── fees.astro      # 수수료 비교 (레퍼럴)
│   │   ├── graveyard.astro # 실패 전략 아카이브
│   │   └── strategies/     # 전략 상세
│   └── styles/
├── backend/                # Python 시뮬레이션 엔진
│   ├── src/
│   │   ├── data/           # 데이터 수집 (ccxt)
│   │   ├── simulation/     # 엔진 (engine.py)
│   │   ├── strategies/     # 전략 프로토콜
│   │   └── market_context/ # 시장 컨텍스트
│   ├── scripts/            # CLI 스크립트
│   ├── tests/              # pytest
│   └── requirements.txt
├── docs/                   # 설계 문서
├── public/                 # 정적 파일
└── package.json            # Astro 프론트엔드
```

## 인프라

- 개발: MacBook (jplee) ~/Desktop/pruviq-website
- 프론트엔드: Cloudflare Pages (pruviq.com)
- 백엔드 API: Mac Mini (jepo) :8400 (Phase 1+)
- autotrader 서버 (DO): 절대 건드리지 않음

## autotrader와의 관계

- autotrader = 재풍이 개인 투자 (건드리지 않음)
- pruviq = autotrader 경험 기반 새 서비스
- 코드 복사 금지 — 개념만 참고, 구현은 처음부터
- 실거래 결과 공개 금지 — 시뮬레이션 결과만 제공

## 로드맵

```
Phase 0: 기반 구축 ✅ (2026-02-15 완료)
  ✅ 모노레포 구조 (Astro + Python backend)
  ✅ 시뮬레이션 엔진 (5/5 테스트, look-ahead 방지)
  ✅ 콘텐츠 피봇 (simulation 프레이밍)
  ✅ UX 감사 + P0 수정

v0.2.0: 시뮬레이션 데모 (다음 목표)
  - Interactive Strategy Demo (SL/TP 슬라이더, 즉시 결과)
  - Pre-computed 25 파라미터 조합 (JSON, client-side)
  - Strategy vs Buy & Hold 비교 차트
  - 이메일 캡처 (전환 퍼널 시작)

v0.3.0: 시장 컨텍스트
  - 이벤트 어노테이션 (equity curve + 시장 이벤트)
  - BTC 도미넌스, Fear & Greed 표시
  - FastAPI 백엔드 (Mac Mini)

v0.5.0: 테스트 오픈 (베타)
  - 50명 유저 테스트
  - 파라미터 커스텀 UI
  - 멀티 전략 비교

v0.8.0: 오픈 준비
  - 거래소 Affiliate 연동
  - 커뮤니티 기능
  - AI 시황 요약 (Ollama)

v1.0.0: 정식 출시
```
