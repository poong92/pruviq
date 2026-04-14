"""
OKX API client — OAuth Bearer token based.
All orders include broker tag for commission tracking.
"""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from .config import OKX_BASE_URL, OKX_BROKER_CODE, OKX_DEMO_MODE
from .models import BalanceInfo, PositionInfo

logger = logging.getLogger("okx_client")

# ── Instrument spec cache (24h TTL, shared across all client instances) ──
_instrument_cache: dict[str, dict] = {}
_instrument_cache_ts: dict[str, float] = {}
_INSTRUMENT_CACHE_TTL = 24 * 3600


class OKXClient:
    """OAuth token-based OKX API client."""

    def __init__(self, access_token: str, session_id: str = ""):
        self.access_token = access_token
        self.session_id = session_id  # used for 53002 auto-retry
        self.base_url = OKX_BASE_URL
        self.broker_code = OKX_BROKER_CODE
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=10,
            headers=self._default_headers(),
        )

    def _default_headers(self) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }
        if OKX_DEMO_MODE:
            headers["x-simulated-trading"] = "1"
        return headers

    async def close(self):
        await self._client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self.close()

    async def _refresh_token_and_update(self) -> bool:
        """Refresh access token after 53002. Returns True if successful."""
        if not self.session_id:
            return False
        try:
            from .oauth import refresh_access_token
            logger.warning("→ 53002 detected — refreshing token for session %s", self.session_id[:8])
            new_token = await refresh_access_token(self.session_id)
            self.access_token = new_token
            self._client.headers["Authorization"] = f"Bearer {new_token}"
            logger.warning("← Token refreshed successfully")
            return True
        except Exception as e:
            logger.error("Token refresh after 53002 failed: %s", e)
            return False

    # ── GET ─────────────────────────────────────────

    async def _get(self, path: str, params: dict | None = None) -> dict[str, Any]:
        for attempt in range(2):
            resp = await self._client.get(path, params=params)
            resp.raise_for_status()
            data = resp.json()
            code = data.get("code")
            if code == "53002" and attempt == 0:
                if await self._refresh_token_and_update():
                    continue  # retry once with new token
            if code != "0":
                logger.error("OKX API error: %s %s", code, data.get("msg"))
                raise ValueError(f"OKX API error {code}: {data.get('msg')}")
            return data
        raise ValueError("OKX API: max retries exceeded")

    # ── POST ────────────────────────────────────────

    async def _post(self, path: str, body: dict) -> dict[str, Any]:
        for attempt in range(2):
            resp = await self._client.post(path, json=body)
            resp.raise_for_status()
            data = resp.json()
            code = data.get("code")
            if code == "53002" and attempt == 0:
                if await self._refresh_token_and_update():
                    continue
            if code != "0":
                logger.error("OKX API error: %s %s", code, data.get("msg"))
                raise ValueError(f"OKX API error {code}: {data.get('msg')}")
            return data
        raise ValueError("OKX API: max retries exceeded")

    # ── Account ─────────────────────────────────────

    async def get_balance(self, ccy: str = "USDT") -> list[BalanceInfo]:
        data = await self._get("/api/v5/account/balance", {"ccy": ccy})
        results = []
        for acct in data.get("data", []):
            for detail in acct.get("details", []):
                results.append(BalanceInfo(
                    ccy=detail.get("ccy", ""),
                    bal=detail.get("bal", "0"),
                    avail_bal=detail.get("availBal", "0"),
                    frozen_bal=detail.get("frozenBal", "0"),
                ))
        return results

    async def get_positions(self, inst_id: str | None = None) -> list[PositionInfo]:
        params = {}
        if inst_id:
            params["instId"] = inst_id
        data = await self._get("/api/v5/account/positions", params)
        return [
            PositionInfo(
                inst_id=p.get("instId", ""),
                pos=p.get("pos", "0"),
                avg_px=p.get("avgPx", "0"),
                mark_px=p.get("markPx", "0"),
                liq_px=p.get("liqPx", ""),
                pnl=p.get("upl", "0"),
                upl_ratio=p.get("uplRatio", "0"),
                lever=p.get("lever", ""),
                mgn_mode=p.get("mgnMode", ""),
                pos_side=p.get("posSide", ""),
            )
            for p in data.get("data", [])
        ]

    async def get_instrument_info(self, inst_id: str) -> dict:
        """
        Fetch instrument spec (ctVal, minSz, lotSz) for OKX SWAP contracts.
        Cached 24h — safe to call on every order.

        ctVal: base currency per contract (e.g. BTC-USDT-SWAP → 0.01 BTC)
        minSz: minimum order size in contracts (usually 1)
        lotSz: lot size / tick (usually 1 for SWAP)
        """
        now = time.time()
        if inst_id in _instrument_cache:
            if now - _instrument_cache_ts.get(inst_id, 0) < _INSTRUMENT_CACHE_TTL:
                return _instrument_cache[inst_id]

        logger.warning("→ GET instrument info instId=%s", inst_id)
        data = await self._get("/api/v5/public/instruments", {
            "instType": "SWAP", "instId": inst_id,
        })
        items = data.get("data", [])
        if not items:
            raise ValueError(f"Instrument not found: {inst_id}")

        item = items[0]
        info = {
            "ctVal": float(item.get("ctVal", "1")),    # base currency per contract
            "minSz": float(item.get("minSz", "1")),    # minimum contracts
            "lotSz": float(item.get("lotSz", "1")),    # lot size
            "settleCcy": item.get("settleCcy", "USDT"),
        }
        _instrument_cache[inst_id] = info
        _instrument_cache_ts[inst_id] = now
        logger.warning("← instrument %s: ctVal=%s minSz=%s", inst_id, info["ctVal"], info["minSz"])
        return info

    async def get_mark_price(self, inst_id: str) -> float:
        """OKX public mark price — used for position sizing without user-supplied price."""
        logger.warning("→ GET mark-price instId=%s", inst_id)
        data = await self._get("/api/v5/public/mark-price", {
            "instType": "SWAP", "instId": inst_id,
        })
        items = data.get("data", [])
        if not items:
            raise ValueError(f"No mark price data for {inst_id}")
        px = float(items[0]["markPx"])
        logger.warning("← mark-price %s = %.6f", inst_id, px)
        return px

    async def get_user_uid(self) -> str:
        """
        Fetch OKX account UID — stable identifier across sessions.
        Used to create a persistent session_id tied to the OKX account.
        """
        data = await self._get("/api/v5/account/config")
        items = data.get("data", [])
        if not items:
            raise ValueError("OKX account/config returned no data")
        uid = items[0].get("uid", "")
        if not uid:
            raise ValueError("OKX account/config: uid field missing")
        return uid

    async def get_positions_history(self, inst_type: str = "SWAP", limit: str = "20") -> list[dict]:
        """Closed position history — realized PnL source."""
        data = await self._get("/api/v5/account/positions-history", {
            "instType": inst_type, "limit": limit,
        })
        return data.get("data", [])

    # ── Trading ─────────────────────────────────────

    async def set_leverage(
        self,
        inst_id: str,
        lever: int,
        mgn_mode: str = "isolated",
        pos_side: str = "",
    ) -> dict[str, Any]:
        """Set leverage for an instrument before placing orders."""
        body: dict[str, Any] = {
            "instId": inst_id,
            "lever": str(lever),
            "mgnMode": mgn_mode,
        }
        if pos_side:
            body["posSide"] = pos_side
        logger.warning("→ set-leverage instId=%s lever=%s mgnMode=%s", inst_id, lever, mgn_mode)
        data = await self._post("/api/v5/account/set-leverage", body)
        result = data.get("data", [{}])[0]
        logger.warning("← set-leverage OK lever=%s", result.get("lever", "?"))
        return result

    async def place_order(
        self,
        inst_id: str,
        side: str,
        sz: str,
        ord_type: str = "market",
        px: str | None = None,
        td_mode: str = "isolated",
    ) -> dict[str, str]:
        body: dict[str, Any] = {
            "instId": inst_id,
            "tdMode": td_mode,
            "side": side,
            "ordType": ord_type,
            "sz": sz,
            "tag": self.broker_code,
        }
        if px:
            body["px"] = px
        logger.warning("→ place-order instId=%s side=%s sz=%s ordType=%s tdMode=%s",
                       inst_id, side, sz, ord_type, td_mode)
        data = await self._post("/api/v5/trade/order", body)
        result = data.get("data", [{}])[0]
        logger.warning("← place-order ordId=%s sCode=%s sMsg=%s",
                       result.get("ordId", "?"), result.get("sCode", "?"), result.get("sMsg", ""))
        return result

    async def place_algo_order(
        self,
        inst_id: str,
        side: str,
        sz: str,
        sl_trigger_px: str | None = None,
        sl_ord_px: str = "-1",
        tp_trigger_px: str | None = None,
        tp_ord_px: str = "-1",
        td_mode: str = "isolated",
    ) -> dict[str, Any]:
        """SL/TP conditional algo order."""
        body: dict[str, Any] = {
            "instId": inst_id,
            "tdMode": td_mode,
            "side": side,
            "ordType": "conditional",
            "sz": sz,
            "tag": self.broker_code,
        }
        if sl_trigger_px:
            body["slTriggerPx"] = sl_trigger_px
            body["slOrdPx"] = sl_ord_px
        if tp_trigger_px:
            body["tpTriggerPx"] = tp_trigger_px
            body["tpOrdPx"] = tp_ord_px
        logger.warning("→ place-algo instId=%s side=%s sz=%s SL=%s TP=%s",
                       inst_id, side, sz, sl_trigger_px, tp_trigger_px)
        result = await self._post("/api/v5/trade/order-algo", body)
        algo_data = result.get("data", [{}])
        algo_id = algo_data[0].get("algoId", "?") if algo_data else "?"
        logger.warning("← place-algo algoId=%s", algo_id)
        return result

    async def cancel_order(self, inst_id: str, ord_id: str) -> dict[str, Any]:
        logger.warning("→ cancel-order instId=%s ordId=%s", inst_id, ord_id)
        result = await self._post("/api/v5/trade/cancel-order", {
            "instId": inst_id,
            "ordId": ord_id,
        })
        logger.warning("← cancel-order done")
        return result

    async def close_position(self, inst_id: str, mgn_mode: str = "isolated") -> dict[str, Any]:
        logger.warning("→ close-position instId=%s mgnMode=%s", inst_id, mgn_mode)
        result = await self._post("/api/v5/trade/close-position", {
            "instId": inst_id,
            "mgnMode": mgn_mode,
            "tag": self.broker_code,
        })
        logger.warning("← close-position done instId=%s", inst_id)
        return result

    async def get_order_fill_price(self, inst_id: str, ord_id: str) -> float:
        """
        Query actual fill price (avgPx) for a completed market order.
        Industry standard: SL/TP must be set relative to actual fill, not signal price.
        Raises ValueError if order not yet filled or avgPx unavailable.
        """
        data = await self._get("/api/v5/trade/order", {"instId": inst_id, "ordId": ord_id})
        orders = data.get("data", [])
        if not orders:
            raise ValueError(f"Order {ord_id} not found")
        avg_px = orders[0].get("avgPx", "")
        if not avg_px or float(avg_px) <= 0:
            raise ValueError(f"Order {ord_id} avgPx not available yet (state={orders[0].get('state')})")
        px = float(avg_px)
        logger.warning("← order fill ordId=%s avgPx=%.6f state=%s", ord_id, px, orders[0].get("state"))
        return px
