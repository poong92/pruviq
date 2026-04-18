/**
 * sim-audit.spec.ts
 * 시뮬레이터 페이지 감사 — EN/KO 양방향, 3개 모드, 결과 탭, UX 체크
 * BASE_URL=https://pruviq.com npx playwright test tests/sim-audit.spec.ts --project=prod-smoke
 */
import { test, expect, Page } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SS_DIR = path.resolve(__dirname, "sim-audit-screenshots");

async function ss(page: Page, name: string) {
  await page.screenshot({
    path: path.join(SS_DIR, `${name}.png`),
    fullPage: false,
  });
}

async function ssFull(page: Page, name: string) {
  await page.screenshot({
    path: path.join(SS_DIR, `${name}.png`),
    fullPage: true,
  });
}

// ── 공통 헬퍼: 시뮬레이터 Preact 컴포넌트가 마운트될 때까지 대기 ──
async function waitForSimulator(page: Page) {
  // spinner가 사라지고 ModeSwitcher가 나타날 때까지
  await page
    .waitForSelector(
      "#simulator-mount .mode-switcher, #simulator-mount [class*='mode'], #simulator-mount button",
      {
        timeout: 20000,
      },
    )
    .catch(() => {});
  // 추가로 loader가 사라질 때 대기
  await page
    .waitForFunction(
      () => {
        const spinner = document.querySelector(".spinner");
        return !spinner || (spinner as HTMLElement).offsetParent === null;
      },
      { timeout: 20000 },
    )
    .catch(() => {});
  await page.waitForTimeout(1500);
}

// ── 결과가 나타날 때까지 대기 ──
async function waitForResults(page: Page, timeoutMs = 60000) {
  await page
    .waitForSelector(
      '[data-tab="summary"], [class*="result"], table, [class*="ResultsPanel"]',
      { timeout: timeoutMs },
    )
    .catch(() => {});
  await page.waitForTimeout(1000);
}

// ─────────────────────────────────────────────────
// 1. 페이지 로드 + 정적 텍스트 감사
// ─────────────────────────────────────────────────
test.describe("1. Page Load & Static Text", () => {
  test("EN /simulate/ — 페이지 로드, 하드코딩 텍스트 체크", async ({
    page,
  }) => {
    await page.goto("/simulate/", { waitUntil: "domcontentloaded" });
    await ssFull(page, "01-en-simulate-load");

    // title
    const title = await page.title();
    expect(title.length, "EN title should not be empty").toBeGreaterThan(5);

    // 하드코딩된 영문 텍스트들 (EN 페이지는 정상)
    const bodyText = await page.locator("body").innerText();

    // "simulations run" / "coins analyzed" / "strategies available" counter 텍스트가 존재해야 함
    expect(bodyText).toContain("simulations run");
    expect(bodyText).toContain("coins analyzed");
    expect(bodyText).toContain("strategies available");

    // 알려진 하드코딩 패턴: "How we calculate" 링크
    const hardcodedLink = page.locator('text="How we calculate →"');
    const cnt = await hardcodedLink.count();
    console.log(`[EN] 'How we calculate →' count: ${cnt}`);

    // "First time? Try a preset strategy" Quick Start 배너 (EN 정상)
    const bannerText = await page.locator("text=First time?").count();
    console.log(`[EN] 'First time?' banner count: ${bannerText}`);

    // "Run a backtest to see your results" 오버레이
    const overlayText = await page
      .locator("text=Run a backtest to see your results")
      .count();
    console.log(`[EN] overlay text count: ${overlayText}`);
  });

  test("KO /ko/simulate/ — 영문 하드코딩 누락 체크", async ({ page }) => {
    await page.goto("/ko/simulate/", { waitUntil: "domcontentloaded" });
    await ssFull(page, "02-ko-simulate-load");

    const bodyText = await page.locator("body").innerText();

    // KO 페이지에서 카운터는 한국어여야 함
    expect(bodyText).toContain("시뮬레이션 실행");
    expect(bodyText).toContain("코인 분석");
    expect(bodyText).toContain("전략 이용 가능");

    // [ISSUE CHECK] EN 하드코딩이 KO 페이지에 남아있는지
    const issues: string[] = [];

    if (bodyText.includes("simulations run")) {
      issues.push("HARDCODED EN: 'simulations run' found on KO page");
    }
    if (bodyText.includes("coins analyzed")) {
      issues.push("HARDCODED EN: 'coins analyzed' found on KO page");
    }
    if (bodyText.includes("strategies available")) {
      issues.push("HARDCODED EN: 'strategies available' found on KO page");
    }
    if (bodyText.includes("How we calculate")) {
      issues.push("HARDCODED EN: 'How we calculate' link found on KO page");
    }
    if (bodyText.includes("First time?")) {
      issues.push("HARDCODED EN: 'First time?' banner found on KO page");
    }
    if (bodyText.includes("Pick a strategy from Hot Strategies")) {
      issues.push(
        "HARDCODED EN: Quick Start banner body text found on KO page",
      );
    }
    if (bodyText.includes("Run a backtest to see your results")) {
      issues.push("HARDCODED EN: overlay CTA text found on KO page");
    }
    if (
      bodyText.includes("Start with BB Squeeze (Verified)") &&
      !bodyText.includes("BB Squeeze로 시작하기")
    ) {
      issues.push(
        "HARDCODED EN: 'Start with BB Squeeze (Verified)' CTA found on KO page",
      );
    }
    if (bodyText.includes("Choose a preset or build your own strategy")) {
      issues.push("HARDCODED EN: loading sub-text found on KO page");
    }

    if (issues.length > 0) {
      await ss(page, "02-ko-hardcoded-issues");
      console.warn("=== KO HARDCODED ISSUES ===");
      issues.forEach((i) => console.warn(" " + i));
    }

    // 페이지 로드 자체는 성공해야 함
    expect(bodyText.length, "KO page should have content").toBeGreaterThan(100);
  });
});

