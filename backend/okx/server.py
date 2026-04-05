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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from router import router as okx_router

app = FastAPI(
    title="PRUVIQ OKX Broker",
    version="0.1.0",
    description="PRUVIQ → OKX trade execution via OAuth Broker",
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
    }
