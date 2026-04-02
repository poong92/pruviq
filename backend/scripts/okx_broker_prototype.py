"""
OKX Broker API 프로토타입 (테스트넷/데모 트레이딩)

PRUVIQ 시뮬레이터 → OKX 실거래 연동을 위한 백엔드 프로토타입.
데모 트레이딩 모드에서 주문 생성, 포지션 조회, 주문 취소를 수행한다.

환경변수:
    OKX_API_KEY       - OKX API key
    OKX_SECRET_KEY    - OKX secret key (HMAC SHA256 서명용)
    OKX_PASSPHRASE    - OKX API passphrase
    OKX_BROKER_CODE   - 브로커 코드 (기본값: PRUVIQ)
    OKX_DEMO_MODE     - true면 데모 트레이딩 (기본값: true)

Usage:
    # 환경변수 설정 후
    python okx_broker_prototype.py
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any

import httpx

# ---------------------------------------------------------------------------
# 로깅 설정
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("okx_broker")

# ---------------------------------------------------------------------------
# 상수
# ---------------------------------------------------------------------------
BASE_URL = "https://www.okx.com"

# 시뮬레이터 심볼 → OKX instId 매핑 (PRUVIQ는 BTCUSDT, OKX는 BTC-USDT)
# Perpetual swap 형식: BTC-USDT-SWAP
SYMBOL_MAP_SPOT: dict[str, str] = {}      # 동적 생성
SYMBOL_MAP_SWAP: dict[str, str] = {}      # 동적 생성


class Side(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"


class TdMode(str, Enum):
    """트레이딩 모드"""
    CASH = "cash"           # 현물
    ISOLATED = "isolated"   # 격리 마진
    CROSS = "cross"         # 교차 마진


class PosSide(str, Enum):
    """포지션 방향 (헤지 모드에서만 필수)"""
    LONG = "long"
    SHORT = "short"
    NET = "net"


# ---------------------------------------------------------------------------
# 심볼 변환 유틸
# ---------------------------------------------------------------------------
def pruviq_to_okx_inst_id(symbol: str, swap: bool = True) -> str:
    """
    PRUVIQ 심볼 형식을 OKX instId로 변환.

    Examples:
        BTCUSDT  → BTC-USDT-SWAP  (swap=True)
        ETHUSDT  → ETH-USDT       (swap=False, 현물)
        BTC-USDT → BTC-USDT-SWAP  (이미 OKX 형식이면 suffix만 추가)
    """
    # 이미 OKX 형식인 경우
    if "-" in symbol:
        if swap and not symbol.endswith("-SWAP"):
            return f"{symbol}-SWAP"
        return symbol

    # PRUVIQ 형식: BTCUSDT → BTC-USDT
    # 알려진 quote currencies
    for quote in ("USDT", "USDC", "USD", "BTC", "ETH"):
        if symbol.endswith(quote):
            base = symbol[: -len(quote)]
            inst_id = f"{base}-{quote}"
            if swap:
                inst_id += "-SWAP"
            return inst_id

    # 매핑 실패 — 원본 반환 + 경고
    logger.warning("심볼 변환 실패: %s → 원본 그대로 사용", symbol)
    return symbol


# ---------------------------------------------------------------------------
# OKX API 인증
# ---------------------------------------------------------------------------
@dataclass
class OKXAuth:
    """OKX HMAC SHA256 인증 헤더 생성기"""

    api_key: str
    secret_key: str
    passphrase: str
    demo_mode: bool = True

    def _sign(self, timestamp: str, method: str, request_path: str, body: str = "") -> str:
        """
        서명 생성: HMAC SHA256(secret, timestamp+method+path+body) → Base64

        OKX 문서 기준:
          prehash = timestamp + METHOD + requestPath + body
          signature = Base64(HMAC-SHA256(secret, prehash))
        """
        prehash = f"{timestamp}{method.upper()}{request_path}{body}"
        mac = hmac.new(
            self.secret_key.encode("utf-8"),
            prehash.encode("utf-8"),
            hashlib.sha256,
        )
        return base64.b64encode(mac.digest()).decode("utf-8")

    def headers(self, method: str, request_path: str, body: str = "") -> dict[str, str]:
        """인증 헤더 dict 반환"""
        # ISO 8601 UTC 타임스탬프 (밀리초 3자리)
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + \
            f"{datetime.now(timezone.utc).microsecond // 1000:03d}Z"

        sign = self._sign(timestamp, method, request_path, body)

        hdrs = {
            "OK-ACCESS-KEY": self.api_key,
            "OK-ACCESS-SIGN": sign,
            "OK-ACCESS-TIMESTAMP": timestamp,
            "OK-ACCESS-PASSPHRASE": self.passphrase,
            "Content-Type": "application/json",
        }

        # 데모 트레이딩 모드: 이 헤더가 핵심
        if self.demo_mode:
            hdrs["x-simulated-trading"] = "1"

        return hdrs


# ---------------------------------------------------------------------------
# OKX Broker Client
# ---------------------------------------------------------------------------
@dataclass
class OKXBrokerClient:
    """
    OKX 브로커 API 클라이언트.

    PRUVIQ 시뮬레이터 전략 결과를 OKX 주문으로 변환하여 실행한다.
    """

    auth: OKXAuth
    broker_code: str = "PRUVIQ"
    base_url: str = BASE_URL
    _client: httpx.Client = field(default=None, init=False, repr=False)

    def __post_init__(self) -> None:
        self._client = httpx.Client(
            base_url=self.base_url,
            timeout=httpx.Timeout(10.0, connect=5.0),
        )
        mode = "DEMO" if self.auth.demo_mode else "LIVE"
        logger.info("OKXBrokerClient 초기화 [%s] broker=%s", mode, self.broker_code)

    def close(self) -> None:
        if self._client:
            self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    # -----------------------------------------------------------------------
    # 내부 HTTP 메서드
    # -----------------------------------------------------------------------
    def _request(
        self,
        method: str,
        path: str,
        body: dict | None = None,
        params: dict | None = None,
    ) -> dict[str, Any]:
        """
        OKX API 요청 실행 + 응답 파싱.

        Returns:
            {"code": "0", "msg": "", "data": [...]}
        Raises:
            OKXAPIError: code != "0"
            httpx.HTTPError: 네트워크/타임아웃
        """
        body_str = json.dumps(body) if body else ""

        # query string이 있으면 path에 포함 (서명에 필요)
        if params:
            qs = "&".join(f"{k}={v}" for k, v in params.items())
            sign_path = f"{path}?{qs}"
        else:
            sign_path = path

        headers = self.auth.headers(method, sign_path, body_str)

        logger.debug("→ %s %s body=%s", method, sign_path, body_str[:200] if body_str else "")

        try:
            resp = self._client.request(
                method=method,
                url=sign_path,
                content=body_str if body_str else None,
                headers=headers,
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error("HTTP %d: %s", e.response.status_code, e.response.text[:500])
            raise
        except httpx.RequestError as e:
            logger.error("요청 실패: %s", e)
            raise

        data = resp.json()
        logger.debug("← code=%s msg=%s", data.get("code"), data.get("msg"))

        # OKX API 에러 체크
        if data.get("code") != "0":
            error_msg = data.get("msg", "Unknown error")
            # data 배열 안에 개별 에러가 있을 수 있음
            if data.get("data"):
                detail = data["data"][0] if data["data"] else {}
                error_msg = detail.get("sMsg", error_msg)
            logger.error("OKX API 에러: code=%s msg=%s", data["code"], error_msg)
            raise OKXAPIError(data["code"], error_msg, data)

        return data

    def _get(self, path: str, params: dict | None = None) -> dict[str, Any]:
        return self._request("GET", path, params=params)

    def _post(self, path: str, body: dict) -> dict[str, Any]:
        return self._request("POST", path, body=body)

    # -----------------------------------------------------------------------
    # 주문 생성
    # -----------------------------------------------------------------------
    def place_order(
        self,
        inst_id: str,
        side: Side,
        size: str,
        ord_type: OrderType = OrderType.MARKET,
        td_mode: TdMode = TdMode.ISOLATED,
        pos_side: PosSide | None = None,
        price: str | None = None,
        tp_trigger_px: str | None = None,
        tp_ord_px: str | None = None,
        sl_trigger_px: str | None = None,
        sl_ord_px: str | None = None,
        cl_ord_id: str | None = None,
    ) -> dict[str, Any]:
        """
        주문 생성.

        Args:
            inst_id:       OKX instrument ID (예: BTC-USDT-SWAP)
            side:          buy | sell
            size:          주문 수량
            ord_type:      market | limit
            td_mode:       cash | isolated | cross
            pos_side:      long | short | net (헤지 모드)
            price:         지정가 (limit 주문 시 필수)
            tp_trigger_px: TP 트리거 가격
            tp_ord_px:     TP 주문 가격 (-1 = 시장가)
            sl_trigger_px: SL 트리거 가격
            sl_ord_px:     SL 주문 가격 (-1 = 시장가)
            cl_ord_id:     클라이언트 주문 ID

        Returns:
            OKX 응답 data (ordId 포함)
        """
        body: dict[str, Any] = {
            "instId": inst_id,
            "tdMode": td_mode.value,
            "side": side.value,
            "ordType": ord_type.value,
            "sz": size,
            "tag": self.broker_code,  # 브로커 코드를 tag에 포함
        }

        if pos_side:
            body["posSide"] = pos_side.value
        if price and ord_type == OrderType.LIMIT:
            body["px"] = price
        if cl_ord_id:
            body["clOrdId"] = cl_ord_id
        if tp_trigger_px:
            body["tpTriggerPx"] = tp_trigger_px
            body["tpOrdPx"] = tp_ord_px or "-1"  # -1 = 시장가
        if sl_trigger_px:
            body["slTriggerPx"] = sl_trigger_px
            body["slOrdPx"] = sl_ord_px or "-1"

        logger.info(
            "주문 생성: %s %s %s sz=%s type=%s tag=%s",
            inst_id, side.value, td_mode.value, size, ord_type.value, self.broker_code,
        )

        result = self._post("/api/v5/trade/order", body)
        order_data = result["data"][0] if result.get("data") else {}
        logger.info("주문 완료: ordId=%s", order_data.get("ordId"))
        return result

    # -----------------------------------------------------------------------
    # 포지션 조회
    # -----------------------------------------------------------------------
    def get_positions(self, inst_id: str | None = None) -> dict[str, Any]:
        """
        열린 포지션 조회.

        Args:
            inst_id: 특정 종목만 조회 (None이면 전체)

        Returns:
            OKX 응답 data (포지션 리스트)
        """
        params = {}
        if inst_id:
            params["instId"] = inst_id

        logger.info("포지션 조회: instId=%s", inst_id or "ALL")
        return self._get("/api/v5/account/positions", params or None)

    # -----------------------------------------------------------------------
    # 주문 취소
    # -----------------------------------------------------------------------
    def cancel_order(self, inst_id: str, ord_id: str) -> dict[str, Any]:
        """
        주문 취소.

        Args:
            inst_id: OKX instrument ID
            ord_id:  취소할 주문 ID

        Returns:
            OKX 응답 data
        """
        body = {
            "instId": inst_id,
            "ordId": ord_id,
        }

        logger.info("주문 취소: instId=%s ordId=%s", inst_id, ord_id)
        return self._post("/api/v5/trade/cancel-order", body)

    # -----------------------------------------------------------------------
    # 계좌 잔고 조회
    # -----------------------------------------------------------------------
    def get_balance(self, ccy: str | None = None) -> dict[str, Any]:
        """
        계좌 잔고 조회.

        Args:
            ccy: 특정 통화 (예: USDT). None이면 전체.
        """
        params = {}
        if ccy:
            params["ccy"] = ccy

        logger.info("잔고 조회: ccy=%s", ccy or "ALL")
        return self._get("/api/v5/account/balance", params or None)

    # -----------------------------------------------------------------------
    # PRUVIQ 시뮬레이터 결과 → OKX 주문 변환
    # -----------------------------------------------------------------------
    def execute_from_simulator(
        self,
        symbol: str,
        direction: str,
        size: str,
        sl_pct: float | None = None,
        tp_pct: float | None = None,
        entry_price: float | None = None,
        strategy_name: str | None = None,
    ) -> dict[str, Any]:
        """
        PRUVIQ 시뮬레이터 결과를 OKX 주문으로 변환하여 실행.

        시뮬레이터 출력:
            symbol     = "BTCUSDT"
            direction  = "LONG" | "SHORT"
            sl_pct     = 2.0  (스탑로스 %)
            tp_pct     = 4.0  (테이크프로핏 %)

        변환 로직:
            1. symbol → instId (BTC-USDT-SWAP)
            2. direction → side + posSide
            3. sl_pct/tp_pct → 가격 계산 (entry_price 기준)

        Args:
            symbol:        PRUVIQ 심볼 (예: BTCUSDT)
            direction:     LONG | SHORT
            size:          주문 수량
            sl_pct:        스탑로스 % (예: 2.0)
            tp_pct:        테이크프로핏 % (예: 4.0)
            entry_price:   진입 예상 가격 (SL/TP 계산용, None이면 SL/TP 생략)
            strategy_name: 전략 이름 (클라이언트 주문 ID에 포함)

        Returns:
            OKX 주문 응답
        """
        # 1) 심볼 변환
        inst_id = pruviq_to_okx_inst_id(symbol, swap=True)

        # 2) 방향 변환
        direction_upper = direction.upper()
        if direction_upper == "LONG":
            side = Side.BUY
            pos_side = PosSide.LONG
        elif direction_upper == "SHORT":
            side = Side.SELL
            pos_side = PosSide.SHORT
        else:
            raise ValueError(f"알 수 없는 direction: {direction}")

        # 3) SL/TP 가격 계산
        tp_trigger = None
        sl_trigger = None

        if entry_price and tp_pct:
            if direction_upper == "LONG":
                tp_trigger = str(round(entry_price * (1 + tp_pct / 100), 2))
            else:
                tp_trigger = str(round(entry_price * (1 - tp_pct / 100), 2))

        if entry_price and sl_pct:
            if direction_upper == "LONG":
                sl_trigger = str(round(entry_price * (1 - sl_pct / 100), 2))
            else:
                sl_trigger = str(round(entry_price * (1 + sl_pct / 100), 2))

        # 4) 클라이언트 주문 ID (추적용)
        ts = int(time.time())
        cl_ord_id = f"pruviq_{strategy_name or 'sim'}_{ts}"
        # OKX clOrdId 최대 32자
        cl_ord_id = cl_ord_id[:32]

        logger.info(
            "시뮬레이터 → OKX 변환: %s %s → %s %s (SL=%s, TP=%s)",
            symbol, direction, inst_id, side.value, sl_trigger, tp_trigger,
        )

        return self.place_order(
            inst_id=inst_id,
            side=side,
            size=size,
            ord_type=OrderType.MARKET,
            td_mode=TdMode.ISOLATED,
            pos_side=pos_side,
            tp_trigger_px=tp_trigger,
            sl_trigger_px=sl_trigger,
            cl_ord_id=cl_ord_id,
        )


# ---------------------------------------------------------------------------
# 예외 클래스
# ---------------------------------------------------------------------------
class OKXAPIError(Exception):
    """OKX API가 code != "0"을 반환한 경우"""

    def __init__(self, code: str, msg: str, raw: dict | None = None):
        self.code = code
        self.msg = msg
        self.raw = raw
        super().__init__(f"OKX API Error [{code}]: {msg}")


# ---------------------------------------------------------------------------
# 팩토리: 환경변수에서 클라이언트 생성
# ---------------------------------------------------------------------------
def create_client_from_env() -> OKXBrokerClient:
    """
    환경변수에서 OKX 클라이언트를 생성한다.

    Required env vars:
        OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE

    Optional env vars:
        OKX_BROKER_CODE (default: PRUVIQ)
        OKX_DEMO_MODE   (default: true)
    """
    api_key = os.environ.get("OKX_API_KEY")
    secret_key = os.environ.get("OKX_SECRET_KEY")
    passphrase = os.environ.get("OKX_PASSPHRASE")

    if not all([api_key, secret_key, passphrase]):
        missing = []
        if not api_key:
            missing.append("OKX_API_KEY")
        if not secret_key:
            missing.append("OKX_SECRET_KEY")
        if not passphrase:
            missing.append("OKX_PASSPHRASE")
        raise EnvironmentError(
            f"필수 환경변수 누락: {', '.join(missing)}\n"
            "OKX 데모 트레이딩 API 키를 설정하세요."
        )

    demo_mode = os.environ.get("OKX_DEMO_MODE", "true").lower() in ("true", "1", "yes")
    broker_code = os.environ.get("OKX_BROKER_CODE", "PRUVIQ")

    auth = OKXAuth(
        api_key=api_key,
        secret_key=secret_key,
        passphrase=passphrase,
        demo_mode=demo_mode,
    )

    return OKXBrokerClient(auth=auth, broker_code=broker_code)


# ---------------------------------------------------------------------------
# 사용 예시 (실행하지 않음 — 참고용)
# ---------------------------------------------------------------------------
def _usage_example():
    """
    사용 예시. 실제 API 키 설정 후 실행 가능.

    이 함수는 직접 호출하지 않는다 — 연동 가이드 목적.
    """
    # 1) 클라이언트 생성
    client = create_client_from_env()

    with client:
        # 2) 잔고 확인
        balance = client.get_balance(ccy="USDT")
        print("잔고:", json.dumps(balance, indent=2))

        # 3) 시뮬레이터 결과로 주문
        result = client.execute_from_simulator(
            symbol="BTCUSDT",
            direction="LONG",
            size="0.01",           # 0.01 BTC
            sl_pct=2.0,            # 2% 스탑로스
            tp_pct=4.0,            # 4% 테이크프로핏
            entry_price=87000.0,   # 현재가 근사
            strategy_name="ma_cross",
        )
        print("주문 결과:", json.dumps(result, indent=2))

        # 4) 포지션 확인
        positions = client.get_positions(inst_id="BTC-USDT-SWAP")
        print("포지션:", json.dumps(positions, indent=2))

        # 5) 주문 취소 (필요 시)
        # ord_id = result["data"][0]["ordId"]
        # client.cancel_order("BTC-USDT-SWAP", ord_id)


# ---------------------------------------------------------------------------
# CLI 진입점
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=" * 60)
    print("OKX Broker Prototype — PRUVIQ")
    print("=" * 60)
    print()
    print("이 스크립트는 프로토타입입니다.")
    print("실행하려면 환경변수를 설정하세요:")
    print()
    print("  export OKX_API_KEY=your_key")
    print("  export OKX_SECRET_KEY=your_secret")
    print("  export OKX_PASSPHRASE=your_passphrase")
    print("  export OKX_DEMO_MODE=true")
    print("  export OKX_BROKER_CODE=PRUVIQ")
    print()

    # 심볼 변환 데모
    test_symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BTC-USDT", "BTC-USDT-SWAP"]
    print("심볼 변환 테스트:")
    for sym in test_symbols:
        print(f"  {sym:20s} → {pruviq_to_okx_inst_id(sym, swap=True)}")

    print()

    # 서명 생성 데모 (더미 키)
    auth = OKXAuth(
        api_key="demo_key",
        secret_key="demo_secret",
        passphrase="demo_pass",
        demo_mode=True,
    )
    headers = auth.headers("GET", "/api/v5/account/balance")
    print("인증 헤더 (더미):")
    for k, v in headers.items():
        if k == "OK-ACCESS-SIGN":
            v = v[:20] + "..."  # 서명 일부만 표시
        print(f"  {k}: {v}")

    print()
    print("데모 트레이딩 헤더 확인: x-simulated-trading =", headers.get("x-simulated-trading", "미설정"))