// ─────────────────────────────────────────────────
// 2. Simulator 컴포넌트 로드 (EN+KO)
// ─────────────────────────────────────────────────
test.describe("2. Simulator Component Mount", () => {
  test("EN — simulator mounts with preset=bb-squeeze-short", async ({
    page,
  }) => {
    await page.goto("/simulate/?preset=bb-squeeze-short", {
      waitUntil: "domcontentloaded",
    });
    await waitForSimulator(page);
    await ss(page, "03-en-simulator-mounted");

    // Preact 컴포넌트가 마운트됐는지 확인: animate-pulse skeleton이 사라져야 함
    const skeletonVisible = await page
      .locator(".animate-pulse")
      .isVisible()
      .catch(() => false);
    if (skeletonVisible) {
      await ss(page, "03-en-skeleton-still-visible");
      console.warn(
        "[EN] Skeleton still visible — simulator may not have mounted",
      );
    }

    // ModeSwitcher 또는 QuickTest 버튼 존재 확인
    const buttons = await page.locator("#simulator-mount button").count();
    console.log(`[EN] Simulator buttons count: ${buttons}`);
    expect(
      buttons,
      "EN: Simulator should render buttons after mount",
    ).toBeGreaterThan(0);
  });

  test("KO — simulator mounts with preset=bb-squeeze-short", async ({
    page,
  }) => {
    await page.goto("/ko/simulate/?preset=bb-squeeze-short", {
      waitUntil: "domcontentloaded",
    });
    await waitForSimulator(page);
    await ss(page, "04-ko-simulator-mounted");

    const buttons = await page.locator("#simulator-mount button").count();
    console.log(`[KO] Simulator buttons count: ${buttons}`);
    expect(
      buttons,
      "KO: Simulator should render buttons after mount",
    ).toBeGreaterThan(0);

    // KO 모드: 버튼 텍스트가 한국어인지 확인
    const simulatorText = await page
      .locator("#simulator-mount")
      .innerText()
      .catch(() => "");
    console.log(
      `[KO] Simulator text snippet: ${simulatorText.substring(0, 300)}`,
    );

    const enOnlyPatterns = [
      "Run Backtest",
      "Stop Loss",
      "Take Profit",
      "Leverage",
      "Direction",
    ];
    for (const pattern of enOnlyPatterns) {
      if (simulatorText.includes(pattern)) {
        console.warn(
          `[KO] Possible EN hardcode in simulator component: '${pattern}'`,
        );
      }
    }
  });
});

