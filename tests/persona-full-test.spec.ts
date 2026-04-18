import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const SS = "/tmp/persona-screenshots";
fs.mkdirSync(SS, { recursive: true });

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SS}/${name}.png`, fullPage: false });
}

async function waitForApi(page: Page) {
  await page.waitForFunction(
    () => !document.querySelector(".spinner"),
    { timeout: 15000 }
  ).catch(() => {});
  await page.waitForTimeout(500);
}

// ────────────────────────────────────────────────────────────
// CASEY: 완전 초보자
// ────────────────────────────────────────────────────────────
test("CASEY-01: 첫 방문 — 무엇이 보이는가", async ({ page }) => {
  await page.goto("http://localhost:4321/simulate");
  await page.waitForLoadState("networkidle");
  await shot(page, "casey-01-first-view");

  // Quick Start 배너 존재?
  const banner = page.locator('[data-testid="quick-start-banner"], .quick-start, [class*="quickStart"]');
  const bannerText = await page.getByText(/Run Backtest|Click|preset/i).first().isVisible().catch(() => false);
  console.log("QuickStart banner visible:", bannerText);

  // 탭 모드 확인
  const standardTab = page.getByRole("button", { name: /Standard|기본/i });
  const expertTab = page.getByRole("button", { name: /Expert|전문/i });
  console.log("Standard tab:", await standardTab.isVisible().catch(() => false));
  console.log("Expert tab:", await expertTab.isVisible().catch(() => false));
});

test("CASEY-02: Standard 모드 — 슬라이더 + 프리셋 선택 + 실행", async ({ page }) => {
  await page.goto("http://localhost:4321/simulate");
  await page.waitForLoadState("networkidle");

  // Standard 탭 클릭 (또는 이미 기본)
  const stdBtn = page.getByRole("button", { name: /Standard|기본/i }).first();
  if (await stdBtn.isVisible()) await stdBtn.click();
  await page.waitForTimeout(300);
  await shot(page, "casey-02a-standard-mode");

  // 프리셋 버튼 찾기
  const presets = page.locator("button").filter({ hasText: /BB Squeeze|Squeeze|RSI|EMA/i });
  const presetCount = await presets.count();
  console.log("Preset buttons visible:", presetCount);
  if (presetCount > 0) {
    await presets.first().click();
    await page.waitForTimeout(500);
    await shot(page, "casey-02b-preset-selected");
  }

  // SL 슬라이더
  const slSlider = page.locator('input[type="range"]').first();
  if (await slSlider.isVisible()) {
    await slSlider.fill("15");
    await page.waitForTimeout(200);
  }

  // Run 버튼
  const runBtn = page.getByTestId("run-simulate").or(page.getByRole("button", { name: /Run Backtest|백테스트 실행|Simulate/i })).first();
  console.log("Run button visible:", await runBtn.isVisible().catch(() => false));
  await shot(page, "casey-02c-before-run");

  if (await runBtn.isVisible()) {
    await runBtn.click();
    await page.waitForTimeout(1000);
    await shot(page, "casey-02d-running");
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('[data-testid="run-simulate"]');
        return btn && !btn.textContent?.includes("Running") && !btn.textContent?.includes("실행 중");
      },
      { timeout: 30000 }
    ).catch(() => {});
    await page.waitForTimeout(1000);
    await shot(page, "casey-02e-results");
    console.log("Results rendered after run");
  }
});

test("CASEY-03: 결과 화면 — 초보자가 이해할 수 있나", async ({ page }) => {
  await page.goto("http://localhost:4321/simulate");
  await page.waitForLoadState("networkidle");

  // 빠르게 실행
  const runBtn = page.getByTestId("run-simulate").or(page.getByRole("button", { name: /Run Backtest|백테스트 실행/i })).first();
  if (await runBtn.isVisible()) {
    await runBtn.click();
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="run-simulate"]')?.textContent?.includes("Running"),
      { timeout: 30000 }
    ).catch(() => {});
    await page.waitForTimeout(1000);
  }

  // 결과 지표 텍스트 확인
  const metricTexts = ["Win Rate", "Profit Factor", "Drawdown", "Return", "승률", "수익"];
  for (const t of metricTexts) {
    const el = page.getByText(new RegExp(t, "i")).first();
    const visible = await el.isVisible().catch(() => false);
    console.log(`Metric "${t}" visible:`, visible);
  }
  await shot(page, "casey-03-results-understanding");

  // 등급(Grade) 표시 확인
  const grades = ["STRONG", "GOOD", "FAIR", "WEAK", "강력", "양호", "보통", "위험"];
  for (const g of grades) {
    const el = page.getByText(g).first();
    if (await el.isVisible().catch(() => false)) {
      console.log("Grade shown:", g);
      break;
    }
  }
});

test("CASEY-04: KO 모드 전환 — 미번역 문자열 체크", async ({ page }) => {
  await page.goto("http://localhost:4321/ko/simulate");
  await page.waitForLoadState("networkidle");
  await shot(page, "casey-04a-ko-mode");

  // 영어 하드코딩 확인
  const bodyText = await page.locator("body").innerText();
  const hardcodedEN = [
    "★ Recommended",
    "Custom",
    "Hide",
    "All presets",
    "Prev",
    "Curr",
    "Timeframe",
    "Run Backtest",
    "Stop Loss",
    "Take Profit",
  ];
  for (const str of hardcodedEN) {
    const found = bodyText.includes(str);
    if (found) console.log(`🔴 EN hardcoded in KO mode: "${str}"`);
  }

  // KO 번역 확인
  const koExpected = ["백테스트", "손절", "익절", "레버리지", "전략"];
  for (const str of koExpected) {
    const found = bodyText.includes(str);
    console.log(`KO text "${str}":`, found ? "✅" : "❌ MISSING");
  }
  await shot(page, "casey-04b-ko-mode-scrolled");
});

// ────────────────────────────────────────────────────────────
// TIM: 중급자 — 파라미터 범위, 비교, History
// ────────────────────────────────────────────────────────────
test("TIM-01: Standard 모드 파라미터 범위 한계 테스트", async ({ page }) => {
  await page.goto("http://localhost:4321/simulate");
  await page.waitForLoadState("networkidle");

  const stdBtn = page.getByRole("button", { name: /Standard|기본/i }).first();
  if (await stdBtn.isVisible()) await stdBtn.click();
  await page.waitForTimeout(300);

  // SL 슬라이더 최대값 확인
  const slSlider = page.locator('input[type="range"]').first();
  const slMax = await slSlider.getAttribute("max");
  const slMin = await slSlider.getAttribute("min");
  console.log(`SL slider: min=${slMin}, max=${slMax}`);

  // TP 슬라이더
  const tpSlider = page.locator('input[type="range"]').nth(1);
  const tpMax = await tpSlider.getAttribute("max");
  const tpMin = await tpSlider.getAttribute("min");
  console.log(`TP slider: min=${tpMin}, max=${tpMax}`);

  await shot(page, "tim-01-param-ranges");

  // Direction 버튼들
  const shortBtn = page.getByTestId("std-dir-short");
  const longBtn = page.getByTestId("std-dir-long");
  const bothBtn = page.getByTestId("std-dir-both");
  console.log("SHORT btn:", await shortBtn.isVisible().catch(() => false));
  console.log("LONG btn:", await longBtn.isVisible().catch(() => false));
  console.log("BOTH btn:", await bothBtn.isVisible().catch(() => false));

  // Leverage 1x→5x
  const lev5 = page.getByRole("button", { name: "5x" });
  if (await lev5.isVisible()) {
    await lev5.click();
    await page.waitForTimeout(200);
    await shot(page, "tim-01b-leverage-5x");
  }
});

test("TIM-02: 코인 필터 + 기간 슬라이더", async ({ page }) => {
  await page.goto("http://localhost:4321/simulate");
  await page.waitForLoadState("networkidle");

  // Top 50 코인 선택
  const top50 = page.getByRole("button", { name: /Top 50/i });
  if (await top50.isVisible()) {
    await top50.click();
    await page.waitForTimeout(200);
    console.log("Top 50 selected");
  }

  // 기간 슬라이더 (period)
  const periodSlider = page.locator('input[type="range"]').nth(2);
  const pMax = await periodSlider.getAttribute("max").catch(() => null);
  const pMin = await periodSlider.getAttribute("min").catch(() => null);
  console.log(`Period slider: min=${pMin}, max=${pMax}`);

  await shot(page, "tim-02-coin-period");
});

test("TIM-03: History 기능 — 2번 실행 후 비교", async ({ page }) => {
  await page.goto("http://localhost:4321/simulate");
  await page.waitForLoadState("networkidle");

  const runBtn = page.getByTestId("run-simulate").or(page.getByRole("button", { name: /Run Backtest|백테스트 실행/i })).first();

  // 1차 실행
  if (await runBtn.isVisible()) {
    await runBtn.click();
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="run-simulate"]')?.textContent?.includes("Running"),
      { timeout: 30000 }
    ).catch(() => {});
    await page.waitForTimeout(1000);
    await shot(page, "tim-03a-first-run");
  }

  // SL 변경 후 2차 실행
  const slSlider = page.locator('input[type="range"]').first();
  if (await slSlider.isVisible()) {
    await slSlider.fill("15");
    await page.waitForTimeout(200);
  }

  if (await runBtn.isVisible()) {
    await runBtn.click();
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="run-simulate"]')?.textContent?.includes("Running"),
      { timeout: 30000 }
    ).catch(() => {});
    await page.waitForTimeout(1000);
    await shot(page, "tim-03b-second-run-history");
  }

  // History 항목 확인
  const historyItems = page.locator('[class*="history"], [data-testid*="history"]');
  console.log("History items:", await historyItems.count());
});

// ────────────────────────────────────────────────────────────
// QUINN: 퀀트 — Expert 모드, 조건 빌더, Validate 탭
// ────────────────────────────────────────────────────────────
test("QUINN-01: Expert 모드 진입 + 조건 추가", async ({ page }) => {
  await page.goto("http://localhost:4321/simulate");
  await page.waitForLoadState("networkidle");

  // Expert 탭 클릭
  const expertBtn = page.getByRole("button", { name: /Expert|전문|Advanced/i }).first();
  if (await expertBtn.isVisible()) {
    await expertBtn.click();
    await page.waitForTimeout(500);
    await shot(page, "quinn-01a-expert-mode");
  }

  // 기존 조건들 확인
  const conditionRows = page.locator('[class*="ConditionRow"], [data-testid*="condition"]');
  console.log("Default condition rows:", await conditionRows.count());

  // "조건 추가" 버튼
  const addBtn = page.getByRole("button", { name: /Add Condition|조건 추가|Add Entry|Add/i }).first();
  console.log("Add condition button:", await addBtn.isVisible().catch(() => false));
  if (await addBtn.isVisible()) {
    await addBtn.click();
    await page.waitForTimeout(300);
    await shot(page, "quinn-01b-condition-added");
  }

  // 지표 선택 드롭다운 (field select)
  const fieldSelect = page.locator('select[aria-label="Indicator field"]').first();
  if (await fieldSelect.isVisible()) {
    const options = await fieldSelect.evaluate((el) =>
      Array.from((el as HTMLSelectElement).options).map((o) => o.text).slice(0, 5)
    );
    console.log("Field options (first 5):", options);
  }
  await shot(page, "quinn-01c-full-expert");
});

test("QUINN-02: Shift 컬럼 — look-ahead bias 경고", async ({ page }) => {
  await page.goto("http://localhost:4321/simulate");
  await page.waitForLoadState("networkidle");

  const expertBtn = page.getByRole("button", { name: /Expert|전문/i }).first();
  if (await expertBtn.isVisible()) await expertBtn.click();
  await page.waitForTimeout(500);

  // Shift 선택자 (Prev/Curr)
  const shiftSelect = page.locator('select[aria-label*="Candle"]').first();
  if (await shiftSelect.isVisible()) {
    // Curr (shift=0) 선택 → 경고 표시?
    await shiftSelect.selectOption("0");
    await page.waitForTimeout(300);
    await shot(page, "quinn-02a-shift-curr-warning");

    const warning = page.locator('[class*="yellow"], [style*="yellow"]').first();
    console.log("Look-ahead warning shown:", await warning.isVisible().catch(() => false));
  }
});

test("QUINN-03: Validate 탭 (OOS) 접근", async ({ page }) => {
  await page.goto("http://localhost:4321/simulate");
  await page.waitForLoadState("networkidle");

  // Expert 모드로
  const expertBtn = page.getByRole("button", { name: /Expert|전문/i }).first();
  if (await expertBtn.isVisible()) await expertBtn.click();
  await page.waitForTimeout(300);

  // 한번 실행
  const runBtn = page.getByTestId("run-simulate").or(page.getByRole("button", { name: /Run Backtest|백테스트 실행/i })).first();
  if (await runBtn.isVisible()) {
    await runBtn.click();
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="run-simulate"]')?.textContent?.includes("Running"),
      { timeout: 30000 }
    ).catch(() => {});
    await page.waitForTimeout(1000);
  }

  // Validate 탭
  const validateTab = page.getByRole("tab", { name: /Validate|OOS|검증/i });
  const validateTabAlt = page.getByRole("button", { name: /Validate|OOS|검증/i });
  const vtab = await validateTab.isVisible().catch(() => false) ? validateTab : validateTabAlt;
  console.log("Validate tab visible:", await vtab.isVisible().catch(() => false));
  if (await vtab.isVisible()) {
    await vtab.click();
    await page.waitForTimeout(500);
    await shot(page, "quinn-03-validate-tab");
  } else {
    await shot(page, "quinn-03-no-validate-tab");
    console.log("🔴 Validate tab NOT found after expert mode run");
  }
});

test("QUINN-04: 데이터 출처 정보 확인", async ({ page }) => {
  await page.goto("http://localhost:4321/simulate");
  await page.waitForLoadState("networkidle");

  // 실행 후 결과
  const runBtn = page.getByTestId("run-simulate").or(page.getByRole("button", { name: /Run Backtest|백테스트 실행/i })).first();
  if (await runBtn.isVisible()) {
    await runBtn.click();
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="run-simulate"]')?.textContent?.includes("Running"),
      { timeout: 30000 }
    ).catch(() => {});
    await page.waitForTimeout(1000);
  }

  const bodyText = await page.locator("body").innerText();
  const dataSourceKeywords = ["OKX", "Binance", "1H", "candle", "데이터 출처", "data source", "exchange"];
  for (const kw of dataSourceKeywords) {
    if (bodyText.toLowerCase().includes(kw.toLowerCase())) {
      console.log(`✅ Data source info found: "${kw}"`);
    } else {
      console.log(`❌ No mention of: "${kw}"`);
    }
  }
  await shot(page, "quinn-04-data-source");
});

// ────────────────────────────────────────────────────────────
// SAM: 전략가 — 복잡한 조건, Export, Share, OR 로직
// ────────────────────────────────────────────────────────────
test("SAM-01: 복잡한 조건 빌딩 + field2 비교", async ({ page }) => {
  await page.goto("http://localhost:4321/simulate");
  await page.waitForLoadState("networkidle");

  const expertBtn = page.getByRole("button", { name: /Expert|전문/i }).first();
  if (await expertBtn.isVisible()) await expertBtn.click();
  await page.waitForTimeout(500);

  // field2 (indicator vs indicator) 선택자 확인
  const field2Select = page.locator('select[aria-label="Comparison field"]').first();
  console.log("field2 selector visible:", await field2Select.isVisible().catch(() => false));

  // Avoid Hours 버튼 그리드
  const avoidHoursGrid = page.locator('[class*="avoidHour"], button[class*="hour"]').first();
  const avoidBtns = page.getByRole("button", { name: /^[0-9]{1,2}$/ });
  console.log("Avoid hour buttons:", await avoidBtns.count());

  await shot(page, "sam-01-expert-builder");
  await page.waitForTimeout(300);

  // Compounding 토글
  const compoundToggle = page.getByRole("button", { name: /Compound|컴파운드|복리/i }).first();
  const compoundCheck = page.locator('input[type="checkbox"]').filter({ hasText: /compound/i });
  console.log("Compound toggle:", await compoundToggle.isVisible().catch(() => false));
  await shot(page, "sam-01b-compound");
});

test("SAM-02: 실행 후 Export (CSV/Excel) + Share", async ({ page }) => {
  await page.goto("http://localhost:4321/simulate");
  await page.waitForLoadState("networkidle");

  const runBtn = page.getByTestId("run-simulate").or(page.getByRole("button", { name: /Run Backtest|백테스트 실행/i })).first();
  if (await runBtn.isVisible()) {
    await runBtn.click();
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="run-simulate"]')?.textContent?.includes("Running"),
      { timeout: 30000 }
    ).catch(() => {});
    await page.waitForTimeout(1000);
  }

  await shot(page, "sam-02a-results");

  // Export 버튼
  const csvBtn = page.getByRole("button", { name: /CSV|Export|내보내기/i }).first();
  const excelBtn = page.getByRole("button", { name: /Excel|XLSX/i }).first();
  console.log("CSV export button:", await csvBtn.isVisible().catch(() => false));
  console.log("Excel export button:", await excelBtn.isVisible().catch(() => false));

  // Share 버튼
  const shareBtn = page.getByRole("button", { name: /Share|공유/i }).first();
  console.log("Share button:", await shareBtn.isVisible().catch(() => false));
  if (await shareBtn.isVisible()) {
    await shareBtn.click();
    await page.waitForTimeout(500);
    await shot(page, "sam-02b-share-modal");
  }

  await shot(page, "sam-02c-all-results-buttons");
});

test("SAM-03: OR 조건 — AND 제약 확인", async ({ page }) => {
  await page.goto("http://localhost:4321/simulate");
  await page.waitForLoadState("networkidle");

  const expertBtn = page.getByRole("button", { name: /Expert|전문/i }).first();
  if (await expertBtn.isVisible()) await expertBtn.click();
  await page.waitForTimeout(500);

  // AND/OR 토글 있는가?
  const orBtn = page.getByRole("button", { name: /\bOR\b/i }).first();
  const andBtn = page.getByRole("button", { name: /\bAND\b/i }).first();
  console.log("OR button visible:", await orBtn.isVisible().catch(() => false));
  console.log("AND button visible:", await andBtn.isVisible().catch(() => false));

  // "AND conditions only" 같은 안내 텍스트
  const bodyText = await page.locator("body").innerText();
  const hasAndNotice = /all conditions|AND only|모든 조건/.test(bodyText);
  console.log("AND-only notice visible:", hasAndNotice);

  await shot(page, "sam-03-and-or-logic");
});

// ────────────────────────────────────────────────────────────
// 모바일 뷰포트 테스트
// ────────────────────────────────────────────────────────────
test("MOBILE-01: 375px — Expert 모드 조건 rows 가독성", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:4321/simulate");
  await page.waitForLoadState("networkidle");

  const expertBtn = page.getByRole("button", { name: /Expert|전문/i }).first();
  if (await expertBtn.isVisible()) await expertBtn.click();
  await page.waitForTimeout(500);

  await shot(page, "mobile-01a-expert-375");
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(300);
  await shot(page, "mobile-01b-expert-scrolled");

  // 조건 row가 몇 줄 차지하는가
  const condRows = page.locator('[class*="flex-wrap"]');
  console.log("flex-wrap condition rows:", await condRows.count());
  await ctx.close();
});

test("MOBILE-02: 375px — Standard 모드 Run 버튼 가시성", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:4321/simulate");
  await page.waitForLoadState("networkidle");
  await shot(page, "mobile-02-standard-375");

  const runBtn = page.getByTestId("run-simulate").or(page.getByRole("button", { name: /Run Backtest|백테스트 실행/i })).first();
  console.log("Run button visible (375px):", await runBtn.isVisible().catch(() => false));
  await ctx.close();
});

// ────────────────────────────────────────────────────────────
// EDGE CASES
// ────────────────────────────────────────────────────────────
test("EDGE-01: 조건 0개로 Expert 실행", async ({ page }) => {
  await page.goto("http://localhost:4321/simulate");
  await page.waitForLoadState("networkidle");

  const expertBtn = page.getByRole("button", { name: /Expert|전문/i }).first();
  if (await expertBtn.isVisible()) await expertBtn.click();
  await page.waitForTimeout(500);

  // 모든 조건 삭제
  const removeBtns = page.getByRole("button", { name: /x|Remove|삭제/i });
  const count = await removeBtns.count();
  for (let i = 0; i < count; i++) {
    const btn = removeBtns.first();
    if (await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(100);
    }
  }
  await shot(page, "edge-01a-no-conditions");

  // 빈 조건으로 실행 시도
  const runBtn = page.getByTestId("run-simulate").or(page.getByRole("button", { name: /Run Backtest|백테스트 실행/i })).first();
  if (await runBtn.isVisible()) {
    const isDisabled = await runBtn.isDisabled();
    console.log("Run button disabled with 0 conditions:", isDisabled);
    if (!isDisabled) {
      await runBtn.click();
      await page.waitForTimeout(2000);
      await shot(page, "edge-01b-run-no-conditions-result");
    }
  }
});

test("EDGE-02: URL 파라미터로 프리셋 로드", async ({ page }) => {
  await page.goto("http://localhost:4321/simulate?preset=bb-squeeze-short");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await shot(page, "edge-02-url-preset");

  const bodyText = await page.locator("body").innerText();
  console.log("URL preset loaded:", bodyText.includes("BB Squeeze") || bodyText.includes("bb-squeeze"));
});

