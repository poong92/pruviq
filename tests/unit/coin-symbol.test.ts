import { describe, expect, test } from "vitest";

// Inline the conversion logic (from okx_broker_prototype.py concept)
function pruviqToOkxInstId(symbol: string): string {
  // BTCUSDT → BTC-USDT-SWAP
  const base = symbol.replace("USDT", "");
  return `${base}-USDT-SWAP`;
}

describe("Symbol conversion", () => {
  test("BTCUSDT → BTC-USDT-SWAP", () => {
    expect(pruviqToOkxInstId("BTCUSDT")).toBe("BTC-USDT-SWAP");
  });

  test("ETHUSDT → ETH-USDT-SWAP", () => {
    expect(pruviqToOkxInstId("ETHUSDT")).toBe("ETH-USDT-SWAP");
  });

  test("1000SHIBUSDT → 1000SHIB-USDT-SWAP", () => {
    expect(pruviqToOkxInstId("1000SHIBUSDT")).toBe("1000SHIB-USDT-SWAP");
  });
});
