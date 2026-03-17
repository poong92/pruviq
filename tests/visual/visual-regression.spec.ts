import { test, expect } from "@playwright/test";

/**
 * Visual Regression Tests — baseline 대비 픽셀 diff 비교
 *
 * 첫 실행 시: npx playwright test visual-regression --update-snapshots
 * 이후 PR에서: baseline 대비 diff가 있으면 CI 실패
 *
 * 커버리지:
 * - /rankings 필터 버튼 레이아웃 (배지 겹침, phantom 버튼 방지)
 * - / 홈페이지 히어로 (정적 영역만)
 * - /strategies 카드 그리드 (정적 영역만)
 */

const THRESHOLD = {
  maxDiffPixelRatio: 0.02, // 2% 이하 변화는 허용
  animations: "disabled" as const, // CSS 애니메이션 비활성화 → 안정적 스냅샷
};

// ─── Rankings Page ─────────────────────────────────────────────────────────
// rankings 페이지는 라이브 API 데이터를 사용 → 동적 콘텐츠 영역은 마스킹,
// 필터 버튼 레이아웃(정적 UI)만 검증

test.describe("Rankings page — visual regression", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("period + group filter buttons — desktop", async ({ page }) => {
    await page.goto("/rankings", { waitUntil: "networkidle" });
    // Preact 하이드레이션 후 필터 버튼이 렌더링될 때까지 대기
    await page
      .waitForSelector("button[data-period], button[data-group]", {
        timeout: 15000,
      })
      .catch(() => {});
    await page.waitForTimeout(500); // 추가 안정화

    const filters = page.locator(".space-y-3").first();
    await expect(filters).toHaveScreenshot(
      "rankings-filters-desktop.png",
      THRESHOLD,
    );
  });

  test("rankings filter buttons — mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/rankings", { waitUntil: "networkidle" });
    await page
      .waitForSelector("button[data-period], button[data-group]", {
        timeout: 15000,
      })
      .catch(() => {});
    await page.waitForTimeout(500);

    const filters = page.locator(".space-y-3").first();
    await expect(filters).toHaveScreenshot(
      "rankings-filters-mobile.png",
      THRESHOLD,
    );
  });
});

// ─── Homepage ──────────────────────────────────────────────────────────────

test.describe("Homepage — visual regression", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("homepage hero — desktop", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    await expect(page).toHaveScreenshot("home-hero-desktop.png", {
      ...THRESHOLD,
      clip: { x: 0, y: 0, width: 1280, height: 600 },
    });
  });
});

// ─── Strategies Page ───────────────────────────────────────────────────────

test.describe("Strategies page — visual regression", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("strategy card grid — desktop", async ({ page }) => {
    await page.goto("/strategies", { waitUntil: "networkidle" });

    await expect(page).toHaveScreenshot("strategies-grid-desktop.png", {
      ...THRESHOLD,
      clip: { x: 0, y: 0, width: 1280, height: 800 },
    });
  });
});
