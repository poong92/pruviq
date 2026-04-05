# OKX Broker 아키텍처 문서
> 문서 읽기 완료 (2026-04-04): Overview, Trading Account, Order Book, Algo Order, Broker OAuth/Commission

## 0. API 기본 정보

### Base URL
- 프로덕션: `https://www.okx.com`
- 데모: 동일 URL + 헤더 `x-simulated-trading: 1`
- WebSocket: `wss://ws.okx.com:8443/ws/v5/private`

### 인증 (HMAC SHA256)
```
OK-ACCESS-KEY: API key
OK-ACCESS-SIGN: Base64(HMAC-SHA256(timestamp + method + path + body, secret))
OK-ACCESS-TIMESTAMP: ISO 8601 UTC
OK-ACCESS-PASSPHRASE: passphrase
```

### 핵심 엔드포인트 (우리가 사용할 것)

| 용도 | Method | Path | Rate Limit |
|------|--------|------|-----------|
| 잔고 조회 | GET | /api/v5/account/balance?ccy=USDT | 10/2s |
| 포지션 조회 | GET | /api/v5/account/positions | 10/2s |
| 주문 실행 | POST | /api/v5/trade/order | per instId |
| 복수 주문 | POST | /api/v5/trade/batch-orders | per instId |
| 포지션 종료 | POST | /api/v5/trade/close-position | per instId |
| SL/TP 알고 | POST | /api/v5/trade/order-algo | per instId |
| 주문 취소 | POST | /api/v5/trade/cancel-order | per instId |
| 리베이트 조회 | GET | /api/v5/broker/fd/rebate-per-orders | 2/min |
| 유저 리베이트 | GET | /api/v5/broker/fd/if-rebate | 2/s |

### Place Order 핵심 파라미터
```json
{
  "instId": "BTC-USDT-SWAP",
  "tdMode": "isolated",
  "side": "sell",
  "ordType": "market",
  "sz": "1",
  "tag": "PRUVIQ"
}
```

### Algo Order (SL/TP) 핵심 파라미터
```json
{
  "instId": "BTC-USDT-SWAP",
  "tdMode": "isolated",
  "side": "sell",
  "ordType": "conditional",
  "sz": "1",
  "slTriggerPx": "42000",
  "slOrdPx": "-1",
  "tpTriggerPx": "48000",
  "tpOrdPx": "-1",
  "tag": "PRUVIQ"
}
```
> slOrdPx/tpOrdPx = "-1" → 시장가 실행

## 1. Broker 유형 비교

| 유형 | 설명 | 유저 자금 | API key | 커미션 |
|------|------|----------|---------|--------|
| **DMA** | 우리가 sub-account 관리 | 우리 통제 | 우리가 생성 | 최대 50% |
| **FD API** | 유저가 OKX key 제공 | 유저 통제 | 유저가 생성 | 최대 50% |
| **FD OAuth** | OKX 로그인 → 자동 연결 | 유저 통제 | 자동 생성 | 최대 50% |

**PRUVIQ 선택: FD OAuth Broker** — 진입장벽 최소, 보안 최대

## 2. OAuth 인증 플로우

### Authorization Code Mode (서버 있을 때)
```
1. 유저 → pruviq.com/connect/okx 클릭
2. → OKX 로그인 페이지로 redirect
   URL: https://www.okx.com/oauth/authorize
   params: client_id, redirect_uri, scope=trade, state
3. 유저 승인 → redirect_uri?code=XXX&state=YYY
4. 백엔드: POST /oauth/token (code + client_secret → access_token + refresh_token)
5. access_token으로 API 호출 (Authorization: Bearer {token})
```

### 토큰 관리
- Access Token: 1시간 만료
- Refresh Token: 3일 만료
- 갱신 시 이전 토큰 즉시 무효

### Permissions (Scope)
- `read_only`: 잔고, 포지션, 주문 조회
- `trade`: 주문 실행, 취소

## 3. 핵심 API 엔드포인트

