/**
 * sim-ux-audit.mjs — 시뮬레이터 실제 화면 UX/버그 감사 도구
 *
 * 사용법:
 *   node scripts/sim-ux-audit.mjs [url]
 *   node scripts/sim-ux-audit.mjs https://pruviq.com
 *   node scripts/sim-ux-audit.mjs http://localhost:4321
 *
 * 결과: /tmp/sim-audit/*.png + /tmp/sim-audit/report.md
 */

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";

const BASE = process.argv[2] || "https://pruviq.com";
const OUT = "/tmp/sim-audit";
mkdirSync(OUT, { recursive: true });

const issues = [];
let stepNum = 0;

// ─── 헬퍼 ───────────────────────────────────────────────────────────────────

async function shot(page, name, note = "") {
  stepNum++;
  const fname = `${String(stepNum).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: `${OUT}/${fname}`, fullPage: false });
  console.log(`📸 ${fname}${note ? " — " + note : ""}`);
  return fname;
}

function addIssue(severity, step, desc, detail = "") {
  issues.push({ severity, step, desc, detail });
  const icon = severity === "P0" ? "🔴" : severity === "P1" ? "🟡" : "🟢";
  console.log(`  ${icon} [${severity}] ${desc}`);
}

async function waitForApiReady(page, timeout = 20000) {
  try {
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('[data-testid="run-simulate"]');
        return btn && !btn.disabled;
      },
      { timeout }
    );
    return true;
  } catch {
    return false;
  }
}

// ─── 테스트 스텝들 ────────────────────────────────────────────────────────────

async function testStandardMode(browser) {
  console.log("\n── Standard 모드 ──────────────────────────────────────────");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // 콘솔 에러 수집
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto(`${BASE}/simulate`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);
  await shot(page, "standard-init", "초기 로딩");

  // Standard 탭이 기본인지 확인
  const standardActive = await page.locator('button:has-text("Standard"), button:has-text("Your Parameters")').first().isVisible();
  if (!standardActive) addIssue("P1", "standard-init", "Standard 탭이 기본 선택 아님");

  // API 준비 대기
  const apiReady = await waitForApiReady(page, 15000);
  if (!apiReady) {
    addIssue("P0", "standard-init", "API 준비 안 됨 / Run 버튼 비활성화 15초 이상");
    await shot(page, "standard-api-fail", "API 실패");
    await ctx.close();
    return;
  }

  // 기본 기간 확인 (1년인지)
  const startDateVal = await page.evaluate(() => {
    const el = document.querySelector('input[type="date"]');
    return el ? el.value : null;
  });
  if (startDateVal) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const diff = Math.abs(new Date(startDateVal) - oneYearAgo) / (1000 * 60 * 60 * 24);
    if (diff > 7) addIssue("P1", "standard-init", `기본 기간이 1년 아님: ${startDateVal}`);
    else console.log(`  ✅ 기본 기간 1년 확인: ${startDateVal}`);
  }

  // 수수료 슬라이더 확인
  const feeSlider = page.locator('input[type="range"][min="0.01"]').first();
  if (await feeSlider.isVisible()) {
    console.log("  ✅ 수수료 슬라이더 확인");
  } else {
    addIssue("P1", "standard-init", "수수료 슬라이더 안 보임");
  }

  // 생존자 편향 disclaimer 확인
  const disclaimer = page.locator("text=Delisted, text=생존자, text=survivor").first();
  if (await disclaimer.isVisible().catch(() => false)) {
    console.log("  ✅ 생존자 편향 disclaimer 확인");
  } else {
    addIssue("P1", "standard-init", "생존자 편향 disclaimer 안 보임");
  }

  await shot(page, "standard-panel", "Standard 패널 전체");

  // 백테스트 실행
  console.log("  🔄 백테스트 실행 중...");
  await page.locator('[data-testid="run-simulate"]').first().click();
  await page.waitForTimeout(15000);
  await shot(page, "standard-result-summary", "결과 Summary 탭");

  // 결과 검증
  const resultVisible = await page.locator("text=Win Rate, text=승률").first().isVisible().catch(() => false);
  if (!resultVisible) {
    addIssue("P0", "standard-result", "결과 Summary가 안 나타남 (15초 후)");
  } else {
    // WR, PF, MDD 수치 합리성 검증
    const metrics = await page.evaluate(() => {
      const texts = Array.from(document.querySelectorAll("[class*='font-mono']"))
        .map(el => el.textContent?.trim())
        .filter(t => t && t.length > 0);
      return texts.slice(0, 30);
    });
    console.log("  📊 수치 샘플:", metrics.filter(m => /[\d.%]+/.test(m)).slice(0, 10).join(" | "));
  }

  // Trades 탭
  const tradesTab = page.locator('button:has-text("Trades")').first();
  if (await tradesTab.isVisible()) {
    await tradesTab.click();
    await page.waitForTimeout(600);
    await shot(page, "standard-result-trades", "Trades 탭");
    const tradeRows = await page.locator("table tbody tr, [class*='trade-row']").count();
    console.log(`  📋 Trade 행 수: ${tradeRows}`);
    if (tradeRows === 0) addIssue("P1", "trades-tab", "Trades 탭에 행이 0개");
  } else {
    addIssue("P1", "trades-tab", "Trades 탭 버튼 안 보임");
  }

  // Chart 탭
  const chartTab = page.locator('button:has-text("Chart")').first();
  if (await chartTab.isVisible()) {
    await chartTab.click();
    await page.waitForTimeout(1500);
    await shot(page, "standard-result-chart", "Chart 탭 (equity curve)");
    const canvas = await page.locator("canvas, svg[class*='chart']").first().isVisible().catch(() => false);
    if (!canvas) addIssue("P1", "chart-tab", "Chart 탭에 차트 요소(canvas/svg) 없음");
  }

  if (consoleErrors.length > 0) {
    addIssue("P1", "standard-all", `JS 콘솔 에러 ${consoleErrors.length}개`, consoleErrors.slice(0, 3).join("\n"));
  }

  await ctx.close();
}

async function testExpertMode(browser) {
  console.log("\n── Expert 모드 ─────────────────────────────────────────────");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto(`${BASE}/simulate`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Expert/Builder 탭 클릭
  const expertBtn = page.locator('button:has-text("Expert"), button:has-text("Builder"), button:has-text("Custom Build")').first();
  if (!await expertBtn.isVisible()) {
    addIssue("P0", "expert-tab", "Expert/Builder 탭 버튼 없음");
    await ctx.close();
    return;
  }
  await expertBtn.click();
  await page.waitForTimeout(1000);
  await shot(page, "expert-init", "Expert 모드 진입");

  // 지표 선택 영역 확인
  const indicatorToggles = await page.locator('input[type="checkbox"], button:has-text("BB"), button:has-text("EMA")').count();
  console.log(`  🔧 지표 토글 수: ${indicatorToggles}`);

  // Entry Conditions 영역 확인
  const conditionRows = await page.locator('[data-testid*="condition"], .condition-row, [class*="condition"]').count();
  console.log(`  📝 조건 행 수: ${conditionRows}`);

  // 조건 필드 드롭다운 옵션 수 체크 (P0 버그 검증)
  const firstFieldSelect = page.locator('select[aria-label="Indicator field"]').first();
  if (await firstFieldSelect.isVisible()) {
    const optionCount = await firstFieldSelect.locator("option").count();
    console.log(`  📌 조건 드롭다운 옵션 수: ${optionCount}`);
    if (optionCount === 0) {
      addIssue("P0", "expert-conditions", "조건 필드 드롭다운 옵션 0개 (빈 드롭다운 버그)");
    } else {
      console.log("  ✅ 조건 드롭다운 옵션 확인");
    }
  } else {
    addIssue("P1", "expert-conditions", "조건 필드 select 요소 안 보임");
  }

  // "+ Add Condition" 클릭
  const addBtn = page.locator('button:has-text("Add Condition"), button:has-text("조건 추가")').first();
  if (await addBtn.isVisible()) {
    await addBtn.click();
    await page.waitForTimeout(500);
    await shot(page, "expert-add-condition", "조건 추가 후");

    // 새로 추가된 조건의 드롭다운 옵션 수
    const allSelects = page.locator('select[aria-label="Indicator field"]');
    const lastSelect = allSelects.last();
    const newOptionCount = await lastSelect.locator("option").count();
    console.log(`  📌 새 조건 드롭다운 옵션 수: ${newOptionCount}`);
    if (newOptionCount === 0) {
      addIssue("P0", "expert-add-condition", "새로 추가된 조건 드롭다운도 빈 값");
    }

    // 새 조건의 초기 op 확인 (boolean 필드인데 >= 이면 버그)
    const firstSelectValue = await lastSelect.evaluate(el => el.value).catch(() => null);
    const opSelect = page.locator('select[aria-label="Comparison operator"]').last();
    const opValue = await opSelect.evaluate(el => el.value).catch(() => null);
    console.log(`  📌 새 조건 초기 field=${firstSelectValue}, op=${opValue}`);
    const boolFields = new Set(["is_squeeze", "bearish", "bullish", "doji", "uptrend", "downtrend", "rsi_oversold", "rsi_overbought", "stoch_oversold", "stoch_overbought", "strong_trend", "hv_squeeze", "macd_crossover", "breakout_up", "breakout_down"]);
    if (boolFields.has(firstSelectValue) && opValue !== "==") {
      addIssue("P1", "expert-add-condition", `Boolean 필드(${firstSelectValue})인데 op=${opValue}로 초기화`);
    }
  } else {
    addIssue("P1", "expert-add-condition", "+ Add Condition 버튼 없음");
  }

  // 지표 체크 해제 후 조건 변화 확인
  const firstCheckbox = page.locator('input[type="checkbox"]').first();
  if (await firstCheckbox.isVisible()) {
    const prevOptionCount = await page.locator('select[aria-label="Indicator field"]').first().locator("option").count().catch(() => 0);
    await firstCheckbox.click();
    await page.waitForTimeout(300);
    const afterOptionCount = await page.locator('select[aria-label="Indicator field"]').first().locator("option").count().catch(() => 0);
    console.log(`  🔄 지표 체크 해제: 옵션 ${prevOptionCount} → ${afterOptionCount}`);
    if (afterOptionCount === 0 && prevOptionCount > 0) {
      addIssue("P1", "expert-indicator-toggle", "지표 체크 해제 시 드롭다운 즉시 빈 값");
    }
    await firstCheckbox.click(); // 다시 체크
    await page.waitForTimeout(300);
  }

  await shot(page, "expert-full", "Expert 전체 (스크롤 후)");

  if (consoleErrors.length > 0) {
    addIssue("P1", "expert-all", `JS 콘솔 에러 ${consoleErrors.length}개`, consoleErrors.slice(0, 3).join("\n"));
  }

  await ctx.close();
}

async function testMobileView(browser) {
  console.log("\n── 모바일 뷰 ──────────────────────────────────────────────");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/simulate`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);
  await shot(page, "mobile-init", "모바일 초기");

  // 모바일 탭 전환 (Config / Results)
  const configTab = page.locator('button:has-text("Config"), button:has-text("설정")').first();
  const resultsTab = page.locator('button:has-text("Results"), button:has-text("결과")').first();

  if (await configTab.isVisible()) {
    await configTab.click();
    await page.waitForTimeout(300);
    await shot(page, "mobile-config-tab", "모바일 Config 탭");
  } else {
    addIssue("P1", "mobile-tabs", "모바일 Config 탭 없음");
  }

  // 실행 버튼 모바일에서 확인
  const runBtn = page.locator('[data-testid="run-simulate"]').first();
  if (await runBtn.isVisible()) {
    console.log("  ✅ 모바일 실행 버튼 확인");
    // 터치 타겟 크기 확인
    const box = await runBtn.boundingBox();
    if (box && box.height < 44) {
      addIssue("P1", "mobile-run-btn", `실행 버튼 터치 영역 너무 작음: ${box.height}px (최소 44px)`);
    }
  } else {
    addIssue("P0", "mobile-run-btn", "모바일에서 실행 버튼 안 보임");
  }

  await shot(page, "mobile-scroll", "모바일 스크롤");

  await ctx.close();
}

