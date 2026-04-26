/**
 * formatKoNum.test.ts — contract test for Korean idiomatic number formatting.
 */
import { describe, expect, test } from "vitest";
import { formatKoNum, formatLocalizedCount } from "../../src/utils/format";

describe("formatKoNum (verbose)", () => {
  test("zero → '0'", () => {
    expect(formatKoNum(0)).toBe("0");
  });

  test("under 1만 → comma-grouped only", () => {
    expect(formatKoNum(1)).toBe("1");
    expect(formatKoNum(123)).toBe("123");
    expect(formatKoNum(1234)).toBe("1,234");
    expect(formatKoNum(9_999)).toBe("9,999");
  });

  test("1만 ~ 1억 — composes 만 segment + remainder", () => {
    expect(formatKoNum(10_000)).toBe("1만");
    expect(formatKoNum(12_345)).toBe("1만 2,345");
    expect(formatKoNum(100_000)).toBe("10만");
    expect(formatKoNum(1_234_567)).toBe("123만 4,567");
    expect(formatKoNum(12_345_678)).toBe("1,234만 5,678");
    expect(formatKoNum(99_999_999)).toBe("9,999만 9,999");
  });

  test("1억+ — composes 억 + 만 + remainder", () => {
    expect(formatKoNum(100_000_000)).toBe("1억");
    expect(formatKoNum(123_456_789)).toBe("1억 2,345만 6,789");
    expect(formatKoNum(1_234_567_890)).toBe("12억 3,456만 7,890");
  });

  test("억 with no 만 segment skips 만 part", () => {
    expect(formatKoNum(100_000_000)).toBe("1억");
    expect(formatKoNum(100_000_500)).toBe("1억 500");
  });

  test("억 with no 단위 ones segment skips ones part", () => {
    expect(formatKoNum(100_010_000)).toBe("1억 1만");
  });

  test("negative numbers preserve sign with 만/억 idioms", () => {
    expect(formatKoNum(-12_345)).toBe("-1만 2,345");
    expect(formatKoNum(-100_000_000)).toBe("-1억");
  });

  test("non-finite inputs are passed through as string", () => {
    expect(formatKoNum(NaN)).toBe("NaN");
    expect(formatKoNum(Infinity)).toBe("Infinity");
  });
});

describe("formatKoNum (compact)", () => {
  test("under 1만 → no suffix", () => {
    expect(formatKoNum(0, { compact: true })).toBe("0");
    expect(formatKoNum(123, { compact: true })).toBe("123");
    expect(formatKoNum(9_999, { compact: true })).toBe("9,999");
  });

  test("1만 ~ 10만 → 1 fraction digit", () => {
    expect(formatKoNum(12_345, { compact: true })).toBe("1.2만");
    expect(formatKoNum(56_700, { compact: true })).toBe("5.7만");
  });

  test("10만+ → integer rounding", () => {
    expect(formatKoNum(123_456, { compact: true })).toBe("12만");
    expect(formatKoNum(1_234_567, { compact: true })).toBe("123만");
    expect(formatKoNum(12_345_678, { compact: true })).toBe("1,235만");
  });

  test("1억 ~ 10억 → 1 fraction digit", () => {
    expect(formatKoNum(123_456_789, { compact: true })).toBe("1.2억");
    expect(formatKoNum(567_000_000, { compact: true })).toBe("5.7억");
  });

  test("10억+ → integer rounding", () => {
    expect(formatKoNum(1_234_567_890, { compact: true })).toBe("12억");
    expect(formatKoNum(12_345_678_901, { compact: true })).toBe("123억");
  });

  test("compact preserves negative sign", () => {
    expect(formatKoNum(-1_234_567_890, { compact: true })).toBe("-12억");
    expect(formatKoNum(-12_345, { compact: true })).toBe("-1.2만");
  });
});

describe("formatLocalizedCount", () => {
  test("EN — falls back to en-US locale grouping", () => {
    expect(formatLocalizedCount(0, "en")).toBe("0");
    expect(formatLocalizedCount(123, "en")).toBe("123");
    expect(formatLocalizedCount(1_234, "en")).toBe("1,234");
    expect(formatLocalizedCount(12_345, "en")).toBe("12,345");
    expect(formatLocalizedCount(1_234_567, "en")).toBe("1,234,567");
  });

  test("KO — uses 만/억 idioms (matches formatKoNum verbose)", () => {
    expect(formatLocalizedCount(0, "ko")).toBe("0");
    expect(formatLocalizedCount(123, "ko")).toBe("123");
    expect(formatLocalizedCount(12_345, "ko")).toBe("1만 2,345");
    expect(formatLocalizedCount(1_234_567, "ko")).toBe("123만 4,567");
    expect(formatLocalizedCount(123_456_789, "ko")).toBe("1억 2,345만 6,789");
  });

  test("EN and KO diverge above 만 threshold (10,000)", () => {
    // Below threshold: EN/KO identical (no 만 idiom kicks in)
    expect(formatLocalizedCount(9_999, "en")).toBe("9,999");
    expect(formatLocalizedCount(9_999, "ko")).toBe("9,999");

    // At threshold: KO inserts 만, EN sticks with comma grouping
    expect(formatLocalizedCount(10_000, "en")).toBe("10,000");
    expect(formatLocalizedCount(10_000, "ko")).toBe("1만");
  });

  test("negative numbers preserve sign in both locales", () => {
    expect(formatLocalizedCount(-12_345, "en")).toBe("-12,345");
    expect(formatLocalizedCount(-12_345, "ko")).toBe("-1만 2,345");
  });
});
