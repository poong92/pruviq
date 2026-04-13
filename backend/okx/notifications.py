"""
OKX alert-mode Telegram notifications.
Sends signal alerts to a user's personal Telegram chat (not the public channel).
Reuses TELEGRAM_TOKEN env var — same bot, different chat_id per user.
"""
from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger("okx_notifications")

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "")
SITE_URL = "https://pruviq.com"


def _format_signal_alert(signal: dict) -> str:
    """Format a signal dict as an HTML Telegram message."""
    direction = signal.get("direction", "").upper()
    emoji = "\U0001f534" if direction == "SHORT" else "\U0001f7e2"
    coin = signal.get("coin", "")
    strategy = signal.get("strategy", "")
    strategy_name = signal.get("strategy_name", strategy)
    entry = signal.get("entry_price", 0)
    sl_pct = signal.get("sl_pct", 0)
    tp_pct = signal.get("tp_pct", 0)

    if entry and entry < 1:
        entry_str = f"${entry:.6f}"
    elif entry:
        entry_str = f"${entry:.2f}"
    else:
        entry_str = "market"

    sim_url = (
        f"{SITE_URL}/simulate?"
        f"strategy={strategy}&symbol={coin}"
        f"&dir={signal.get('direction', '')}&sl={sl_pct}&tp={tp_pct}"
    )

    return (
        f"{emoji} <b>PRUVIQ Alert</b>\n"
        f"<b>{strategy_name}</b>\n"
        f"{coin} · {direction}\n"
        f"Entry: {entry_str} · SL {sl_pct}% / TP {tp_pct}%\n"
        f"\n"
        f'<a href="{sim_url}">View backtest →</a>'
    )


async def send_reauth_alert(chat_id: str) -> bool:
    """
    Send 'OKX reconnection needed' Telegram alert when refresh_token expires.
    User must re-connect OKX OAuth to resume auto-trading.
    """
    if not TELEGRAM_TOKEN or not chat_id:
        return False

    msg = (
        "⚠️ <b>PRUVIQ: OKX 재연결 필요</b>\n\n"
        "OKX 인증 토큰이 만료되었습니다.\n"
        "<b>자동매매가 중단되었습니다.</b>\n\n"
        f'👉 <a href="{SITE_URL}/dashboard">대시보드에서 OKX 재연결 →</a>\n\n'
        "<i>보안을 위해 3일마다 재연결이 필요합니다.</i>"
    )

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            logger.warning("→ Telegram reauth alert chat_id=%s", chat_id)
            resp = await client.post(
                f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": msg,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": False,
                },
            )
            logger.warning("← Telegram reauth status=%s", resp.status_code)
            return resp.status_code == 200
    except Exception as e:
        logger.error("Reauth alert failed: %s", e)
        return False


async def _send(chat_id: str, msg: str, preview: bool = False) -> bool:
    """Internal helper: send HTML message to Telegram chat."""
    if not TELEGRAM_TOKEN or not chat_id:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": msg,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": not preview,
                },
            )
            return resp.status_code == 200
    except Exception as e:
        logger.error("Telegram send failed: %s", e)
        return False


async def send_trade_executed(
    chat_id: str,
    signal: dict,
    fill_price: float,
    sz: str,
    sl_price: str,
    tp_price: str,
) -> bool:
    """
    Trade entry confirmation — sent after every successful auto-execution.
    Industry standard: users must be notified of every entry with fill details.
    """
    direction = signal.get("direction", "").upper()
    emoji = "🔴" if direction == "SHORT" else "🟢"
    coin = signal.get("coin", "")
    strategy = signal.get("strategy_name", signal.get("strategy", ""))
    sl_pct = signal.get("sl_pct", 0)
    tp_pct = signal.get("tp_pct", 0)

    if fill_price < 1:
        price_str = f"${fill_price:.6f}"
    else:
        price_str = f"${fill_price:,.2f}"

    msg = (
        f"{emoji} <b>PRUVIQ 자동매매 체결</b>\n"
        f"<b>{strategy}</b> · {coin} · {direction}\n"
        f"\n"
        f"체결가: <b>{price_str}</b> ({sz} contracts)\n"
        f"SL: {sl_price} (-{sl_pct}%) | TP: {tp_price} (+{tp_pct}%)\n"
        f"\n"
        f'<a href="{SITE_URL}/ko/dashboard">대시보드 →</a>'
    )
    logger.warning("→ Telegram trade-executed chat_id=%s %s %s", chat_id, coin, direction)
    return await _send(chat_id, msg)