// ─────────────────────────────────────────────────
// 3. 3개 모드 전환 테스트 (EN)
// ─────────────────────────────────────────────────
test.describe("3. Mode Switching (EN)", () => {
  test("ModeSwitcher — Quick/Standard/Expert 탭 전환", async ({ page }) => {
    await page.goto("/simulate/?preset=bb-squeeze-short", {
      waitUntil: "domcontentloaded",
    });
    await waitForSimulator(page);

    // ModeSwitcher 찾기
    const simMount = page.locator("#simulator-mount");
    await ss(page, "05-mode-switcher-initial");

    // Quick Test 모드 버튼 찾기
    const quickBtn = simMount
      .locator("button")
      .filter({ hasText: /quick/i })
      .first();
    const standardBtn = simMount
      .locator("button")
      .filter({ hasText: /standard/i })
      .first();
    const expertBtn = simMount
      .locator("button")
      .filter({ hasText: /expert/i })
      .first();

    const quickCount = await quickBtn.count();
    const standardCount = await standardBtn.count();
    const expertCount = await expertBtn.count();

    console.log(
      `[Mode] Quick: ${quickCount}, Standard: ${standardCount}, Expert: ${expertCount}`,
    );

    if (quickCount > 0) {
      await quickBtn.click();
      await page.waitForTimeout(500);
      await ss(page, "06-mode-quick");
    } else {
      await ss(page, "06-mode-quick-NOT-FOUND");
      console.warn("[Mode] Quick Test button not found");
    }

    if (standardCount > 0) {
      await standardBtn.click();
      await page.waitForTimeout(500);
      await ss(page, "07-mode-standard");
    } else {
      console.warn("[Mode] Standard button not found");
    }

    if (expertCount > 0) {
      await expertBtn.click();
      await page.waitForTimeout(500);
      await ss(page, "08-mode-expert");
    } else {
      console.warn("[Mode] Expert button not found");
    }
  });
});

// ─────────────────────────────────────────────────
// 4. Run Backtest 실행 + 결과 탭 (EN)
// ─────────────────────────────────────────────────
test.describe("4. Run Backtest & Results (EN)", () => {
  test("Run 버튼 클릭 → 결과 표시 + 탭 체크", async ({ page }) => {
    // 타임아웃: 90초 (API 응답 포함)
    test.setTimeout(120000);

    await page.goto("/simulate/?preset=bb-squeeze-short", {
      waitUntil: "domcontentloaded",
    });
    await waitForSimulator(page);
    await ss(page, "09-before-run");

    // Run 버튼 찾기
    const simMount = page.locator("#simulator-mount");
    const runBtn = simMount
      .locator("button")
      .filter({ hasText: /run backtest|run|simulate|실행/i })
      .first();
    const runCount = await runBtn.count();
    console.log(`[Run] Run button count: ${runCount}`);

    if (runCount === 0) {
      await ss(page, "09-run-button-NOT-FOUND");
      console.warn("[Run] Run button not found — cannot test backtest flow");
      return;
    }

    // Run 버튼 텍스트 확인
    const runText = await runBtn.innerText();
    console.log(`[Run] Run button text: '${runText}'`);

    await runBtn.click();
    await ss(page, "10-after-run-click");

    // 실행 중 표시 대기
    await page.waitForTimeout(1000);
    await ss(page, "11-running-state");

    // 결과 대기
    await waitForResults(page, 90000);
    await ss(page, "12-results-appeared");

    const resultsText = await simMount.innerText().catch(() => "");

    // Summary 탭 체크
    const summaryVisible =
      resultsText.includes("Win Rate") ||
      resultsText.includes("승률") ||
      resultsText.includes("Summary") ||
      resultsText.includes("요약");
    console.log(`[Results] Summary visible: ${summaryVisible}`);
    if (!summaryVisible) {
      await ss(page, "12-no-summary");
      console.warn("[Results] Summary metrics not found after run");
    }

    // NaN 체크
    if (resultsText.includes("NaN")) {
      await ss(page, "12-nan-detected");
      console.warn("[Results] NaN value detected in results");
    }

    // 탭 버튼들 찾기
    const tabs = [
      "Summary",
      "Equity Curve",
      "Trade List",
      "Per Coin",
      "Validate",
    ];
    for (const tab of tabs) {
      const tabBtn = simMount
        .locator(`button, [role="tab"]`)
        .filter({ hasText: tab })
        .first();
      const tabCount = await tabBtn.count();
      console.log(`[Tab] '${tab}': found=${tabCount}`);
      if (tabCount > 0) {
        await tabBtn.click();
        await page.waitForTimeout(500);
        await ss(page, `13-tab-${tab.replace(/ /g, "-").toLowerCase()}`);
      }
    }
  });
});

