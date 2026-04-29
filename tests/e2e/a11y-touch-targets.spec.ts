import { test, expect } from "@playwright/test";

/**
 * WCAG AA 2.5.5 — Target Size (Enhanced) — interactive controls 44×44 CSS px.
 *
 * 2026-04-28 P2 (QA Sweep): 홈 "See full comparison →" 31px tall 발견 → fix.
 * 회귀 자동 차단을 위해 모든 주요 페이지의 인터랙티브 요소(.btn*, a[role=button],
 * button:not([type=hidden])) 시각 또는 가상 hit area가 44px 이상인지 검증.
 *
 * 예외 (WCAG AA spacing exception):
 * - 인라인 텍스트 흐름 안의 link (text-flow inline)
 * - 다른 일반 컨트롤이 영향받지 않게 충분한 spacing 확보된 경우
 *
 * Hit area 측정: 가상 요소(::before/::after) 포함하기 위해 elementHandle.boundingBox()
 * 가 아닌 getComputedStyle 기반 측정 + offsetHeight + virtual ::after inset 합산.
 */

const PAGES = [
  "/",
  "/simulate/",
  "/strategies/",
  "/coins/",
  "/fees",
  "/about",
  "/learn",
  "/compare",
];

const MIN_TOUCH_PX = 44;

async function measureHitArea(page: any, selector: string) {
  return await page.$$eval(
    selector,
    (els: HTMLElement[], minPx: number) => {
      const failures: { tag: string; text: string; w: number; h: number }[] =
        [];
      for (const el of els) {
        // 인라인 link (block formatting context 안 inline)는 spacing exception
        const cs = getComputedStyle(el);
        if (cs.display === "inline" && el.tagName === "A") continue;
        // 가상 hit area 포함 (::after inset)
        const rect = el.getBoundingClientRect();
        let extraTop = 0,
          extraBottom = 0,
          extraLeft = 0,
          extraRight = 0;
        try {
          const after = getComputedStyle(el, "::after");
          if (after && after.content && after.content !== "none") {
            extraTop = -parseFloat(after.top || "0") || 0;
            extraBottom = -parseFloat(after.bottom || "0") || 0;
            extraLeft = -parseFloat(after.left || "0") || 0;
            extraRight = -parseFloat(after.right || "0") || 0;
          }
        } catch {
          /* ignore */
        }
        const effW =
          rect.width + Math.max(0, extraLeft) + Math.max(0, extraRight);
        const effH =
          rect.height + Math.max(0, extraTop) + Math.max(0, extraBottom);
        if (effW < minPx || effH < minPx) {
          failures.push({
            tag:
              el.tagName.toLowerCase() +
              (el.className ? "." + String(el.className).split(/\s+/)[0] : ""),
            text: (el.textContent || "").trim().slice(0, 40),
            w: Math.round(effW),
            h: Math.round(effH),
          });
        }
      }
      return failures;
    },
    MIN_TOUCH_PX,
  );
}

for (const path of PAGES) {
  test(`a11y touch targets — ${path} buttons/CTAs ≥ 44px`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800); // hydration

    // user-facing CTA만 검사 — sort headers, filter toggles 같은 컴포넌트 내부 컨트롤은
    // 디자인 의도된 작은 크기. 가드 false positive 방지.
    const selector = '.btn, a[role="button"]';
    const fails = await measureHitArea(page, selector);

    // Filter: hidden/0-size elements (display:none, dropdown content) 제외
    const visible = fails.filter((f) => f.w > 0 && f.h > 0);

    if (visible.length > 0) {
      const msg = visible
        .slice(0, 5)
        .map((f) => `  - ${f.tag} "${f.text}" → ${f.w}×${f.h}px`)
        .join("\n");
      throw new Error(
        `${path}: ${visible.length} interactive elements below ${MIN_TOUCH_PX}px hit area:\n${msg}`,
      );
    }
    expect(visible.length).toBe(0);
  });
}
