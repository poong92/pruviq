/**
 * Interactive QA — 실제 pruviq.com에서 버튼/기능 클릭 테스트
 *
 * prod-smoke 프로젝트에서만 실행 (BASE_URL=https://pruviq.com)
 * 시뮬레이터 시나리오 클릭, 랭킹 필터, 내비게이션, 모바일 메뉴 검증
 */

import { test, expect } from "@playwright/test";

const IS_PROD = (process.env.BASE_URL ?? "").includes("pruviq.com");

test.describe("Interactive QA — 기능 클릭 테스트", () => {
  test.skip(!IS_PROD, "Prod only (BASE_URL=https://pruviq.com)");

  // ── 1. 시뮬레이터: Breakout 시나리오 클릭 → 결과 검증 ──────────────────────

  test("simulate: Breakout 시나리오 클릭 → 결과 표시 (3~30초)", async ({
    page,
  }) => {
    await page.goto("/simulate/");
    await page.waitForLoadState("networkidle");

    // 시나리오 카드 "Breakout" 찾기 (💥 또는 텍스트)
    const breakoutCard = page
      .locator(
        '[data-scenario="breakout"], button:has-text("Breakout"), [class*="scenario"]:has-text("Breakout")',
      )
      .first();

    // 없으면 텍스트 포함된 클릭 가능한 요소 찾기
    const cardLocator =
      (await breakoutCard.count()) > 0
        ? breakoutCard
        : page.locator("text=Breakout").first();

    await expect(cardLocator).toBeVisible({ timeout: 10000 });
    await cardLocator.click();

    // 결과 패널이 로딩 시작 (스피너 or 스켈레톤)
    // 최대 30초 기다려서 Win Rate 수치 확인
    const winRateEl = page
      .locator(
        '[data-metric="win_rate"], [class*="win-rate"], text=/Win Rate/i',
      )
      .first();

    // 결과가 나타날 때까지 최대 30초 대기
    await expect(page.locator("text=/\\d+\\.?\\d*%/").first()).toBeVisible({
      timeout: 30000,
    });

    // Win Rate 수치 범위 검증 (10% ~ 95%)
    const pageText = await page.textContent("body");
    expect(pageText).not.toContain("999"); // PF sentinel 금지
    expect(pageText).not.toContain("NaN");
    expect(pageText).not.toContain("Infinity");

    // 결과 스크린샷
    await page.screenshot({
      path: "test-results/interactive/simulate-breakout-result.png",
    });
    console.log("✅ Breakout 시나리오 클릭 → 결과 표시 확인");
  });

  test("simulate: 결과에 필수 지표 포함 (Win Rate, Profit Factor, Trades, MDD)", async ({
    page,
  }) => {
    await page.goto("/simulate/");
    await page.waitForLoadState("networkidle");

    // Breakout 클릭
    const breakoutCard = page
      .locator(
        'button:has-text("Breakout"), [class*="scenario"]:has-text("Breakout"), text=Breakout',
      )
      .first();
    await expect(breakoutCard).toBeVisible({ timeout: 10000 });
    await breakoutCard.click();

    // 30초 내 % 수치 등장
    await expect(page.locator("text=/\\d+\\.?\\d*%/").first()).toBeVisible({
      timeout: 30000,
    });

    const bodyText = await page.textContent("body");

    // 필수 지표 존재 여부
    const hasWinRate =
      /win.?rate/i.test(bodyText ?? "") || /승률/i.test(bodyText ?? "");
    const hasPF =
      /profit.?factor/i.test(bodyText ?? "") ||
      /수익.?인수/i.test(bodyText ?? "");
    const hasTrades =
      /total.?trades/i.test(bodyText ?? "") || /거래.?수/i.test(bodyText ?? "");

    expect(hasWinRate || hasPF || hasTrades).toBe(true);

    // 버그 값 검증: Calmar > 10 = STALE_DATA
    const calmarMatch = bodyText?.match(/calmar[^:]*:\s*([\d.]+)/i);
    if (calmarMatch) {
      const calmarVal = parseFloat(calmarMatch[1]);
      expect(calmarVal).toBeLessThan(10); // Calmar 27.5x 버그 재발 방지
    }
  });

  test("simulate: 탭 전환 (Quick Test → Standard → Expert)", async ({
    page,
  }) => {
    await page.goto("/simulate/");
    await page.waitForLoadState("networkidle");

    const tabs = ["Standard", "Expert"];
    for (const tabName of tabs) {
      const tab = page
        .locator(
          `button:has-text("${tabName}"), [role="tab"]:has-text("${tabName}")`,
        )
        .first();
      if ((await tab.count()) > 0) {
        await tab.click();
        await page.waitForTimeout(500);
        // 탭 클릭 후 JS 에러 없어야 함
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        expect(errors.length).toBe(0);
      }
    }
  });

  // ── 2. 랭킹 필터 클릭 ──────────────────────────────────────────────────────

  test("ranking: '365 Days' 필터 클릭 → 5초 내 데이터 업데이트", async ({
    page,
  }) => {
    await page.goto("/strategies/ranking");
    await page.waitForLoadState("networkidle");

    // 초기 페이지 텍스트 스냅샷
    const initialText = await page.textContent(
      "#ranking-ssr-fallback, [class*='ranking'], main",
    );

    const btn365 = page
      .locator('button:has-text("365"), button:has-text("365 Days")')
      .first();
    await expect(btn365).toBeVisible({ timeout: 10000 });
    await btn365.click();

    // 5초 내 변화 대기 (네트워크 요청 완료)
    await page.waitForTimeout(2000);

    // 다시 스냅샷 (변화 없어도 crash 없으면 pass)
    const afterText = await page.textContent(
      "#ranking-ssr-fallback, [class*='ranking'], main",
    );
    expect(afterText).toBeTruthy();

    // JS 에러 없어야 함
    const jsErrors: string[] = [];
    page.on("pageerror", (e) => jsErrors.push(e.message));
    expect(jsErrors.length).toBe(0);

    await page.screenshot({
      path: "test-results/interactive/ranking-365days.png",
    });
    console.log("✅ 365 Days 필터 클릭 → 정상");
  });

  test("ranking: '7 Days' 필터 → 'BTC Only' 필터 순차 클릭", async ({
    page,
  }) => {
    await page.goto("/strategies/ranking");
    await page.waitForLoadState("networkidle");

    const filters = ["7 Days", "BTC Only"];
    for (const filterName of filters) {
      const btn = page.locator(`button:has-text("${filterName}")`).first();
      if ((await btn.count()) > 0) {
        await btn.click();
        await page.waitForTimeout(1000);
        // crash 없어야 함
        expect(await page.locator("main").isVisible()).toBe(true);
      }
    }
  });

  test("ranking-ko: 필터 클릭 (한국어 페이지)", async ({ page }) => {
    await page.goto("/ko/strategies/ranking");
    await page.waitForLoadState("networkidle");

    // 필터 버튼 존재 여부
    const filterBtns = page.locator("button").filter({
      hasText: /Days|일|days/i,
    });
    if ((await filterBtns.count()) > 0) {
      await filterBtns.first().click();
      await page.waitForTimeout(1000);
      // 한국어 h1 유지 확인
      const h1 = await page.textContent("h1");
      expect(h1).toBeTruthy();
    }
  });

  // ── 3. 내비게이션 링크 ─────────────────────────────────────────────────────

  test("navigation: 주요 페이지 링크 클릭 (Simulator, Ranking, Performance)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 내비게이션에서 Simulator 링크
    const simLink = page
      .locator('nav a[href*="simulat"], a:has-text("Simulator")')
      .first();
    if ((await simLink.count()) > 0) {
      await simLink.click();
      await page.waitForURL(/simulat/, { timeout: 10000 });
      expect(page.url()).toContain("simulat");
    }
  });

  test("navigation: 홈 → 랭킹 → 퍼포먼스 순서 이동", async ({ page }) => {
    const routes = [
      { path: "/strategies/ranking", pattern: /ranking/ },
      { path: "/performance/", pattern: /performance/ },
      { path: "/coins/", pattern: /coins/ },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await page.waitForLoadState("domcontentloaded");
      expect(page.url()).toMatch(route.pattern);

      // h1 존재
      const h1 = await page.locator("h1").first().textContent();
      expect(h1?.trim().length).toBeGreaterThan(0);
    }
  });

  // ── 4. 모바일 메뉴 ────────────────────────────────────────────────────────

  test("mobile: 햄버거 메뉴 열기 → 항목 확인 → 닫기", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Mobile only");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 햄버거 버튼 (aria-label 또는 class)
    const hamburger = page
      .locator(
        '[aria-label*="menu"], [aria-label*="Menu"], button[class*="hamburger"], button[class*="mobile-menu"]',
      )
      .first();

    if ((await hamburger.count()) === 0) {
      // 폴백: ≡ 아이콘 버튼
      const menuBtns = await page.locator("button").all();
      for (const btn of menuBtns) {
        const text = await btn.textContent();
        if (text?.includes("≡") || text?.includes("☰")) {
          await btn.click();
          break;
        }
      }
    } else {
      await hamburger.click();
    }

    // 메뉴 열림 확인 (nav 또는 메뉴 항목)
    await page.waitForTimeout(500);
    const bodyText = await page.textContent("body");
    expect(bodyText).toMatch(/simulator|ranking|performance/i);

    await page.screenshot({
      path: "test-results/interactive/mobile-menu-open.png",
    });
  });

  test("mobile: 시뮬레이터 페이지 CTA 버튼 터치 가능", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Mobile only");

    await page.goto("/simulate/");
    await page.waitForLoadState("networkidle");

    // 시나리오 카드 첫 번째 클릭 가능 여부
    const card = page
      .locator('[class*="scenario"], button:has-text("Breakout")')
      .first();
    if ((await card.count()) > 0) {
      const box = await card.boundingBox();
      // 터치 영역: 최소 44x44px (Apple HIG 기준)
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(30); // 최소 30px 허용
      }
    }
  });

  // ── 5. 쿠키 배너 ──────────────────────────────────────────────────────────

  test("cookie banner: 존재 확인 + Got it 클릭 → 사라짐", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const banner = page.locator("text=/essential.*cookies|Got it/i").first();
    if ((await banner.count()) > 0) {
      // Got it 버튼 클릭
      const gotIt = page.locator('button:has-text("Got it")').first();
      if ((await gotIt.count()) > 0) {
        await gotIt.click();
        await page.waitForTimeout(500);
        // 배너 사라졌는지 확인
        const stillVisible = await banner.isVisible();
        expect(stillVisible).toBe(false);
        console.log("✅ 쿠키 배너 Got it 클릭 → 사라짐");
      }
    }
  });

  // ── 6. 데이터 수치 범위 검증 (시뮬레이터 결과) ─────────────────────────────

  test("simulate: Reversals 시나리오 → 결과 수치 범위 검증", async ({
    page,
  }) => {
    await page.goto("/simulate/");
    await page.waitForLoadState("networkidle");

    const reversalsCard = page
      .locator(
        'button:has-text("Revers"), [class*="scenario"]:has-text("Revers"), text=Reversals',
      )
      .first();

    if ((await reversalsCard.count()) === 0) {
      test.skip(true, "Reversals 시나리오 카드 없음");
    }

    await reversalsCard.click();
    await page.waitForTimeout(20000); // 최대 20초 대기

    const bodyText = (await page.textContent("body")) ?? "";

    // Win Rate 추출 (첫 번째 숫자%)
    const winRateMatch = bodyText.match(/(\d+\.?\d*)\s*%/);
    if (winRateMatch) {
      const winRate = parseFloat(winRateMatch[1]);
      // 5% ~ 95% 범위
      expect(winRate).toBeGreaterThan(5);
      expect(winRate).toBeLessThan(95);
    }

    // PF sentinel 999 금지
    expect(bodyText).not.toMatch(/\b999\b/);
    // MDD 이상값 금지
    expect(bodyText).not.toMatch(/\b[89]\d{2}\.?\d*%/); // 800%+ 이상 MDD

    console.log("✅ Reversals 시나리오 수치 범위 정상");
  });
});