// ─────────────────────────────────────────────────
// 5. KO 시뮬레이터 실행 + 영문 하드코딩 체크
// ─────────────────────────────────────────────────
test.describe("5. KO Simulator Run & i18n", () => {
  test("KO Run → 결과에 영문 하드코딩 없는지 확인", async ({ page }) => {
    test.setTimeout(120000);

    await page.goto("/ko/simulate/?preset=bb-squeeze-short", {
      waitUntil: "domcontentloaded",
    });
    await waitForSimulator(page);
    await ss(page, "14-ko-before-run");

    const simMount = page.locator("#simulator-mount");

    // KO에서 Run 버튼 텍스트 확인
    const allBtns = await simMount.locator("button").allInnerTexts();
    console.log("[KO] All button texts:", allBtns.slice(0, 20));

    const runBtn = simMount
      .locator("button")
      .filter({ hasText: /백테스트 실행|실행|run backtest|simulate/i })
      .first();
    const runCount = await runBtn.count();

    if (runCount > 0) {
      const runText = await runBtn.innerText();
      console.log(`[KO] Run button text: '${runText}'`);

      // Run 버튼이 한국어인지 확인
      if (runText.toLowerCase().includes("run backtest")) {
        console.warn(`[KO i18n] Run button still shows EN text: '${runText}'`);
        await ss(page, "14-ko-run-btn-en-text");
      }

      await runBtn.click();
      await waitForResults(page, 90000);
      await ss(page, "15-ko-results");

      const resultsText = await simMount.innerText().catch(() => "");

      // KO 결과 내 영문 하드코딩 체크
      const enLabels = [
        "Win Rate",
        "Profit Factor",
        "Max Drawdown",
        "Total Trades",
        "Trade List",
        "Per Coin",
        "Equity Curve",
        "Summary",
        "Validate",
        "Strategy:",
        "Grade:",
        "Walk-Forward",
        "Monthly Returns",
        "Yearly Breakdown",
      ];
      const found: string[] = [];
      for (const label of enLabels) {
        if (resultsText.includes(label)) {
          found.push(label);
        }
      }
      if (found.length > 0) {
        await ss(page, "15-ko-en-labels-in-results");
        console.warn(
          `[KO i18n] EN labels found in KO results: ${found.join(", ")}`,
        );
      }
    } else {
      await ss(page, "14-ko-run-NOT-FOUND");
      console.warn("[KO] Run button not found");
    }
  });
});