async function testKoVersion(browser) {
  console.log("\n── 한국어 버전 ─────────────────────────────────────────────");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/ko/simulate`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);
  await shot(page, "ko-simulate", "한국어 시뮬레이터");

  // 영어 텍스트 잔류 확인
  const pageText = await page.evaluate(() => document.body.innerText);
  const suspiciousEN = ["Run Backtest", "Test Period", "Stop Loss", "Take Profit"];
  for (const word of suspiciousEN) {
    if (pageText.includes(word)) {
      addIssue("P2", "ko-i18n", `한국어 페이지에 영문 하드코딩: "${word}"`);
    }
  }

  await ctx.close();
}

// ─── 리포트 생성 ─────────────────────────────────────────────────────────────

function generateReport() {
  const p0 = issues.filter(i => i.severity === "P0");
  const p1 = issues.filter(i => i.severity === "P1");
  const p2 = issues.filter(i => i.severity === "P2");

  let md = `# 시뮬레이터 UX/버그 감사 리포트\n`;
  md += `기준: ${BASE}\n`;
  md += `일시: ${new Date().toLocaleString("ko-KR")}\n\n`;
  md += `## 요약\n`;
  md += `- 🔴 P0 (즉시 수정): ${p0.length}개\n`;
  md += `- 🟡 P1 (이번 sprint): ${p1.length}개\n`;
  md += `- 🟢 P2 (다음 sprint): ${p2.length}개\n\n`;

  for (const [label, list] of [["🔴 P0", p0], ["🟡 P1", p1], ["🟢 P2", p2]]) {
    if (list.length === 0) continue;
    md += `## ${label}\n`;
    for (const issue of list) {
      md += `### ${issue.desc}\n`;
      md += `- Step: \`${issue.step}\`\n`;
      if (issue.detail) md += `- Detail: ${issue.detail}\n`;
      md += "\n";
    }
  }

  md += `## 스크린샷\n`;
  md += `위치: \`/tmp/sim-audit/\`\n`;

  writeFileSync(`${OUT}/report.md`, md);
  console.log(`\n📋 리포트: ${OUT}/report.md`);
  return md;
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

console.log(`\n🚀 시뮬레이터 UX 감사 시작: ${BASE}`);
console.log(`📁 스크린샷 저장: ${OUT}\n`);

const browser = await chromium.launch({ headless: true });

try {
  await testStandardMode(browser);
  await testExpertMode(browser);
  await testMobileView(browser);
  await testKoVersion(browser);
} finally {
  await browser.close();
}

const report = generateReport();
console.log("\n" + "=".repeat(60));
console.log(report);
