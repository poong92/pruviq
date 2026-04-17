"""
PRUVIQ OKX — Retry utilities with exponential backoff.

Ported lesson from autotrader (src/live/utils.py `retry_on_error`): on transient
network / rate-limit errors the correct behavior is short back-off retries,
not immediate failure. autotrader uses this for funding-rate fetch, FnG fetch,
and order management calls.

We keep the interface async-first because every OKX call in this codebase is
async. The sync variant exists only for reconciler threadpool callers.
"""
from __future__ import annotations

import asyncio
import functools
import logging
import random
import time
from typing import Any, Awaitable, Callable, Iterable, TypeVar

logger = logging.getLogger("okx_retry")

T = TypeVar("T")


def _compute_delay(attempt: int, base: float, cap: float, jitter: float) -> float:
    """Exponential backoff with full jitter (AWS recommendation).
    attempt: 0-indexed (first retry = 0).
    Returns: seconds to wait before next attempt.
    """
    raw = base * (2 ** attempt)
    capped = min(raw, cap)
    # full jitter on the capped value
    return max(0.0, random.uniform(0.0, capped) if jitter > 0 else capped)


def retry_async(
    *,
    max_attempts: int = 3,
    base_delay: float = 0.5,
    max_delay: float = 10.0,
    retry_on: Iterable[type[BaseException]] = (Exception,),
    do_not_retry_on: Iterable[type[BaseException]] = (),
    logger_: logging.Logger = logger,
    op_name: str | None = None,
) -> Callable[[Callable[..., Awaitable[T]]], Callable[..., Awaitable[T]]]:
    """Retry an async callable with exponential backoff + full jitter.

    Use for transient OKX API calls (network blips, 429 rate-limit, 5xx).
    Do NOT wrap business-level failures (bad clOrdId, insufficient balance) —
    those need to fail fast so the caller can take a different path. List
    specific fatal exceptions in `do_not_retry_on`.

    Example:
        @retry_async(max_attempts=3, retry_on=(httpx.HTTPError,))
        async def fetch_funding(...): ...
    """
    retry_types = tuple(retry_on)
    fatal_types = tuple(do_not_retry_on)

    def deco(fn: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        name = op_name or fn.__qualname__

        @functools.wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            last_exc: BaseException | None = None
            for attempt in range(max_attempts):
                try:
                    return await fn(*args, **kwargs)
                except fatal_types as exc:
                    # Intentionally not retried — re-raise immediately.
                    raise
                except retry_types as exc:
                    last_exc = exc
                    if attempt + 1 >= max_attempts:
                        break
                    delay = _compute_delay(attempt, base_delay, max_delay, jitter=1.0)
                    logger_.warning(
                        "%s attempt %d/%d failed (%s: %s) — retrying in %.2fs",
                        name, attempt + 1, max_attempts,
                        type(exc).__name__, exc, delay,
                    )
                    await asyncio.sleep(delay)
            logger_.error(
                "%s failed after %d attempts: %s",
                name, max_attempts, last_exc,
            )
            assert last_exc is not None
            raise last_exc

        return wrapper

    return deco


def retry_sync(
    *,
    max_attempts: int = 3,
    base_delay: float = 0.5,
    max_delay: float = 10.0,
    retry_on: Iterable[type[BaseException]] = (Exception,),
    do_not_retry_on: Iterable[type[BaseException]] = (),
    logger_: logging.Logger = logger,
    op_name: str | None = None,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Sync counterpart of retry_async. Use only for reconciler's to_thread
    callers or scripts; all HTTP paths should be async."""
    retry_types = tuple(retry_on)
    fatal_types = tuple(do_not_retry_on)

    def deco(fn: Callable[..., T]) -> Callable[..., T]:
        name = op_name or fn.__qualname__

        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            last_exc: BaseException | None = None
            for attempt in range(max_attempts):
                try:
                    return fn(*args, **kwargs)
                except fatal_types:
                    raise
                except retry_types as exc:
                    last_exc = exc
                    if attempt + 1 >= max_attempts:
                        break
                    delay = _compute_delay(attempt, base_delay, max_delay, jitter=1.0)
                    logger_.warning(
                        "%s attempt %d/%d failed (%s: %s) — retrying in %.2fs",
                        name, attempt + 1, max_attempts,
                        type(exc).__name__, exc, delay,
                    )
                    time.sleep(delay)
            logger_.error(
                "%s failed after %d attempts: %s",
                name, max_attempts, last_exc,
            )
            assert last_exc is not None
            raise last_exc

        return wrapper

    return deco