// ─────────────────────────────────────────────────
// 6. Share/Copy Link + Download CSV
// ─────────────────────────────────────────────────
test.describe("6. Share & Download", () => {
  test("Copy Link 버튼 작동 (EN)", async ({ page }) => {
    test.setTimeout(120000);
    // 결과가 있는 상태 만들기
    await page.goto("/simulate/?preset=bb-squeeze-short", {
      waitUntil: "domcontentloaded",
    });
    await waitForSimulator(page);

    const simMount = page.locator("#simulator-mount");
    const runBtn = simMount
      .locator("button")
      .filter({ hasText: /run backtest|실행/i })
      .first();
    if ((await runBtn.count()) > 0) {
      await runBtn.click();
      await waitForResults(page, 90000);
    }

    await ss(page, "16-before-copy-link");

    // Copy Link 버튼 찾기
    const copyBtn = simMount
      .locator("button")
      .filter({ hasText: /copy link|링크 복사/i })
      .first();
    const copyCount = await copyBtn.count();
    console.log(`[Share] Copy Link button count: ${copyCount}`);

    if (copyCount > 0) {
      // clipboard 권한 부여
      await page
        .context()
        .grantPermissions(["clipboard-read", "clipboard-write"]);
      await copyBtn.click();
      await page.waitForTimeout(500);
      await ss(page, "16-after-copy-link");
      // "Copied!" 피드백 확인
      const copiedText = simMount.locator("text=Copied!, text=복사됨!");
      const copiedCount = await copiedText.count();
      console.log(`[Share] 'Copied!' feedback: ${copiedCount}`);
      if (copiedCount === 0) {
        console.warn(
          "[Share] 'Copied!' feedback not shown after Copy Link click",
        );
      }
    } else {
      console.warn(
        "[Share] Copy Link button not found — results may not have loaded",
      );
    }

    // CSV Download 버튼
    const csvBtn = simMount
      .locator("button, a")
      .filter({ hasText: /csv|download csv|CSV 다운로드/i })
      .first();
    const csvCount = await csvBtn.count();
    console.log(`[Download] CSV button count: ${csvCount}`);
    if (csvCount > 0) {
      await ss(page, "17-csv-button-found");
    } else {
      console.warn("[Download] CSV button not found after results loaded");
    }
  });
});

