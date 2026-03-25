/**
 * Interactive QA — 실제 pruviq.com에서 버튼/기능 클릭 테스트
 *
 * prod-smoke 프로젝트에서만 실행 (BASE_URL=https://pruviq.com)
 * data-testid 기반 안정적 selector 사용
 */

import { test, expect } from "@playwright/test";

const IS_PROD = (process.env.BASE_URL ?? "").includes("pruviq.com");

test.describe("Interactive QA — 기능 클릭 테스트", () => {
  test.skip(!IS_PROD, "Prod only (BASE_URL=https://pruviq.com)");

  // ── 1. 시뮬레이터: Breakout 시나리오 클릭 → 결과 검증 ──────────────────────

  test("simulate: Breakout 시나리오 클릭 → 결과 표시", async ({ page }) => {
    await page.goto("/simulate/");
    await page.waitForLoadState("domcontentloaded");

    // data-testid 기반 Breakout 카드 찾기
    const breakoutCard = page.locator('[data-testid="quick-cat-breakout"]');
    // fallback: 텍스트 기반
    const cardLocator =
      (await breakoutCard.count()) > 0
        ? breakoutCard
        : page.locator("button:has-text('Breakout')").first();

    await expect(cardLocator).toBeVisible({ timeout: 15000 });
    await cardLocator.click();

    // 결과가 나타날 때까지 최대 60초 대기 (API 응답 포함)
    await expect(page.locator("text=/\\d+\\.?\\d*%/").first()).toBeVisible({
      timeout: 60000,
    });

    // 버그 값 없어야 함
    const pageText = await page.textContent("body");
    expect(pageText).not.toContain("NaN");
    expect(pageText).not.toContain("Infinity");

    console.log("✅ Breakout 시나리오 클릭 → 결과 표시 확인");
  });

  test("simulate: 결과에 필수 지표 포함", async ({ page }) => {
    await page.goto("/simulate/");
    await page.waitForLoadState("domcontentloaded");

    // Breakout 클릭
    const breakoutCard = page
      .locator('[data-testid="quick-cat-breakout"]')
      .first();
    await expect(breakoutCard).toBeVisible({ timeout: 10000 });
    await breakoutCard.click();

    await expect(page.locator("text=/\\d+\\.?\\d*%/").first()).toBeVisible({
      timeout: 60000,
    });

    const bodyText = await page.textContent("body");

    const hasWinRate =
      /win.?rate/i.test(bodyText ?? "") || /승률/i.test(bodyText ?? "");
    const hasPF =
      /profit.?factor/i.test(bodyText ?? "") ||
      /수익.?팩터/i.test(bodyText ?? "");
    const hasTrades =
      /total.?trades/i.test(bodyText ?? "") || /거래/i.test(bodyText ?? "");

    expect(hasWinRate || hasPF || hasTrades).toBe(true);

    // Calmar 버그 재발 방지 (값이 명시적으로 "Calmar" 레이블 옆에 있을 때만)
    const calmarMatch = bodyText?.match(
      /calmar\s*(?:ratio)?\s*[:=]\s*([\d.]+)/i,
    );
    if (calmarMatch) {
      expect(parseFloat(calmarMatch[1])).toBeLessThan(15);
    }
  });

  test("simulate: 탭 전환 (Quick Test → Standard → Expert)", async ({
    page,
  }) => {
    await page.goto("/simulate/");
    await page.waitForLoadState("domcontentloaded");

    // JS 에러 수집 — 액션 전에 리스너 등록
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // data-testid 기반 모드 탭 전환
    for (const mode of ["standard", "expert", "quick"]) {
      const tab = page.locator(`[data-testid="mode-${mode}"]`);
      if ((await tab.count()) > 0) {
        await tab.click();
        await page.waitForTimeout(300);
      }
    }

    await page.waitForTimeout(500);
    expect(errors.length).toBe(0);
  });

  // ── 2. 결과 탭 전환 검증 ──────────────────────────────────────────────────

  test("simulate: 결과 탭 4개 전환 (Summary/Equity/Trades/Coins)", async ({
    page,
  }) => {
    await page.goto("/simulate/");
    await page.waitForLoadState("domcontentloaded");

    // Breakout 클릭하여 결과 생성
    const breakoutCard = page.locator('[data-testid="quick-cat-breakout"]');
    const cardLocator =
      (await breakoutCard.count()) > 0
        ? breakoutCard
        : page.locator("button:has-text('Breakout')").first();
    await expect(cardLocator).toBeVisible({ timeout: 15000 });
    await cardLocator.click();

    // 결과 대기
    await expect(page.locator("text=/\\d+\\.?\\d*%/").first()).toBeVisible({
      timeout: 60000,
    });

    // 각 탭 전환
    for (const tab of ["equity", "trades", "coins", "summary"]) {
      const tabBtn = page.locator(`[data-testid="tab-${tab}"]`);
      if ((await tabBtn.count()) > 0) {
        await tabBtn.click();
        await page.waitForTimeout(300);
        // 탭 클릭 후 에러 없어야 함
        const bodyText = await page.textContent("body");
        expect(bodyText).not.toContain("undefined");
      }
    }
  });

  // ── 3. Direction 전환 검증 ────────────────────────────────────────────────

  test("simulate: Expert 모드 Direction SHORT/LONG/BOTH 전환", async ({
    page,
  }) => {
    await page.goto("/simulate/");
    await page.waitForLoadState("domcontentloaded");

    // JS 에러 수집 — 액션 전에 리스너 등록
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // Expert 모드로 전환
    const expertTab = page.locator('[data-testid="mode-expert"]');
    if ((await expertTab.count()) > 0) {
      await expertTab.click();
      await page.waitForTimeout(500);
    }

    // Direction 버튼 클릭
    for (const dir of ["long", "both", "short"]) {
      const dirBtn = page.locator(`[data-testid="dir-${dir}"]`);
      if ((await dirBtn.count()) > 0) {
        await dirBtn.click();
        await page.waitForTimeout(200);
      }
    }

    await page.waitForTimeout(300);
    expect(errors.length).toBe(0);
  });

  // ── 4. 랭킹 필터 클릭 ──────────────────────────────────────────────────────

  test("ranking: 필터 클릭 → 데이터 업데이트", async ({ page }) => {
    await page.goto("/strategies/ranking");
    await page.waitForLoadState("domcontentloaded");

    // JS 에러 수집 — 액션 전에 리스너 등록
    const jsErrors: string[] = [];
    page.on("pageerror", (e) => jsErrors.push(e.message));

    const btn365 = page
      .locator('button:has-text("365"), button:has-text("365 Days")')
      .first();

    if ((await btn365.count()) > 0) {
      await expect(btn365).toBeVisible({ timeout: 10000 });
      await btn365.click();
      await page.waitForTimeout(2000);

      const afterText = await page.textContent("main");
      expect(afterText).toBeTruthy();
    }

    expect(jsErrors.length).toBe(0);
  });

  // ── 5. 내비게이션 링크 ─────────────────────────────────────────────────────

  test("navigation: 주요 페이지 순차 이동", async ({ page }) => {
    const routes = [
      { path: "/strategies/ranking", pattern: /ranking/ },
      { path: "/coins/", pattern: /coins/ },
      { path: "/simulate/", pattern: /simulat/ },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await page.waitForLoadState("domcontentloaded");
      expect(page.url()).toMatch(route.pattern);

      const h1 = await page.locator("h1").first().textContent();
      expect(h1?.trim().length).toBeGreaterThan(0);
    }
  });

  // ── 6. Chart 심볼 전환 ─────────────────────────────────────────────────────

  test("simulate: Chart 심볼 버튼 (BTC/ETH/SOL) 클릭", async ({ page }) => {
    await page.goto("/simulate/");
    await page.waitForLoadState("domcontentloaded");

    // Expert 모드에서 차트 확인
    const expertTab = page.locator('[data-testid="mode-expert"]');
    if ((await expertTab.count()) > 0) {
      await expertTab.click();
      await page.waitForTimeout(500);
    }

    for (const sym of ["eth", "sol", "btc"]) {
      const btn = page.locator(`[data-testid="chart-${sym}"]`);
      if ((await btn.count()) > 0) {
        await btn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Canvas 렌더링 확인
    const canvas = page.locator("canvas");
    if ((await canvas.count()) > 0) {
      const box = await canvas.first().boundingBox();
      expect(box).toBeTruthy();
      expect(box!.width).toBeGreaterThan(100);
      expect(box!.height).toBeGreaterThan(50);
    }
  });

  // ── 7. Reversals 시나리오 수치 범위 검증 ─────────────────────────────────

  test("simulate: Reversals 시나리오 → 수치 범위 검증", async ({ page }) => {
    await page.goto("/simulate/");
    await page.waitForLoadState("domcontentloaded");

    const reversalsCard = page.locator('[data-testid="quick-cat-reversal"]');
    const cardLocator =
      (await reversalsCard.count()) > 0
        ? reversalsCard
        : page.locator("button:has-text('Revers')").first();

    if ((await cardLocator.count()) === 0) {
      test.skip(true, "Reversals 시나리오 카드 없음");
      return;
    }

    await cardLocator.click();

    const resultIndicator = page.locator("text=/\\d+\\.?\\d*%/").first();
    await expect(resultIndicator).toBeVisible({ timeout: 60000 });

    const bodyText = (await page.textContent("body")) ?? "";

    // PF sentinel 999 금지
    expect(bodyText).not.toMatch(/\b999\b/);
    // MDD 800%+ 이상 금지
    expect(bodyText).not.toMatch(/\b[89]\d{2}\.?\d*%/);

    console.log("✅ Reversals 시나리오 수치 범위 정상");
  });

  // ── 8. Copy Link 버튼 클릭 ────────────────────────────────────────────────

  test("simulate: Copy Link 버튼 클릭 → Copied 표시", async ({ page }) => {
    await page.goto("/simulate/");
    await page.waitForLoadState("domcontentloaded");

    // Breakout 클릭
    const breakoutCard = page
      .locator('[data-testid="quick-cat-breakout"]')
      .first();
    await expect(breakoutCard).toBeVisible({ timeout: 10000 });
    await breakoutCard.click();

    // 결과 대기
    await expect(page.locator("text=/\\d+\\.?\\d*%/").first()).toBeVisible({
      timeout: 60000,
    });

    // Copy Link 버튼 클릭 (headless에서 clipboard API 제한 → 클릭 에러 없음만 확인)
    const copyBtn = page.locator('[data-testid="copy-link"]').first();
    await expect(copyBtn).toBeVisible({ timeout: 10000 });
    await copyBtn.click();
    await page.waitForTimeout(500);
    console.log("✅ Copy Link 버튼 클릭 → 에러 없음");
  });

  // ── 9. CSV Download 버튼 존재 확인 ────────────────────────────────────────

  test("simulate: Download CSV 버튼 존재 확인", async ({ page }) => {
    await page.goto("/simulate/");
    await page.waitForLoadState("domcontentloaded");

    // Breakout 클릭
    const breakoutCard = page
      .locator('[data-testid="quick-cat-breakout"]')
      .first();
    await expect(breakoutCard).toBeVisible({ timeout: 10000 });
    await breakoutCard.click();

    // 결과 대기
    await expect(page.locator("text=/\\d+\\.?\\d*%/").first()).toBeVisible({
      timeout: 60000,
    });

    // Download CSV 버튼 존재 확인
    const downloadBtn = page.locator('[data-testid="download-csv"]').first();
    await expect(downloadBtn).toBeVisible({ timeout: 10000 });

    console.log("✅ Download CSV 버튼 존재 확인");
  });

  // ── 10. Avoid Hours UI 클릭 ───────────────────────────────────────────────

  test("simulate: Expert Avoid Hours 버튼 클릭", async ({ page }) => {
    await page.goto("/simulate/");
    await page.waitForLoadState("domcontentloaded");

    // JS 에러 수집
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // Expert 탭 클릭
    const expertTab = page
      .locator('[data-testid="mode-expert"], button:has-text("Expert")')
      .first();
    if ((await expertTab.count()) > 0) {
      await expertTab.click();
      await page.waitForTimeout(500);
    }

    // Avoid Hours: Expert 패널 내 "Avoid Hours" 텍스트 근처 버튼 찾기
    // collapsible 섹션이므로 먼저 토글 클릭
    const avoidToggle = page.locator("text=/Avoid Hours/i").first();
    if ((await avoidToggle.count()) > 0) {
      await avoidToggle.click();
      await page.waitForTimeout(300);
      // 시간 버튼 (0-23) 중 첫 번째 클릭
      const hourBtns = page
        .locator("button")
        .filter({ hasText: /^[0-9]{1,2}$/ });
      if ((await hourBtns.count()) > 0) {
        await hourBtns.first().click();
        await page.waitForTimeout(200);
      }
    }

    // JS 에러 없음 확인
    expect(errors.length).toBe(0);

    console.log("✅ Expert Avoid Hours 버튼 클릭 → JS 에러 없음");
  });

  // ── 11. Quick Adjust 토글 ────────────────────────────────────────────────

  test("simulate: Quick Adjust 토글 → 슬라이더 표시", async ({ page }) => {
    await page.goto("/simulate/");
    await page.waitForLoadState("domcontentloaded");

    // Breakout 클릭
    const breakoutCard = page
      .locator('[data-testid="quick-cat-breakout"]')
      .first();
    await expect(breakoutCard).toBeVisible({ timeout: 10000 });
    await breakoutCard.click();

    // 결과 대기
    await expect(page.locator("text=/\\d+\\.?\\d*%/").first()).toBeVisible({
      timeout: 60000,
    });

    // Quick Adjust 토글 클릭
    const toggleBtn = page
      .locator('[data-testid="quick-adjust-toggle"]')
      .first();
    await expect(toggleBtn).toBeVisible({ timeout: 10000 });
    await toggleBtn.click();

    // 슬라이더 visible 확인
    const slider = page
      .locator('input[type="range"], [class*="slider"]')
      .first();
    await expect(slider).toBeVisible({ timeout: 5000 });

    console.log("✅ Quick Adjust 토글 → 슬라이더 표시 확인");
  });

  // ── 12. Expert 프리셋 3개 순차 클릭 ──────────────────────────────────────

  test("simulate: Expert 프리셋 3개 순차 클릭", async ({ page }) => {
    await page.goto("/simulate/");
    await page.waitForLoadState("domcontentloaded");

    // JS 에러 수집
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // Expert 탭 클릭
    const expertTab = page
      .locator('[data-testid="mode-expert"], button:has-text("Expert")')
      .first();
    if ((await expertTab.count()) > 0) {
      await expertTab.click();
      await page.waitForTimeout(500);
    }

    // 프리셋 3개 순차 클릭
    const presets = [
      '[data-testid="preset-bb-squeeze-short"]',
      '[data-testid="preset-macd-crossover-short"]',
      '[data-testid="preset-custom"]',
    ];

    for (const selector of presets) {
      const presetBtn = page.locator(selector).first();
      if ((await presetBtn.count()) > 0) {
        await presetBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // JS 에러 없음 확인
    expect(errors.length).toBe(0);

    console.log("✅ Expert 프리셋 3개 순차 클릭 → JS 에러 없음");
  });

  // ── 13. 쿠키 배너 ─────────────────────────────────────────────────────────

  test("cookie banner: Got it 클릭 → 사라짐", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const gotIt = page.locator('button:has-text("Got it")').first();
    if ((await gotIt.count()) > 0) {
      await gotIt.click();
      await page.waitForTimeout(500);
      await expect(gotIt).not.toBeVisible();
    }
  });

  // ── 14. 모바일 메뉴 ───────────────────────────────────────────────────────

  test("mobile: 햄버거 메뉴 열기 → 닫기", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Mobile only");

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const hamburger = page
      .locator('[aria-label*="menu"], [aria-label*="Menu"]')
      .first();

    if ((await hamburger.count()) > 0) {
      await hamburger.click();
      await page.waitForTimeout(500);
      const bodyText = await page.textContent("body");
      expect(bodyText).toMatch(/simulat|ranking|coins/i);
    }
  });
});
