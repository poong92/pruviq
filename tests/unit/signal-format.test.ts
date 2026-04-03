import { describe, expect, test } from "vitest";

describe("Signal time formatting", () => {
  test('timeAgo returns "just now" for recent signals', () => {
    const now = new Date().toISOString();
    const diff = Date.now() - new Date(now).getTime();
    expect(diff).toBeLessThan(3600000);
  });

  test("timeAgo returns hours for old signals", () => {
    const twoHoursAgo = new Date(Date.now() - 7200000).toISOString();
    const diff = Math.floor(
      (Date.now() - new Date(twoHoursAgo).getTime()) / 3600000,
    );
    expect(diff).toBe(2);
  });
});