// ─────────────────────────────────────────────────
// 7. UX 체크 — End Date 기본값, NaN, 빈 값
// ─────────────────────────────────────────────────
test.describe("7. UX & Edge Cases", () => {
  test("End Date 기본값 채워져 있는지 확인 (EN)", async ({ page }) => {
    await page.goto("/simulate/?preset=bb-squeeze-short", {
      waitUntil: "domcontentloaded",
    });
    await waitForSimulator(page);

    const simMount = page.locator("#simulator-mount");
    await ss(page, "18-date-inputs");

    // date input 찾기
    const dateInputs = simMount.locator(
      "input[type='date'], input[placeholder*='date'], input[placeholder*='날짜']",
    );
    const dateCount = await dateInputs.count();
    console.log(`[Date] Date input count: ${dateCount}`);

    for (let i = 0; i < dateCount; i++) {
      const val = await dateInputs.nth(i).inputValue();
      const placeholder = await dateInputs.nth(i).getAttribute("placeholder");
      console.log(
        `[Date] input[${i}] placeholder='${placeholder}' value='${val}'`,
      );
      if (!val || val === "") {
        console.warn(
          `[Date] date input[${i}] has empty value (may be intentional if auto-populated)`,
        );
      }
    }

    // Expert 모드에서 date range 확인
    const expertBtn = simMount
      .locator("button")
      .filter({ hasText: /expert/i })
      .first();
    if ((await expertBtn.count()) > 0) {
      await expertBtn.click();
      await page.waitForTimeout(500);
      const dateInputsExpert = simMount.locator("input[type='date']");
      const expertDateCount = await dateInputsExpert.count();
      console.log(`[Date Expert] Date input count: ${expertDateCount}`);
      for (let i = 0; i < expertDateCount; i++) {
        const val = await dateInputsExpert.nth(i).inputValue();
        console.log(`[Date Expert] input[${i}] value='${val}'`);
        if (!val || val === "") {
          await ss(page, `18-date-empty-expert-input-${i}`);
          console.warn(`[Date] EXPERT mode date input[${i}] is EMPTY`);
        }
      }
    }
  });

  test("First-run tooltip (KO) 영문 혼용 체크", async ({ page }) => {
    // localStorage 비워서 first-run 상태 시뮬레이션
    await page.goto("/ko/simulate/?preset=bb-squeeze-short", {
      waitUntil: "domcontentloaded",
    });
    // localStorage clear 후 reload
    await page.evaluate(() => localStorage.removeItem("has-run-backtest"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForSimulator(page);
    await page.waitForTimeout(2000);
    await ss(page, "19-ko-first-run-tooltip");

    // first-run tooltip 찾기
    const tooltip = page.locator("#first-run-tooltip");
    const tooltipCount = await tooltip.count();
    console.log(`[Tooltip] first-run tooltip count: ${tooltipCount}`);

    if (tooltipCount > 0) {
      const tooltipText = await tooltip.innerText();
      console.log(`[Tooltip] text: '${tooltipText}'`);
      // KO tooltip에 영문 "Click 'Run Backtest'" 혼용 여부
      if (
        tooltipText.includes("Click") &&
        tooltipText.includes("Run Backtest")
      ) {
        console.warn(
          `[Tooltip KO] EN instruction found in KO tooltip: '${tooltipText}'`,
        );
        await ss(page, "19-ko-tooltip-en-text");
      }
    }
  });

  test("Trade on OKX CTA 존재 확인 (EN)", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/simulate/?preset=bb-squeeze-short", {
      waitUntil: "domcontentloaded",
    });
    await waitForSimulator(page);

    const runBtn = page
      .locator("#simulator-mount button")
      .filter({ hasText: /run backtest/i })
      .first();
    if ((await runBtn.count()) > 0) {
      await runBtn.click();
      await waitForResults(page, 90000);
    }

    await ss(page, "20-okx-cta-check");
    const okxCta = page
      .locator("a, button")
      .filter({ hasText: /trade on okx|okx/i });
    const okxCount = await okxCta.count();
    console.log(`[CTA] Trade on OKX count: ${okxCount}`);
    if (okxCount === 0) {
      console.warn("[CTA] 'Trade on OKX' CTA not found after results loaded");
    }
  });
});

// ─────────────────────────────────────────────────
// 8. 반응형 — 모바일 375px
// ─────────────────────────────────────────────────
test.describe("8. Mobile 375px", () => {
  test("KO /ko/simulate/ 모바일 레이아웃", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 667 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto("/ko/simulate/?preset=bb-squeeze-short", {
      waitUntil: "domcontentloaded",
    });
    await waitForSimulator(page);
    await ss(page, "21-mobile-ko-simulate");

    // 가로 스크롤 없음 확인
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    console.log(
      `[Mobile] scrollWidth=${scrollWidth} clientWidth=${clientWidth}`,
    );
    if (scrollWidth > clientWidth + 5) {
      await ss(page, "21-mobile-horizontal-scroll");
      console.warn(
        `[Mobile KO] Horizontal scroll detected: ${scrollWidth} > ${clientWidth}`,
      );
    }

    // 모바일에서 simulator mount 버튼들 44px 이상 확인
    const buttons = page.locator("#simulator-mount button");
    const btnCount = await buttons.count();
    let smallBtns = 0;
    for (let i = 0; i < Math.min(btnCount, 10); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box && (box.height < 44 || box.width < 44)) {
        smallBtns++;
        console.warn(
          `[Mobile] button[${i}] too small: ${box.width}x${box.height}`,
        );
      }
    }
    if (smallBtns > 0) {
      await ss(page, "21-mobile-small-touch-targets");
    }

    await ctx.close();
  });
});

