"""Pytest config — default anyio backend to asyncio only.

Without this, `@pytest.mark.anyio` tests would also run under trio which
is not installed. Scoping to session so fixture reuse is cheap.
"""
import pytest


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"
