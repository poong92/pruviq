"""
OKX API client — OAuth Bearer token based.
All orders include broker tag for commission tracking.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from .config import OKX_BASE_URL, OKX_BROKER_CODE, OKX_DEMO_MODE
from .models import BalanceInfo, PositionInfo

logger = logging.getLogger("okx_client")


class OKXClient:
    """OAuth token-based OKX API client."""

    def __init__(self, access_token: str):
        self.access_token = access_token
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

    # ── GET ─────────────────────────────────────────

    async def _get(self, path: str, params: dict | None = None) -> dict[str, Any]:
        resp = await self._client.get(path, params=params)
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") != "0":
            logger.error("OKX API error: %s %s", data.get("code"), data.get("msg"))
            raise ValueError(f"OKX API error {data.get('code')}: {data.get('msg')}")
        return data

    # ── POST ────────────────────────────────────────

    async def _post(self, path: str, body: dict) -> dict[str, Any]:
        resp = await self._client.post(path, json=body)
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
        data = await self._post("/api/v5/account/set-leverage", body)
        return data.get("data", [{}])[0]

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

        data = await self._post("/api/v5/trade/order", body)
        return data.get("data", [{}])[0]

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

        return await self._post("/api/v5/trade/order-algo", body)

    async def cancel_order(self, inst_id: str, ord_id: str) -> dict[str, Any]:
        return await self._post("/api/v5/trade/cancel-order", {
            "instId": inst_id,
            "ordId": ord_id,
        })

    async def close_position(self, inst_id: str, mgn_mode: str = "isolated") -> dict[str, Any]:
        return await self._post("/api/v5/trade/close-position", {
            "instId": inst_id,
            "mgnMode": mgn_mode,
            "tag": self.broker_code,
        })