// ─────────────────────────────────────────────────
// 9. i18n 스위치 — /simulate/ → /ko/simulate/ 네비게이션
// ─────────────────────────────────────────────────
test.describe("9. Language Switch", () => {
  test("EN → KO 언어 전환 (네비게이션 링크)", async ({ page }) => {
    await page.goto("/simulate/", { waitUntil: "domcontentloaded" });
    await ss(page, "22-en-before-switch");

    // 언어 전환 링크 찾기 (한국어, KO 등)
    const koLink = page
      .locator("a")
      .filter({ hasText: /^KO$|한국어|Korean/i })
      .first();
    const koLinkCount = await koLink.count();
    console.log(`[LangSwitch] KO link count: ${koLinkCount}`);

    if (koLinkCount > 0) {
      const href = await koLink.getAttribute("href");
      console.log(`[LangSwitch] KO link href: ${href}`);
      await koLink.click();
      await page.waitForLoadState("domcontentloaded");
      const url = page.url();
      console.log(`[LangSwitch] After KO click, URL: ${url}`);
      await ss(page, "22-after-ko-switch");

      if (!url.includes("/ko/")) {
        console.warn(
          `[LangSwitch] Expected /ko/ in URL after language switch, got: ${url}`,
        );
      }
    } else {
      // 언어 스위치 버튼을 nav에서 찾기
      const navKo = page
        .locator("nav a, header a")
        .filter({ hasText: /ko|한국|korean/i })
        .first();
      const navKoCount = await navKo.count();
      console.log(`[LangSwitch] Nav KO link count: ${navKoCount}`);
      await ss(page, "22-lang-switch-not-found");
    }
  });

  test("KO → EN 언어 전환", async ({ page }) => {
    await page.goto("/ko/simulate/", { waitUntil: "domcontentloaded" });
    await ss(page, "23-ko-before-switch");

    const enLink = page
      .locator("a")
      .filter({ hasText: /^EN$|영어|English/i })
      .first();
    const enCount = await enLink.count();
    console.log(`[LangSwitch] EN link count: ${enCount}`);

    if (enCount > 0) {
      await enLink.click();
      await page.waitForLoadState("domcontentloaded");
      const url = page.url();
      console.log(`[LangSwitch] After EN click, URL: ${url}`);
      await ss(page, "23-after-en-switch");
      if (url.includes("/ko/")) {
        console.warn(`[LangSwitch] Still on /ko/ URL after EN switch: ${url}`);
      }
    } else {
      await ss(page, "23-en-link-not-found");
    }
  });
});

// ─────────────────────────────────────────────────
// 10. Validate 탭 (OOS/Monte Carlo)
// ─────────────────────────────────────────────────
test.describe("10. Validate Tab", () => {
  test("Validate 탭 — OOS/Monte Carlo 설정 표시 (EN)", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/simulate/?preset=bb-squeeze-short", {
      waitUntil: "domcontentloaded",
    });
    await waitForSimulator(page);

    const simMount = page.locator("#simulator-mount");
    const runBtn = simMount
      .locator("button")
      .filter({ hasText: /run backtest/i })
      .first();
    if ((await runBtn.count()) > 0) {
      await runBtn.click();
      await waitForResults(page, 90000);
    }

    const validateTab = simMount
      .locator("button, [role='tab']")
      .filter({ hasText: /validate|검증/i })
      .first();
    const validateCount = await validateTab.count();
    console.log(`[Validate] tab count: ${validateCount}`);

    if (validateCount > 0) {
      await validateTab.click();
      await page.waitForTimeout(1000);
      await ss(page, "24-validate-tab");

      const validateText = await simMount.innerText().catch(() => "");
      const hasOos =
        validateText.toLowerCase().includes("oos") ||
        validateText.toLowerCase().includes("out-of-sample");
      const hasMC = validateText.toLowerCase().includes("monte carlo");
      console.log(`[Validate] Has OOS: ${hasOos}, Has Monte Carlo: ${hasMC}`);
    } else {
      await ss(page, "24-validate-tab-not-found");
      console.warn("[Validate] Validate tab not found");
    }
  });
});
