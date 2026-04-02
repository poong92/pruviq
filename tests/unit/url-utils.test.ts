import { describe, expect, test } from "vitest";
import {
  getAlternatePath,
  getBasePath,
  getLocalizedPath,
} from "../../src/i18n/index";

describe("URL utilities", () => {
  test("getBasePath removes /ko prefix", () => {
    expect(getBasePath("/ko/simulate")).toBe("/simulate");
    expect(getBasePath("/ko/")).toBe("/");
    expect(getBasePath("/simulate")).toBe("/simulate");
  });

  test("getLocalizedPath adds /ko for Korean", () => {
    expect(getLocalizedPath("/simulate", "ko")).toBe("/ko/simulate");
    expect(getLocalizedPath("/", "ko")).toBe("/ko");
  });

  test("getLocalizedPath returns base for English", () => {
    expect(getLocalizedPath("/simulate", "en")).toBe("/simulate");
  });

  test("getAlternatePath returns opposite language", () => {
    expect(getAlternatePath("/simulate", "en")).toBe("/ko/simulate");
    expect(getAlternatePath("/ko/simulate", "ko")).toBe("/simulate");
  });
});
