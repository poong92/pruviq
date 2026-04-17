"""
OKX API client — HMAC API key auth (Fast API flow).
All orders include broker tag for commission tracking.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

import httpx

from .config import OKX_BASE_URL, OKX_BROKER_CODE, OKX_DEMO_MODE
from .models import BalanceInfo, PositionInfo

logger = logging.getLogger("okx_client")

_instrument_cache: dict[str, dict] = {}
_instrument_cache_ts: dict[str, float] = {}
_INSTRUMENT_CACHE_TTL = 24 * 3600


def _okx_timestamp() -> str:
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'


def _sign(secret_key: str, timestamp: str, method: str, request_path: str, body: str = "") -> str:
    message = timestamp + method.upper() + request_path + body
    mac = hmac.new(secret_key.encode(), message.encode(), hashlib.sha256)
    return base64.b64encode(mac.digest()).decode()


class OKXClient:
    """HMAC API key-based OKX client (Fast API flow)."""

    def __init__(self, api_key: str, secret_key: str, passphrase: str, demo: bool | None = None):
        self.api_key = api_key
        self.secret_key = secret_key
        self.passphrase = passphrase
        self.demo = OKX_DEMO_MODE if demo is None else demo
        self.base_url = OKX_BASE_URL
        self.broker_code = OKX_BROKER_CODE
        self._http = httpx.AsyncClient(base_url=self.base_url, timeout=10)

    def _auth_headers(self, method: str, path: str, body: str = "") -> dict[str, str]:
        ts = _okx_timestamp()
        sign = _sign(self.secret_key, ts, method, path, body)
        headers = {
            "OK-ACCESS-KEY": self.api_key,
            "OK-ACCESS-SIGN": sign,
            "OK-ACCESS-TIMESTAMP": ts,
            "OK-ACCESS-PASSPHRASE": self.passphrase,
            "Content-Type": "application/json",
        }
        if self.demo:
            headers["x-simulated-trading"] = "1"
        return headers

    async def close(self):
        await self._http.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self.close()

    async def _get(self, path: str, params: dict | None = None) -> dict[str, Any]:
        qs = ("?" + urlencode(params)) if params else ""
        full_path = path + qs
        headers = self._auth_headers("GET", full_path)
        resp = await self._http.get(path, params=params, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") != "0":
            logger.error("OKX API error: %s %s", data.get("code"), data.get("msg"))
            raise ValueError(f"OKX API error {data.get('code')}: {data.get('msg')}")
        return data

    async def _post(self, path: str, body: dict | list) -> dict[str, Any]:
        body_str = json.dumps(body)
        headers = self._auth_headers("POST", path, body_str)
        resp = await self._http.post(path, content=body_str, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") != "0":
            logger.error("OKX API error: %s %s", data.get("code"), data.get("msg"))
            raise ValueError(f"OKX API error {data.get('code')}: {data.get('msg')}")
        return data

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
            "ctVal": float(item.get("ctVal", "1")),
            "minSz": float(item.get("minSz", "1")),
            "lotSz": float(item.get("lotSz", "1")),
            "settleCcy": item.get("settleCcy", "USDT"),
        }
        _instrument_cache[inst_id] = info
        _instrument_cache_ts[inst_id] = now
        logger.warning("← instrument %s: ctVal=%s minSz=%s", inst_id, info["ctVal"], info["minSz"])
        return info

    async def get_mark_price(self, inst_id: str) -> float:
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

    async def get_positions_history(self, inst_type: str = "SWAP", limit: str = "20") -> list[dict]:
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
        cl_ord_id: str | None = None,
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
        if cl_ord_id:
            body["clOrdId"] = cl_ord_id
        logger.warning(
            "→ place-order instId=%s side=%s sz=%s ordType=%s tdMode=%s clOrdId=%s",
            inst_id, side, sz, ord_type, td_mode, cl_ord_id or "-",
        )
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

    async def cancel_algo_orders(
        self, algo_ids: list[str], inst_id: str
    ) -> dict[str, Any]:
        if not algo_ids:
            return {"code": "0", "data": []}
        body = [{"algoId": aid, "instId": inst_id} for aid in algo_ids if aid]
        if not body:
            return {"code": "0", "data": []}
        logger.warning("→ cancel-algos count=%d instId=%s", len(body), inst_id)
        result = await self._post("/api/v5/trade/cancel-algos", body)
        logger.warning("← cancel-algos done instId=%s", inst_id)
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
