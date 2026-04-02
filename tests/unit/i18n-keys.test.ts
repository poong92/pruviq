import { describe, expect, test } from "vitest";
import { en } from "../../src/i18n/en";
import { ko } from "../../src/i18n/ko";

describe("i18n key parity", () => {
  const enKeys = Object.keys(en).sort();
  const koKeys = Object.keys(ko).sort();

  test("EN and KO have same number of keys", () => {
    expect(enKeys.length).toBe(koKeys.length);
  });

  test("every EN key exists in KO", () => {
    const missing = enKeys.filter((k) => !koKeys.includes(k));
    expect(missing).toEqual([]);
  });

  test("every KO key exists in EN", () => {
    const missing = koKeys.filter((k) => !enKeys.includes(k));
    expect(missing).toEqual([]);
  });

  test("no empty values in EN", () => {
    const empty = enKeys.filter(
      (k) =>
        !en[k as keyof typeof en] ||
        String(en[k as keyof typeof en]).trim() === "",
    );
    expect(empty).toEqual([]);
  });

  test("no empty values in KO", () => {
    const empty = koKeys.filter(
      (k) =>
        !ko[k as keyof typeof ko] ||
        String(ko[k as keyof typeof ko]).trim() === "",
    );
    expect(empty).toEqual([]);
  });
});
