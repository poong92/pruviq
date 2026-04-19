"""
OKX Broker standalone server.
DO 서버에서 독립 실행 — PRUVIQ API와 분리.

Usage:
  uvicorn server:app --host 0.0.0.0 --port 8090

또는 Docker:
  docker build -t pruviq-okx .
  docker run -p 8090:8090 --env-file .env pruviq-okx
"""
from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from router import router as okx_router

logger = logging.getLogger("pruviq-okx")

# Signal polling config (optional — only active if both env vars are set)
OKX_SIGNAL_SOURCE_URL = os.environ.get("OKX_SIGNAL_SOURCE_URL", "").strip()
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "").strip()
SIGNAL_POLL_INTERVAL = int(os.environ.get("OKX_SIGNAL_POLL_INTERVAL", "300"))  # 5 min default
SIGNAL_POLL_TIMEOUT = float(os.environ.get("OKX_SIGNAL_POLL_TIMEOUT", "15"))

# Hide Swagger/redoc/openapi when PRUVIQ_ENV=production.
IS_PRODUCTION = os.environ.get("PRUVIQ_ENV", "development").strip().lower() == "production"


async def _signal_polling_loop() -> None:
    """Poll Mac Mini `/internal/signals` every `SIGNAL_POLL_INTERVAL` seconds.

    Runs only when OKX_SIGNAL_SOURCE_URL and INTERNAL_API_KEY are both set.
    Forwards signals to `process_signals` (auto_executor). Errors are logged
    at WARNING and the loop continues — one bad poll should not kill the worker.
    """
    # Lazy import so the module stays importable in environments without httpx
    import httpx
    from auto_executor import process_signals

    # Small startup delay so broker health endpoints come up first
    await asyncio.sleep(30)

    headers = {"X-Internal-Key": INTERNAL_API_KEY}
    logger.warning(
        "Signal polling loop starting: url=%s interval=%ss",
        OKX_SIGNAL_SOURCE_URL,
        SIGNAL_POLL_INTERVAL,
    )

    async with httpx.AsyncClient(timeout=SIGNAL_POLL_TIMEOUT) as client:
        while True:
            try:
                resp = await client.get(OKX_SIGNAL_SOURCE_URL, headers=headers)
                if resp.status_code != 200:
                    # Do NOT log resp.text. The signal source authenticates
                    # via X-Internal-Key; some upstream error pages echo
                    # request headers (nginx default error_page templates),
                    # which would leak INTERNAL_API_KEY to journalctl.
                    logger.warning(
                        "Signal poll non-200: status=%s", resp.status_code,
                    )
                else:
                    data = resp.json()
                    signals = data.get("signals", []) if isinstance(data, dict) else []
                    if signals:
                        logger.warning("Signal poll: %d signals received", len(signals))
                        try:
                            await process_signals(signals)
                        except Exception as e:
                            logger.warning("process_signals failed: %s", e)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.warning("Signal poll error: %s", e)

            await asyncio.sleep(SIGNAL_POLL_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the signal polling loop iff both env vars are configured."""
    poll_task: asyncio.Task | None = None
    if OKX_SIGNAL_SOURCE_URL and INTERNAL_API_KEY and len(INTERNAL_API_KEY) >= 32:
        poll_task = asyncio.create_task(_signal_polling_loop())
        logger.warning("Signal polling task scheduled")
    else:
        logger.warning(
            "Signal polling DISABLED: OKX_SIGNAL_SOURCE_URL=%s INTERNAL_API_KEY_set=%s",
            bool(OKX_SIGNAL_SOURCE_URL),
            len(INTERNAL_API_KEY) >= 32,
        )

    try:
        yield
    finally:
        if poll_task is not None:
            poll_task.cancel()
            try:
                await poll_task
            except (asyncio.CancelledError, Exception):
                pass


app = FastAPI(
    title="PRUVIQ OKX Broker",
    version="0.1.0",
    description="PRUVIQ → OKX trade execution via OAuth Broker",
    lifespan=lifespan,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://pruviq.com", "https://www.pruviq.com"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(okx_router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "pruviq-okx-broker",
        "version": "0.1.0",
        "signal_polling": bool(OKX_SIGNAL_SOURCE_URL and len(INTERNAL_API_KEY) >= 32),
    }