async def send_execution_failed(chat_id: str, signal: dict, reason: str) -> bool:
    """
    Execution failure alert — sent when auto-trade fails for any reason.
    Industry standard: users must know when their bot fails to execute.
    """
    coin = signal.get("coin", "")
    strategy = signal.get("strategy_name", signal.get("strategy", ""))
    direction = signal.get("direction", "").upper()

    msg = (
        f"⚠️ <b>PRUVIQ 자동매매 실패</b>\n"
        f"{strategy} · {coin} · {direction}\n"
        f"\n"
        f"사유: <code>{reason}</code>\n"
        f"\n"
        f'<a href="{SITE_URL}/ko/dashboard">대시보드 확인 →</a>'
    )
    logger.warning("→ Telegram execution-failed chat_id=%s reason=%s", chat_id, reason)
    return await _send(chat_id, msg)


async def send_safety_limit(chat_id: str, limit_type: str, ctx: dict) -> bool:
    """
    Safety limit hit — daily trades, daily loss, consecutive losses.
    Industry standard: circuit breaker events must be communicated to user.
    """
    if limit_type == "daily_trades":
        msg = (
            f"🛑 <b>PRUVIQ 일일 거래 한도 도달</b>\n"
            f"오늘 거래: {ctx.get('trades_today')} / {ctx.get('max_daily')}회\n"
            f"오늘 자동매매가 중단됩니다.\n"
            f"\n"
            f'<a href="{SITE_URL}/ko/dashboard">설정 변경 →</a>'
        )
    elif limit_type == "daily_loss":
        msg = (
            f"🛑 <b>PRUVIQ 일일 손실 한도 도달</b>\n"
            f"오늘 손익: ${ctx.get('pnl_today', 0):.2f} / -${ctx.get('limit', 0):.0f}\n"
            f"오늘 자동매매가 중단됩니다.\n"
            f"\n"
            f'<a href="{SITE_URL}/ko/dashboard">설정 변경 →</a>'
        )
    elif limit_type == "consecutive_loss":
        msg = (
            f"⏸️ <b>PRUVIQ 연속 손실 감지 — 자동 일시정지</b>\n"
            f"연속 {ctx.get('count', 3)}회 손실 발생\n"
            f"자동매매가 일시 중단되었습니다.\n"
            f"활성화하려면 설정에서 다시 켜주세요.\n"
            f"\n"
            f'<a href="{SITE_URL}/ko/dashboard">대시보드 →</a>'
        )
    else:
        return False

    logger.warning("→ Telegram safety-limit chat_id=%s type=%s", chat_id, limit_type)
    return await _send(chat_id, msg)


async def send_signal_alert(chat_id: str, signal: dict) -> bool:
    """
    Send a signal alert to a user's personal Telegram chat.

    Args:
        chat_id: User's Telegram chat ID (stored in their settings).
        signal: Signal dict from SignalScanner.

    Returns:
        True if sent successfully.
    """
    if not TELEGRAM_TOKEN:
        logger.warning("TELEGRAM_TOKEN not set — alert skipped")
        return False
    if not chat_id:
        return False

    msg = _format_signal_alert(signal)
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            logger.warning(
                "→ Telegram alert chat_id=%s strategy=%s coin=%s",
                chat_id, signal.get("strategy"), signal.get("coin"),
            )
            resp = await client.post(url, json={
                "chat_id": chat_id,
                "text": msg,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            })
            logger.warning("← Telegram status=%s body=%s", resp.status_code, resp.text[:200])
            return resp.status_code == 200
    except Exception as e:
        logger.error("Telegram alert failed: %s", e)
        return False