### 주문 (tag=PRUVIQ 필수)
```
POST /api/v5/trade/order          — 단일 주문
POST /api/v5/trade/batch-orders   — 복수 주문
POST /api/v5/trade/close-position — 포지션 종료
POST /api/v5/trade/order-algo     — 알고 주문 (SL/TP)
```

### 조회
```
GET  /api/v5/account/positions    — 포지션 조회
GET  /api/v5/account/balance      — 잔고 조회
GET  /api/v5/trade/orders-pending — 미체결 주문
```

### 커미션
```
GET  /api/v5/broker/fd/rebate-per-orders  — 리베이트 조회
POST /api/v5/broker/fd/rebate-per-orders  — 리베이트 다운로드 생성
GET  /api/v5/broker/fd/if-rebate          — 유저 리베이트 자격 확인
```

## 4. 전체 아키텍처

```
사용자 (브라우저)
  │
  ├─ 시뮬레이션 (기존 PRUVIQ)
  │   └─ 전략 선택 → 백테스트 → 결과 확인
  │
  ├─ "Execute on OKX" 버튼
  │   └─ OAuth 로그인 (처음 1회)
  │
  └─ 실거래 실행
      └─ PRUVIQ 백엔드 → OKX API (tag=PRUVIQ)

PRUVIQ 백엔드 (api.pruviq.com)
  │
  ├─ /auth/okx/start     — OAuth 시작 (redirect)
  ├─ /auth/okx/callback   — 토큰 수신
  ├─ /execute/order       — 시뮬 결과 → OKX 주문
  ├─ /execute/positions   — 포지션 조회
  └─ /execute/close       — 포지션 종료

OKX
  ├─ 자금 보관 (유저 계정)
  ├─ 주문 실행 (우리 tag로)
  └─ 커미션 지급 (수수료의 최대 50%)
```

## 5. Broker 신청 시 필요 정보

1. 컨택 이메일
2. 신청자 영문 성함
3. 웹사이트 URL
4. 서비스 소개
5. 로고 URL (구글 드라이브 공개 링크)
6. 서버 IP 주소

### 신청 후 OKX에서 제공
- client_id
- client_secret
- Broker code (tag용)
- Dashboard 접근 권한

## 6. 구현 Phase

| Phase | 내용 | 선행 조건 |
|-------|------|----------|
| **0** | Broker 신청 + 승인 | Jun 회신 |
| **1** | OAuth 플로우 (로그인→토큰) | client_id/secret |
| **2** | 주문 실행 (시뮬→실거래) | Phase 1 + 데모모드 |
| **3** | SL/TP 자동 관리 (algo order) | Phase 2 |
| **4** | 대시보드 (실거래 현황) | Phase 3 |
| **5** | 공개 베타 | Phase 4 + 테스트 |

## 7. 보안 원칙

1. 유저 자금 절대 만지지 않음 (OKX 보관)
2. OAuth 토큰만 보관 (API key 직접 보관 안 함)
3. Access token 1시간 만료 (서버 메모리에만)
4. Refresh token 3일 (암호화 저장)
5. IP whitelist 적용
6. tag=PRUVIQ 모든 주문에 필수 (커미션 귀속)

## 8. 커미션 구조

- 유저 거래 수수료의 최대 50%
- Affiliate(30%) 대비 +20%
- CSV 다운로드: /api/v5/broker/fd/rebate-per-orders
- 데이터 처리: 2-3시간 후 다운로드 가능
- 최대 180일 범위 조회

## 9. 기존 프로토타입 vs 필요한 것

### 있는 것 (okx_broker_prototype.py, 623줄)
- HMAC SHA256 인증 ✅
- place_order, get_positions, cancel_order, get_balance ✅
- pruviq_to_okx_inst_id 심볼 매핑 ✅
- 데모 모드 ✅

### 필요한 것 (OAuth 전환)
- OAuth 플로우 (authorization code → token)
- Token 갱신 로직
- FastAPI 엔드포인트 (/auth/okx/*)
- tag=PRUVIQ 주문 래핑
- 프론트엔드 "Execute on OKX" UI
