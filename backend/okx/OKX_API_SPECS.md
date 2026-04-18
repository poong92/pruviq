# OKX API Specs — PRUVIQ Complete Reference

> Source: OKX official docs (broker_en, trick_en, en/#overview). Compiled 2026-04-18.
> Scope: Perpetual SWAP autotrading (FD Broker OAuth + HMAC API key flow).

---

## 1. OAuth / Fast API Flow

### Key URLs

| Purpose | Method | URL |
|---------|--------|-----|
| Authorize (browser) | GET redirect | `https://www.okx.com/account/oauth/authorize` |
| Token exchange | POST | `https://www.okx.com/v5/users/oauth/token` ← **NO `/api/` prefix** |
| Create API key | POST | `https://www.okx.com/api/v5/users/oauth/apikey` |

> ⚠️ `/api/v5/oauth/*` → 404. Token endpoint is `/v5/users/oauth/token` (no `/api/`).

### Authorize URL Query Params

| Param | Required | Notes |
|-------|----------|-------|
| `client_id` | Yes | |
| `response_type` | Yes | `"code"` |
| `redirect_uri` | Yes | must exactly match portal-registered URL |
| `scope` | Yes | **`"fast_api"`** — REQUIRED. `"read_only,trade"` silently routes to `/account/users`. |
| `state` | Yes | CSRF token |
| `access_type` | No | `"offline"` for refresh_token |
| `channelId` | No | broker code for affiliate tracking |

### Token Exchange (`POST /v5/users/oauth/token`)

Content-Type: `application/x-www-form-urlencoded`

| Param | Required | Value |
|-------|----------|-------|
| `client_id` | Yes | |
| `client_secret` | Yes | |
| `grant_type` | Yes | `"authorization_code"` |
| `code` | Yes | from callback |
| `redirect_uri` | Yes | must match registered |

Response: `access_token` (1h TTL), `refresh_token` (3d TTL), `uid`

### Refresh Token (same endpoint)

| Param | Required | Value |
|-------|----------|-------|
| `client_id` | Yes | |
| `client_secret` | Yes | |
| `grant_type` | Yes | `"refresh_token"` |
| `refresh_token` | Yes | current token |

> Old access_token immediately invalidated on refresh. New refresh_token also returned.

### Create API Key (`POST /api/v5/users/oauth/apikey`)

Auth: `Authorization: Bearer {access_token}` (one-time)

| Param | Required | Notes |
|-------|----------|-------|
| `label` | Yes | max 50 chars |
| `passphrase` | Yes | 8–32 chars, ≥1 upper + lower + digit + special |
| `perm` | No | `"read_only"`, `"trade"`, `"read_only,trade"` |
| `ip` | No | up to 20 comma-separated IPs — **strongly recommended** |

Response: `apiKey`, `secretKey`, `perm`

> Keys with trade perm + no IP binding expire after **14 days of inactivity**.

### OAuth Error Codes

| Code | Meaning |
|------|---------|
| 53000 | Invalid token |
| 53001 | Authorization canceled |
| 53002 | Token expired |
| 53003 | Token revoked |
| 53004 | Account frozen |
| 53005 | Wrong refresh token |
| 53009 | Authorization failed |
| 53010 | Parameter error (e.g. wrong client_id) |
| 53012 | Authorization code expired |
| 53013 | No permission to access API |
| 53014 | Invalid IP |
| 53016 | Invalid redirect_uri |
| **53017** | **Fast API permissions not enabled — BD must activate** |

---

## 2. HMAC Authentication (API Key)

### Required Headers

| Header | Value |
|--------|-------|
| `OK-ACCESS-KEY` | API key |
| `OK-ACCESS-SIGN` | `Base64(HMAC-SHA256(timestamp + METHOD + requestPath + body, secretKey))` |
| `OK-ACCESS-TIMESTAMP` | ISO 8601 UTC ms, e.g. `2020-12-08T09:08:57.715Z` |
| `OK-ACCESS-PASSPHRASE` | passphrase set at key creation |
| `x-simulated-trading` | `"1"` for demo mode |

### Signature Rules

```python
pre_hash = timestamp + METHOD.upper() + requestPath + body
sign = base64.b64encode(hmac.new(secret.encode(), pre_hash.encode(), sha256).digest()).decode()
```

- GET: `requestPath` = path + `?querystring`; `body` = `""`
- POST: `requestPath` = path only; `body` = JSON string
- Timestamp deviation > 30s → error `50102`
- Content-Type: `application/json` for POST

### Demo Trading

- REST: same `https://www.okx.com` + header `x-simulated-trading: 1`
- WS Public: `wss://wspap.okx.com:8443/ws/v5/public`
- WS Private: `wss://wspap.okx.com:8443/ws/v5/private`
- Demo API keys do **NOT** expire from inactivity (unlike production keys)

---

## 3. Rate Limits

| Rule | Value |
|------|-------|
| General rate limit error | `50011` |
| Sub-account rate limit error | `50061` |
| Max orders/account | 4,000 |
| Max orders/instrument | 500 |
| Sub-account order cap | 1,000 req/2s |
| WebSocket subscriptions | 480 ops/hr/connection; 30 connections/channel/sub-account |
| Place order rate limit | 60 req/2s per instId (SPOT/SWAP/FUTURES) |
| Cancel order rate limit | 60 req/2s per instId |
| Batch orders | 300 orders/2s per instId, max 20/request |
| Algo orders | 20 req/2s |
| Close position | 20 req/2s |

### Pending Algo Limits

| Type | Limit |
|------|-------|
| TP/SL per instrument | 100 |
| Trigger orders total | 500 |
| Trailing stop total | 50 |
| Iceberg total | 100 |
| TWAP total | 20 |

---

## 4. Account Endpoints

### GET /api/v5/account/balance

Rate: 10 req/2s | Permission: Read

| Param | Required | Notes |
|-------|----------|-------|
| `ccy` | No | comma-separated, max 20 |

Key response fields (account level): `totalEq`, `adjEq`, `availEq`, `imr`, `mmr`, `mgnRatio`, `upl`, `notionalUsd`, `uTime`, `details[]`

Key response fields (details[] per currency): `ccy`, `eq`, `cashBal`, `availBal`, `frozenBal`, `ordFrozen`, `liab`, `interest`, `upl`, `isoEq`, `crossLiab`, `isoLiab`, `imr`, `mmr`, `eqUsd`

### GET /api/v5/account/positions

Rate: 20 req/2s | Permission: Read

| Param | Required | Notes |
|-------|----------|-------|
| `instType` | No | `MARGIN`, `SWAP`, `FUTURES`, `OPTION` |
| `instId` | No | |
| `posId` | No | comma-separated, max 20 |

Key response fields: `posId`, `instId`, `instType`, `mgnMode`, `posSide`, `pos`, `availPos`, `avgPx`, `upl`, `uplRatio`, `lever`, `liqPx`, `imr`, `mmr`, `mgnRatio`, `notionalUsd`, `cTime`, `uTime`

### GET /api/v5/account/positions-history

Rate: 20 req/2s | Permission: Read

| Param | Required | Notes |
|-------|----------|-------|
| `instType` | Yes | `SWAP`, `FUTURES`, etc. |
| `instId` | No | |
| `mgnMode` | No | `isolated`, `cross` |
| `posId` | No | |
| `after` | No | pagination |
| `before` | No | pagination |
| `limit` | No | max 100 |

Key response fields: `instId`, `openAvgPx`, `closeAvgPx`, `pnl`, `pnlRatio`, `realizedPnl`, `fee`, `fundingFee`, `liqPenalty`, `openTime`, `closeTime`, `lever`, `posId`

### GET /api/v5/account/config

Rate: 10 req/2s | Permission: Read | No params

Key response fields: `uid`, `acctLv`, `posMode` (`net_mode`/`long_short_mode`), `autoLoan`, `greeksType`, `level`, `perm`

### POST /api/v5/account/set-position-mode

Rate: 5 req/2s | Permission: Trade

| Param | Required | Values |
|-------|----------|--------|
| `posMode` | Yes | `long_short_mode`, `net_mode` |

> Must close all positions and cancel all orders first.

### POST /api/v5/account/set-leverage

Rate: 20 req/2s | Permission: Trade

| Param | Required | Notes |
|-------|----------|-------|
| `instId` | Cond. | for per-instrument |
| `ccy` | Cond. | for cross-margin per-currency |
| `lever` | Yes | string, e.g. `"10"` |
| `mgnMode` | Yes | `isolated`, `cross` |
| `posSide` | Cond. | `long`, `short`, `net` — required for isolated long/short mode |

### GET /api/v5/account/leverage-info

Rate: 20 req/2s | Permission: Read

| Param | Required |
|-------|----------|
| `instId` | Yes |
| `mgnMode` | Yes |

Response: `instId`, `mgnMode`, `posSide`, `lever`

### GET /api/v5/account/trade-fee

Rate: 5 req/2s | Permission: Read

Response: `level`, `maker`, `taker`, `makerU`, `takerU`, `makerUSDC`, `takerUSDC`, `deliveryFeeRate`

### GET /api/v5/account/max-size

Rate: 20 req/2s | Permission: Read

| Param | Required | Notes |
|-------|----------|-------|
| `instId` | Yes | |
| `tdMode` | Yes | `cash`, `isolated`, `cross` |
| `px` | No | price for limit orders |
| `leverage` | No | |

Response: `instId`, `availBuy`, `availSell`

### GET /api/v5/account/bills

Rate: 10 req/2s | Permission: Read

Params: `instType`, `ccy`, `mgnMode`, `type`, `subType`, `after`, `before`, `begin`, `end`, `limit` (max 100)

Response fields: `billId`, `ccy`, `instId`, `ordId`, `tradeId`, `balChg`, `pnl`, `fee`, `execType`, `ts`

---

## 5. Trading Endpoints

### POST /api/v5/trade/order — Place Order

Rate: 60 req/2s per instId | Permission: Trade

| Param | Type | Required | Values |
|-------|------|----------|--------|
| `instId` | String | Yes | e.g. `BTC-USDT-SWAP` |
| `tdMode` | String | Yes | `cash`, `cross`, `isolated`, `spot_isolated` |
| `side` | String | Yes | `buy`, `sell` |
| `ordType` | String | Yes | `market`, `limit`, `post_only`, `fok`, `ioc`, `optimal_limit_ioc` |
| `sz` | String | Yes | contracts for SWAP/FUTURES; base ccy for SPOT |
| `px` | String | Cond. | required for `limit`, `post_only`, `fok`, `ioc` |
| `posSide` | String | Cond. | `long`, `short`, `net` — required in long/short mode |
| `clOrdId` | String | No | max 32 alphanumeric |
| `tag` | String | No | **broker code — required for commission** |
| `reduceOnly` | Boolean | No | close-only |
| `tgtCcy` | String | No | `base_ccy`, `quote_ccy` — SPOT market orders only |
| `stpMode` | String | No | `cancel_maker` (default), `cancel_taker`, `cancel_both` |
| `tpTriggerPx` | String | No | attached TP trigger |
| `tpOrdPx` | String | No | `-1` = market |
| `slTriggerPx` | String | No | attached SL trigger |
| `slOrdPx` | String | No | `-1` = market |
| `quickMgnType` | String | No | `manual`, `auto_borrow`, `auto_repay` |

Response: `ordId`, `clOrdId`, `tag`, `sCode` (`"0"` = success), `sMsg`, `ts`

### POST /api/v5/trade/batch-orders

Rate: 300 orders/2s | Max 20/request | Same params as place order (array)

### POST /api/v5/trade/cancel-order

Rate: 60 req/2s per instId | Permission: Trade

| Param | Required | Notes |
|-------|----------|-------|
| `instId` | Yes | |
| `ordId` | Cond. | either `ordId` or `clOrdId` required |
| `clOrdId` | Cond. | |

Response: `ordId`, `clOrdId`, `sCode`, `sMsg`

### POST /api/v5/trade/cancel-batch-orders

Rate: 300 orders/2s | Max 20/request | Array of cancel-order objects

### POST /api/v5/trade/amend-order

Rate: 60 req/2s per instId | Permission: Trade

| Param | Required | Notes |
|-------|----------|-------|
| `instId` | Yes | |
| `ordId` | Cond. | |
| `clOrdId` | Cond. | |
| `newSz` | Cond. | either `newSz` or `newPx` required |
| `newPx` | Cond. | |
| `cxlOnFail` | No | cancel if amendment fails |
| `reqId` | No | client request ID, max 32 chars |

### POST /api/v5/trade/close-position

Rate: 20 req/2s | Permission: Trade

| Param | Required | Notes |
|-------|----------|-------|
| `instId` | Yes | |
| `mgnMode` | Yes | `cross`, `isolated` |
| `posSide` | Cond. | required in long/short mode |
| `ordType` | No | `market` (default), `limit` |
| `px` | Cond. | required if `ordType=limit` |
| `sz` | No | omit to close entire position |
| `tag` | No | broker code |
| `autoCxl` | No | auto-cancel pending orders on close |
| `clOrdId` | No | max 32 chars |

Response: `instId`, `posSide`

### POST /api/v5/trade/cancel-all-after

Rate: 1 req/s | Permission: Trade

| Param | Required | Notes |
|-------|----------|-------|
| `timeOut` | Yes | seconds, 0–300. `0` cancels countdown |

Response: `triggerTime` (ms), `ts`

### GET /api/v5/trade/order — Get Order Details

Rate: 20 req/2s | Permission: Read

| Param | Required |
|-------|----------|
| `instId` | Yes |
| `ordId` or `clOrdId` | one required |

Key response fields: `ordId`, `clOrdId`, `state` (`live`/`partially_filled`/`filled`/`canceled`), `avgPx`, `accFillSz`, `fillPx`, `fee`, `feeCcy`, `pnl`, `lever`, `cTime`, `uTime`

### GET /api/v5/trade/orders-pending — Pending Orders

Rate: 20 req/2s | Permission: Read

Params: `instType`, `instId`, `ordType`, `state` (`live`/`partially_filled`), `after`, `before`, `limit` (max 100)

### GET /api/v5/trade/orders-history — Order History (7 days)

Rate: 20 req/2s | Permission: Read

Required: `instType`. Optional: `instId`, `state` (`canceled`/`filled`), `after`, `before`, `begin`, `end`, `limit`

### GET /api/v5/trade/fills — Transaction Details (3 days)

Rate: 20 req/2s | Permission: Read

Params: `instType`, `instId`, `ordId`, `after`, `before`, `begin`, `end`, `limit`

Response: `tradeId`, `ordId`, `fillPx`, `fillSz`, `side`, `execType` (`T`/`M`), `fee`, `feeCcy`, `ts`

---

## 6. Algo Trading Endpoints

### POST /api/v5/trade/order-algo — Place Algo Order

Rate: 20 req/2s | Permission: Trade

| Param | Required | Values |
|-------|----------|--------|
| `instId` | Yes | |
| `tdMode` | Yes | `cross`, `isolated`, `cash` |
| `side` | Yes | `buy`, `sell` |
| `ordType` | Yes | `conditional`, `oco`, `trigger`, `move_order_stop`, `iceberg`, `twap` |
| `sz` | Yes | |
| `posSide` | Cond. | required in long/short mode |
| `algoClOrdId` | No | max 32 chars |
| `tag` | No | broker code |
| `reduceOnly` | No | |
| `closeFraction` | No | 0–1, for futures/perp only |
| `cxlOnClosePos` | No | cancel algo when position closes |

**TP/SL (conditional/oco):**
- `tpTriggerPx`, `tpOrdPx` (`-1`=market), `tpTriggerPxType` (`last`/`index`/`mark`)
- `slTriggerPx`, `slOrdPx` (`-1`=market), `slTriggerPxType`

**Trigger order:**
- `triggerPx`, `orderPx` (`-1`=market), `triggerPxType`

**Trailing stop (move_order_stop):**
- `callbackRatio` (0.01=1%) or `callbackSpread`
- `activePx` (activation price)

**Iceberg/TWAP:**
- `pxVar` or `pxSpread`, `szLimit`, `pxLimit`
- `timeInterval` (seconds, TWAP only)

Response: `algoId`, `algoClOrdId`, `sCode`, `sMsg`

### POST /api/v5/trade/cancel-algos

Rate: 20 req/2s | Array of `{instId, algoId}` objects

### GET /api/v5/trade/order-algo — Get Algo Details

Rate: 20 req/2s | Params: `algoId` or `algoClOrdId`

Key response fields: `algoId`, `ordType`, `state` (`live`/`effective`/`canceled`/`order_failed`), `triggerTime`, `actualSz`, `actualPx`, `failCode`

### GET /api/v5/trade/orders-algo-pending — Pending Algos

Rate: 20 req/2s | Required: `ordType`

---

## 7. Public Data Endpoints

### GET /api/v5/public/instruments

Rate: 20 req/2s | No auth required

| Param | Required | Values |
|-------|----------|--------|
| `instType` | Yes | `SPOT`, `MARGIN`, `SWAP`, `FUTURES`, `OPTION` |
| `instFamily` | Cond. | required for `OPTION` |
| `instId` | No | |

Key response fields for SWAP:

| Field | Description |
|-------|-------------|
| `instId` | e.g. `BTC-USDT-SWAP` |
| `ctVal` | Notional value per contract |
| `ctMult` | Contract multiplier |
| `ctType` | `linear` (USDT-margined) / `inverse` (coin-margined) |
| `settleCcy` | Margin/settlement currency |
| `minSz` | Minimum order size (contracts) |
| `lotSz` | Order size increment (must be multiple) |
| `tickSz` | Minimum price increment |
| `lever` | Maximum leverage |
| `state` | `live`, `suspend`, `preopen` |
| `maxLmtSz` | Max single limit order qty |
| `maxMktSz` | Max single market order qty |
| `maxLmtAmt` | Max USD per limit order |
| `maxMktAmt` | Max USD per market order |

### GET /api/v5/public/mark-price

| Param | Required | Values |
|-------|----------|--------|
| `instType` | Yes | `SWAP`, `FUTURES`, etc. |
| `instId` | No | |

Response: `instId`, `instType`, `markPx`, `ts`

### GET /api/v5/public/funding-rate

| Param | Required |
|-------|----------|
| `instId` | Yes |

Response: `instId`, `fundingRate`, `nextFundingRate`, `fundingTime` (next settlement ms)

### GET /api/v5/public/funding-rate-history

| Param | Required | Notes |
|-------|----------|-------|
| `instId` | Yes | |
| `before` | No | pagination |
| `after` | No | |
| `limit` | No | max 100 |

Response array: `fundingRate`, `realizedRate`, `fundingTime`

### GET /api/v5/public/open-interest

| Param | Required | Values |
|-------|----------|--------|
| `instType` | Yes | `SWAP`, `FUTURES`, `OPTION` |
| `instId` | No | |

Response: `instId`, `oi` (contracts), `oiCcy`, `ts`

### GET /api/v5/market/candles — Candlesticks

| Param | Required | Notes |
|-------|----------|-------|
| `instId` | Yes | |
| `bar` | No | `1m`, `3m`, `5m`, `15m`, `30m`, `1H`, `2H`, `4H`, `6H`, `12H`, `1D`, `1W` |
| `after` | No | pagination (Unix ms) |
| `before` | No | |
| `limit` | No | max 300, default 100 |

Response array fields (index order): `[ts, open, high, low, close, vol, volCcy, volCcyQuote, confirm]`
- `confirm`: `0`=unclosed, `1`=closed

### GET /api/v5/market/tickers

| Param | Required | Values |
|-------|----------|--------|
| `instType` | Yes | `SPOT`, `SWAP`, `FUTURES`, `OPTION` |
| `instFamily` | No | |

Response: `instId`, `last`, `lastSz`, `askPx`, `askSz`, `bidPx`, `bidSz`, `open24h`, `high24h`, `low24h`, `vol24h`, `volCcy24h`, `ts`

### GET /api/v5/market/ticker

| Param | Required |
|-------|----------|
| `instId` | Yes |

Same response as tickers but single instrument.

### GET /api/v5/system/status

No auth | Response: maintenance schedule, `state` (`scheduled`/`ongoing`/`completed`)

---

## 8. Instrument / Order Rules

### sz (Order Size) Rules

- **SWAP/FUTURES**: `sz` = number of **contracts** (integer multiples of `lotSz`)
- **SPOT/MARGIN**: `sz` = **base currency** quantity
- Must be ≥ `minSz`, multiple of `lotSz`
- Notional USD = `sz × ctVal × price`

### Trade Mode (`tdMode`)

| Account Mode | Instrument | Margin | tdMode |
|---|---|---|---|
| Any | Spot/Option | None | `cash` |
| Futures/Multi-ccy | Margin/Derivatives | Cross | `cross` |
| Futures/Multi-ccy | Margin/Derivatives | Isolated | `isolated` |

### Position Mode

- `net_mode`: one side only, OKX auto open/close based on positive/negative `sz`
- `long_short_mode`: hold long + short simultaneously, requires `posSide` on all orders

### Order States

`live` → `partially_filled` → `filled` (terminal)
`live` → `canceled` (terminal)

### Identifier Rules

| ID | Uniqueness |
|---|---|
| `ordId` | Globally unique |
| `clOrdId` | Unique among **pending** orders only, max 32 alphanumeric |
| `algoId` | Globally unique |
| `billId` | Globally unique |
| `tradeId` | Unique per instrument (negative = liquidation/ADL) |
| `posId` | Unique per `mgnMode` + `posSide` + `instId` + `ccy` |

---

## 9. FD Broker Commission Endpoints

| Endpoint | Method | Notes |
|----------|--------|-------|
| `/api/v5/broker/fd/rebate-per-orders` | GET | Download link (valid 2h). Required: `type` (`"true"`=all/`"false"`=range) |
| `/api/v5/broker/fd/rebate-per-orders` | POST | Generate report (max 180d). Available ~2h |
| `/api/v5/broker/fd/if-rebate` | GET | Check user rebate by `apiKey` |

Rebate eligibility `type` codes: `0`=eligible, `1`=ID expired, `2`=VIP5-6 cap, `3`=VIP7+

---

## 10. WebSocket

### Endpoints

| Mode | URL |
|------|-----|
| Production Public | `wss://ws.okx.com:8443/ws/v5/public` |
| Production Private | `wss://ws.okx.com:8443/ws/v5/private` |
| Demo Public | `wss://wspap.okx.com:8443/ws/v5/public` |
| Demo Private | `wss://wspap.okx.com:8443/ws/v5/private` |

### Private WS Auth

```json
{
  "op": "login",
  "args": [{"apiKey": "...", "passphrase": "...", "timestamp": "1538054050", "sign": "..."}]
}
```

Sign: `Base64(HMAC-SHA256(timestamp + 'GET' + '/users/self/verify', secretKey))`
- `timestamp` = Unix **seconds** (not ms)

### Key Private Channels

| Channel | Snapshot | Update |
|---------|----------|--------|
| `account` | Non-zero balances | Event-driven + 5s fixed |
| `positions` | Non-zero positions | Event-driven + 5s fixed |
| `orders` | **None** | State changes only |
| `balance_and_position` | None | Event-driven, lowest latency |
| `algo-orders` | None | State changes |

### Key Public Channels

| Channel | Frequency | Notes |
|---------|-----------|-------|
| `bbo-tbt` | 10ms | Best bid/offer |
| `books5` | 100ms | 5-level snapshot |
| `books` | 100ms | Incremental |
| `tickers` | On change | |
| `funding-rate` | On change | |
| `mark-price` | On change | |
| `instruments` | On change | |

---

## 11. Critical Notes

1. **`scope=fast_api`** required — `read_only,trade` silently fails (routes to /account/users)
2. **Token endpoint**: `/v5/users/oauth/token` — NO `/api/` prefix
3. **53017 error**: BD must activate Fast API permissions in OKX portal
4. **IP binding recommended**: keys without IP + trade perm expire after 14d inactivity
5. **Broker tag**: `tag` param required on ALL order calls for commission tracking
6. **Timestamp**: ISO 8601 UTC ms format; server rejects if >30s drift
7. **sz for SWAP**: number of contracts (integer), NOT USD/coin amount
8. **ctVal**: contracts × ctVal × price = notional USD value
9. **Position mode**: `net_mode` default; `long_short_mode` requires `posSide` on orders
10. **Account mode**: can ONLY be changed via web/mobile UI, not API
11. **Auto-borrow**: only in multi-currency/portfolio margin; only via web UI
12. **Demo API keys**: never expire from inactivity; same REST URL + `x-simulated-trading: 1`
13. **Liquidation/ADL**: do NOT generate order updates; `tradeId` is negative
14. **Cancel-All-After**: heartbeat pattern — send every <300s, `timeOut=0` to disable
15. **STP scope**: master account level, applies to all sub-accounts automatically
