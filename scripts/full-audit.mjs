/**
 * full-audit.mjs — PRUVIQ 전체 페이지 UX/기능 감사 도구
 *
 * 사용법:
 *   node scripts/full-audit.mjs [base_url] [--phase=all|static|interactive|simulator]
 *
 *   node scripts/full-audit.mjs                          # 전체 감사 (프로덕션)
 *   node scripts/full-audit.mjs http://localhost:4321    # 로컬 dev 서버
 *   node scripts/full-audit.mjs --phase=static           # 스크린샷만
 *   node scripts/full-audit.mjs --phase=simulator        # 시뮬레이터만
 *
 * 결과:
 *   /tmp/pruviq-audit/screenshots/   ← 모든 스크린샷
 *   /tmp/pruviq-audit/report.md      ← 이슈 리포트
 *   /tmp/pruviq-audit/report.json    ← 구조화 데이터
 */

import { chromium } from "playwright";
import { mkdirSync, writeFileSync, existsSync } from "fs";

// ─── 설정 ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const BASE = args.find((a) => a.startsWith("http")) || "https://pruviq.com";
const PHASE = (args.find((a) => a.startsWith("--phase="))?.split("=")[1]) || "all";
const OUT = "/tmp/pruviq-audit";
const SS_DIR = `${OUT}/screenshots`;
mkdirSync(SS_DIR, { recursive: true });

// ─── 상태 ──────────────────────────────────────────────────────────────────────
const issues = [];
const screenshots = [];
let stepNum = 0;

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────
function log(msg) { console.log(msg); }

async function shot(page, key, desc = "") {
  stepNum++;
  const fname = `${String(stepNum).padStart(3, "0")}-${key}.png`;
  const path = `${SS_DIR}/${fname}`;
  await page.screenshot({ path, fullPage: false });
  screenshots.push({ fname, desc, key });
  log(`  📸 ${fname}${desc ? " — " + desc : ""}`);
  return fname;
}

async function shotFull(page, key, desc = "") {
  stepNum++;
  const fname = `${String(stepNum).padStart(3, "0")}-${key}-full.png`;
  await page.screenshot({ path: `${SS_DIR}/${fname}`, fullPage: true });
  screenshots.push({ fname, desc: desc + " (전체)", key });
  log(`  📸 ${fname} (전체페이지)`);
  return fname;
}

function issue(severity, page, element, desc, detail = "") {
  issues.push({ severity, page, element, desc, detail, ts: new Date().toISOString() });
  const icon = { P0: "🔴", P1: "🟡", P2: "🟢" }[severity] || "⚪";
  log(`  ${icon} [${severity}][${page}] ${element}: ${desc}`);
}

function ok(msg) { log(`  ✅ ${msg}`); }
function warn(msg) { log(`  ⚠️  ${msg}`); }

async function goto(page, path, opts = {}) {
  try {
    await page.goto(`${BASE}${path}`, {
      waitUntil: "networkidle",
      timeout: 30000,
      ...opts,
    });
    await page.waitForTimeout(2500);
    return true;
  } catch (e) {
    issue("P0", path, "page-load", `페이지 로딩 실패: ${e.message}`);
    return false;
  }
}

async function clickIfVisible(page, selector, label, pageName) {
  const el = page.locator(selector).first();
  if (await el.isVisible().catch(() => false)) {
    await el.click();
    await page.waitForTimeout(400);
    return true;
  }
  return false;
}

async function getConsoleErrors(page) {
  const errs = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("favicon")) {
      errs.push(msg.text().slice(0, 200));
    }
  });
  return errs;
}

// 링크 404 체크
async function checkLinks(page, pageName) {
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href]"))
      .map((a) => a.href)
      .filter((h) => h.startsWith(location.origin) && !h.includes("#"))
      .slice(0, 20)
  );
  // 샘플 링크만 체크 (전수 조사 시 느림)
  return links;
}

// ─── 페이지 정의 ───────────────────────────────────────────────────────────────
const PAGES = [
  // EN 데스크탑
  { path: "/",                      lang: "en", key: "home",               w: 1280, h: 900 },
  { path: "/simulate",              lang: "en", key: "simulate",           w: 1280, h: 900 },
  { path: "/strategies",            lang: "en", key: "strategies",         w: 1280, h: 900 },
  { path: "/strategies/ranking",    lang: "en", key: "strategies-ranking", w: 1280, h: 900 },
  { path: "/strategies/bb-squeeze-short", lang: "en", key: "strategy-detail", w: 1280, h: 900 },
  { path: "/market",                lang: "en", key: "market",             w: 1280, h: 900 },
  { path: "/coins",                 lang: "en", key: "coins",              w: 1280, h: 900 },
  { path: "/signals",               lang: "en", key: "signals",            w: 1280, h: 900 },
  { path: "/fees",                  lang: "en", key: "fees",               w: 1280, h: 900 },
  { path: "/compare",               lang: "en", key: "compare",            w: 1280, h: 900 },
  { path: "/compare/tradingview",   lang: "en", key: "compare-tv",         w: 1280, h: 900 },
  { path: "/learn",                 lang: "en", key: "learn",              w: 1280, h: 900 },
  { path: "/about",                 lang: "en", key: "about",              w: 1280, h: 900 },
  { path: "/performance",           lang: "en", key: "performance",        w: 1280, h: 900 },
  // KO 데스크탑
  { path: "/ko/",                   lang: "ko", key: "ko-home",            w: 1280, h: 900 },
  { path: "/ko/simulate",           lang: "ko", key: "ko-simulate",        w: 1280, h: 900 },
  { path: "/ko/strategies",         lang: "ko", key: "ko-strategies",      w: 1280, h: 900 },
  { path: "/ko/strategies/ranking", lang: "ko", key: "ko-ranking",         w: 1280, h: 900 },
  { path: "/ko/market",             lang: "ko", key: "ko-market",          w: 1280, h: 900 },
  { path: "/ko/signals",            lang: "ko", key: "ko-signals",         w: 1280, h: 900 },
  { path: "/ko/fees",               lang: "ko", key: "ko-fees",            w: 1280, h: 900 },
  { path: "/ko/compare",            lang: "ko", key: "ko-compare",         w: 1280, h: 900 },
  { path: "/ko/learn",              lang: "ko", key: "ko-learn",           w: 1280, h: 900 },
  { path: "/ko/about",              lang: "ko", key: "ko-about",           w: 1280, h: 900 },
  // EN 모바일
  { path: "/",                      lang: "en", key: "m-home",             w: 390, h: 844, mobile: true },
  { path: "/simulate",              lang: "en", key: "m-simulate",         w: 390, h: 844, mobile: true },
  { path: "/strategies/ranking",    lang: "en", key: "m-ranking",          w: 390, h: 844, mobile: true },
  { path: "/market",                lang: "en", key: "m-market",           w: 390, h: 844, mobile: true },
  // KO 모바일
  { path: "/ko/",                   lang: "ko", key: "m-ko-home",          w: 390, h: 844, mobile: true },
  { path: "/ko/simulate",           lang: "ko", key: "m-ko-simulate",      w: 390, h: 844, mobile: true },
];

// ─── Phase 1: 전체 페이지 스크린샷 ───────────────────────────────────────────
async function phaseStatic(browser) {
  log("\n" + "═".repeat(60));
  log("Phase 1: 전체 페이지 스크린샷");
  log("═".repeat(60));

  for (const p of PAGES) {
    const label = `${p.mobile ? "📱" : "🖥 "} [${p.lang.toUpperCase()}] ${p.path}`;
    log(`\n${label}`);

    const ctx = await browser.newContext({
      viewport: { width: p.w, height: p.h },
    });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("favicon") && !msg.text().includes("CSP")) {
        consoleErrors.push(msg.text().slice(0, 150));
      }
    });

    const loaded = await goto(page, p.path);
    if (!loaded) { await ctx.close(); continue; }

    // 스크린샷
    await shot(page, p.key, `${p.lang} ${p.path}`);

    // 404 / 빈 페이지 체크
    const bodyText = await page.evaluate(() => document.body?.innerText?.trim() || "");
    if (bodyText.length < 50) {
      issue("P0", p.path, "page-content", "페이지 콘텐츠가 거의 없음 (50자 미만)");
    }

    // 한국어 페이지에서 영문 하드코딩 체크
    if (p.lang === "ko") {
      const EN_STRINGS = ["Run Backtest", "Test Period", "Stop Loss", "Take Profit", "Win Rate", "Select Strategy"];
      for (const str of EN_STRINGS) {
        if (bodyText.includes(str)) {
          issue("P2", p.path, "i18n", `한국어 페이지에 영문 하드코딩: "${str}"`);
        }
      }
    }

    // H1 태그 확인
    const h1Count = await page.locator("h1").count();
    if (h1Count === 0) issue("P2", p.path, "seo", "H1 태그 없음");
    else if (h1Count > 1) issue("P2", p.path, "seo", `H1 태그 ${h1Count}개 (중복)`);

    // 콘솔 에러 (심각한 것만)
    const nonCSPErrors = consoleErrors.filter(e => !e.includes("inline style") && !e.includes("CSP"));
    if (nonCSPErrors.length > 0) {
      issue("P1", p.path, "console", `JS 에러 ${nonCSPErrors.length}개`, nonCSPErrors[0]);
    }

    await ctx.close();
  }
}

// ─── Phase 2: 인터랙션 감사 (네비게이션, 버튼, 드롭다운) ─────────────────────
async function phaseInteractive(browser) {
  log("\n" + "═".repeat(60));
  log("Phase 2: 인터랙션 감사");
  log("═".repeat(60));

  // ── 2-A. 네비게이션 메뉴 ──────────────────────────────────────────────────
  log("\n── 2-A. 데스크탑 네비게이션 ──");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await goto(page, "/");
    await shot(page, "nav-desktop", "데스크탑 GNB");

    const navLinks = ["Simulate", "Strategies", "Market", "Coins", "Learn", "Fees", "About"];
    for (const label of navLinks) {
      const link = page.locator(`nav a:has-text("${label}"), header a:has-text("${label}")`).first();
      if (await link.isVisible().catch(() => false)) {
        const href = await link.getAttribute("href").catch(() => null);
        ok(`네비게이션 "${label}" → ${href}`);
      } else {
        issue("P1", "/", `nav-${label}`, `GNB "${label}" 링크 없음`);
      }
    }

    // Strategies 드롭다운
    const stratLink = page.locator('nav a:has-text("Strategies"), header a:has-text("Strategies")').first();
    if (await stratLink.isVisible().catch(() => false)) {
      await stratLink.hover();
      await page.waitForTimeout(400);
      const dropdown = page.locator('[class*="dropdown"], [class*="submenu"]').first();
      if (await dropdown.isVisible().catch(() => false)) {
        ok("Strategies 드롭다운 열림");
        await shot(page, "nav-strategies-dropdown", "Strategies 드롭다운");
      }
    }
    await ctx.close();
  }

  // ── 2-B. 모바일 햄버거 메뉴 ──────────────────────────────────────────────
  log("\n── 2-B. 모바일 햄버거 메뉴 ──");
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await goto(page, "/");
    await shot(page, "mobile-nav-closed", "모바일 GNB 닫힌 상태");

    const hamburger = page.locator("#mobile-menu-btn, button[aria-label*='menu'], button[aria-label*='Menu']").first();
    if (await hamburger.isVisible().catch(() => false)) {
      await hamburger.click();
      await page.waitForTimeout(500);
      await shot(page, "mobile-nav-open", "모바일 메뉴 열림");
      ok("모바일 햄버거 메뉴 열림");

      // 메뉴 아이템 확인
      const menuItems = await page.locator("nav a, [class*='mobile-menu'] a").count();
      log(`  모바일 메뉴 링크 수: ${menuItems}`);
      if (menuItems < 4) issue("P1", "/", "mobile-menu", `모바일 메뉴 링크 ${menuItems}개 (너무 적음)`);
    } else {
      issue("P1", "/", "mobile-hamburger", "모바일 햄버거 버튼 없음");
    }
    await ctx.close();
  }

  // ── 2-C. 언어 전환 ───────────────────────────────────────────────────────
  log("\n── 2-C. 언어 전환 ──");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await goto(page, "/");

    const langBtn = page.locator("button:has-text('KO'), button:has-text('EN'), [aria-label*='language'], [aria-label*='Language']").first();
    if (await langBtn.isVisible().catch(() => false)) {
      const before = page.url();
      await langBtn.click();
      await page.waitForTimeout(1000);
      const after = page.url();
      if (before === after) {
        issue("P1", "/", "lang-switch", "언어 전환 클릭 후 URL 변화 없음");
      } else {
        ok(`언어 전환: ${before} → ${after}`);
        await shot(page, "lang-switch-ko", "한국어로 전환");
      }
    } else {
      issue("P1", "/", "lang-btn", "언어 전환 버튼 없음");
    }
    await ctx.close();
  }

  // ── 2-D. CTA 버튼들 ─────────────────────────────────────────────────────
  log("\n── 2-D. 홈 CTA 버튼 ──");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await goto(page, "/");

    // 메인 CTA 버튼들
    const ctaButtons = await page.locator("a[href], button").filter({ hasText: /simulate|backtest|start|try|시뮬|시작|백테/i }).all();
    log(`  CTA 버튼 ${ctaButtons.length}개 발견`);
    for (const btn of ctaButtons.slice(0, 5)) {
      const text = await btn.textContent().catch(() => "?");
      const href = await btn.getAttribute("href").catch(() => null);
      log(`    → "${text?.trim()}" href=${href}`);
    }
    await shot(page, "home-cta", "홈 CTA 버튼들");
    await ctx.close();
  }

  // ── 2-E. Fees 페이지 거래소 탭 ──────────────────────────────────────────
  log("\n── 2-E. Fees 거래소 탭 ──");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await goto(page, "/fees");
    await shot(page, "fees-init", "Fees 초기");

    const exchangeTabs = page.locator("button:has-text('Binance'), button:has-text('OKX'), button:has-text('Bybit')");
    const tabCount = await exchangeTabs.count();
    log(`  거래소 탭 ${tabCount}개`);
    if (tabCount === 0) issue("P1", "/fees", "exchange-tabs", "거래소 탭 없음");

    for (let i = 0; i < Math.min(tabCount, 3); i++) {
      await exchangeTabs.nth(i).click();
      await page.waitForTimeout(300);
    }
    await shot(page, "fees-tabs", "Fees 탭 전환 후");
    await ctx.close();
  }

  // ── 2-F. Coins 페이지 정렬/필터 ─────────────────────────────────────────
  log("\n── 2-F. Coins 페이지 인터랙션 ──");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await goto(page, "/coins");
    await shot(page, "coins-init", "Coins 초기");

    // 코인 행 수 확인
    await page.waitForTimeout(3000);
    const coinRows = await page.locator("table tbody tr, [class*='coin-row'], [class*='coin-item']").count();
    log(`  코인 행 ${coinRows}개 표시`);
    if (coinRows < 10) issue("P1", "/coins", "coin-list", `코인 목록 ${coinRows}개 (너무 적음)`);

    // 정렬 버튼
    const sortBtn = page.locator("th button, th[role='button'], button:has-text('Market Cap'), button:has-text('Volume')").first();
    if (await sortBtn.isVisible().catch(() => false)) {
      await sortBtn.click();
      await page.waitForTimeout(500);
      ok("코인 정렬 클릭");
      await shot(page, "coins-sorted", "코인 정렬 후");
    }
    await ctx.close();
  }

  // ── 2-G. Strategies 페이지 탭 ───────────────────────────────────────────
  log("\n── 2-G. Strategies 탭 ──");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await goto(page, "/strategies");
    await shot(page, "strategies-init", "Strategies 초기");

    const tabs = page.locator("[role='tab'], button:has-text('SHORT'), button:has-text('LONG'), button:has-text('All')");
    const tabCount = await tabs.count();
    log(`  전략 탭 ${tabCount}개`);
    for (let i = 0; i < Math.min(tabCount, 3); i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(300);
    }
    await shot(page, "strategies-tabs", "전략 탭 전환");
    await ctx.close();
  }

  // ── 2-H. Ranking 페이지 기간 전환 ───────────────────────────────────────
  log("\n── 2-H. Strategies Ranking 기간/탭 ──");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await goto(page, "/strategies/ranking");
    await shot(page, "ranking-init", "Ranking 초기");
    await page.waitForTimeout(2000);

    // 기간 버튼 (7D, 30D, 90D 등)
    const periodBtns = page.locator("button:has-text('7D'), button:has-text('30D'), button:has-text('90D'), button:has-text('All')");
    const periodCount = await periodBtns.count();
    log(`  기간 버튼 ${periodCount}개`);
    for (let i = 0; i < Math.min(periodCount, 4); i++) {
      await periodBtns.nth(i).click();
      await page.waitForTimeout(800);
    }
    await shot(page, "ranking-period", "Ranking 기간 전환");

    // Ranking 카드 수 확인
    const cards = await page.locator("[class*='ranking'], [class*='strategy-card'], table tbody tr").count();
    log(`  랭킹 카드/행 ${cards}개`);
    if (cards === 0) issue("P1", "/strategies/ranking", "ranking-cards", "랭킹 카드가 0개");
    await ctx.close();
  }

  // ── 2-I. Market 페이지 ──────────────────────────────────────────────────
  log("\n── 2-I. Market 인터랙션 ──");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await goto(page, "/market");
    await page.waitForTimeout(3000);
    await shot(page, "market-loaded", "Market 데이터 로딩 후");

    // 데이터 로딩 확인
    const btcPrice = await page.locator("text=/\\$[0-9,]+/, text=BTC").first().isVisible().catch(() => false);
    if (!btcPrice) issue("P1", "/market", "market-data", "BTC 가격 데이터 없음 (3초 후)");
    else ok("Market BTC 가격 데이터 확인");
    await ctx.close();
  }

  // ── 2-J. Signals 페이지 ─────────────────────────────────────────────────
  log("\n── 2-J. Signals 인터랙션 ──");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await goto(page, "/signals");
    await page.waitForTimeout(4000);
    await shot(page, "signals-loaded", "Signals 로딩 후");

    // 시그널 카드 수
    const signalCards = await page.locator("[class*='signal'], table tbody tr").count();
    log(`  시그널 카드/행 ${signalCards}개`);
    if (signalCards === 0) issue("P1", "/signals", "signal-data", "시그널 데이터 없음 (4초 후)");
    await ctx.close();
  }
}

// ─── Phase 3: 시뮬레이터 전체 기능 감사 ──────────────────────────────────────
async function phaseSimulator(browser) {
  log("\n" + "═".repeat(60));
  log("Phase 3: 시뮬레이터 전체 기능 감사");
  log("═".repeat(60));

  // ── 3-A. Quick Test 모드 ─────────────────────────────────────────────────
  log("\n── 3-A. Quick Test 모드 ──");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await goto(page, "/simulate");
    await shot(page, "sim-init", "시뮬레이터 초기");

    // Quick Test 탭 클릭
    const quickBtn = page.locator('button:has-text("Quick Test"), button:has-text("Quick")').first();
    if (await quickBtn.isVisible().catch(() => false)) {
      await quickBtn.click();
      await page.waitForTimeout(500);
      await shot(page, "sim-quicktest-tab", "Quick Test 탭");

      // Quick Test 실행 버튼
      const runBtn = page.locator('[data-testid="run-simulate"], button:has-text("Run")').first();
      if (await runBtn.isVisible().catch(() => false) && !await runBtn.isDisabled().catch(() => true)) {
        await runBtn.click();
        log("  🔄 Quick Test 실행 중...");
        await page.waitForTimeout(12000);
        await shot(page, "sim-quicktest-result", "Quick Test 결과");

        const hasResult = await page.locator("text=Win Rate, text=승률, text=Total Return").first().isVisible().catch(() => false);
        if (!hasResult) issue("P0", "/simulate", "quicktest-result", "Quick Test 결과 안 나옴 (12초)");
        else ok("Quick Test 결과 확인");
      } else {
        issue("P1", "/simulate", "quicktest-run-btn", "Quick Test 실행 버튼 비활성화/없음");
      }
    }
    await ctx.close();
  }

  // ── 3-B. Standard 모드 ──────────────────────────────────────────────────
  log("\n── 3-B. Standard 모드 ──");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await goto(page, "/simulate");

    const standardBtn = page.locator('button:has-text("Standard"), button:has-text("Your Parameters")').first();
    if (await standardBtn.isVisible().catch(() => false)) {
      await standardBtn.click();
      await page.waitForTimeout(1000);
      await shot(page, "sim-standard-tab", "Standard 탭");

      // 기본 기간 1년 확인
      const startDate = await page.evaluate(() =>
        document.querySelector('input[type="date"]')?.value || null
      );
      if (startDate) {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const diff = Math.abs(new Date(startDate) - oneYearAgo) / 864e5;
        if (diff > 7) issue("P1", "/simulate", "default-period", `기본 기간 1년 아님: ${startDate}`);
        else ok(`기본 기간 1년 확인: ${startDate}`);
      }

      // 수수료 슬라이더 (min=0.01, max=0.20)
      const feeSlider = page.locator('input[type="range"][min="0.01"]').first();
      if (await feeSlider.isVisible().catch(() => false)) {
        ok("수수료 슬라이더 확인");
        // range input은 fill() 대신 evaluate로 값 설정
        await feeSlider.evaluate((el) => {
          el.value = "0.10";
          el.dispatchEvent(new Event("input", { bubbles: true }));
        });
        await page.waitForTimeout(200);
        await shot(page, "sim-standard-fee-slider", "수수료 슬라이더 조작");
      } else {
        issue("P1", "/simulate", "fee-slider", "Standard 모드 수수료 슬라이더 없음");
      }

      // 생존자 편향 disclaimer
      const disclaimer = await page.locator("text=Delisted, text=survivor, text=생존자, text=상장폐지").first().isVisible().catch(() => false);
      if (!disclaimer) issue("P1", "/simulate", "survivor-disclaimer", "생존자 편향 disclaimer 없음");
      else ok("생존자 편향 disclaimer 확인");

      // 프리셋 선택
      const presets = page.locator('button[class*="preset"], .preset-btn').all();
      const presetBtns = await presets;
      log(`  프리셋 버튼 ${presetBtns.length}개`);

      // SL 슬라이더
      const sliders = await page.locator('input[type="range"]').all();
      log(`  슬라이더 총 ${sliders.length}개`);

      // 레버리지 버튼
      const leverageBtns = page.locator('button:has-text("1x"), button:has-text("3x"), button:has-text("5x")');
      const leverageCount = await leverageBtns.count();
      if (leverageCount === 0) issue("P1", "/simulate", "leverage-btns", "레버리지 버튼(1x/3x/5x) 없음");
      else ok(`레버리지 버튼 ${leverageCount}개`);

      // Standard 백테스트 실행
      const runBtn = page.locator('[data-testid="run-simulate"]').first();
      if (await runBtn.isVisible().catch(() => false) && !await runBtn.isDisabled().catch(() => true)) {
        await runBtn.click();
        log("  🔄 Standard 백테스트 실행 중...");
        await page.waitForTimeout(15000);
        await shot(page, "sim-standard-result", "Standard 결과 Summary");

        // 결과 탭들 (실제 레이블: TRADE LIST, EQUITY CURVE)
        const tabs = [
          { label: "TRADE LIST", key: "trades" },
          { label: "EQUITY CURVE", key: "equity" },
          { label: "PER COIN", key: "per-coin" },
        ];
        for (const { label, key } of tabs) {
          const tab = page.locator(`button:has-text("${label}"), a:has-text("${label}")`).first();
          if (await tab.isVisible().catch(() => false)) {
            await tab.click();
            await page.waitForTimeout(800);
            await shot(page, `sim-standard-${key}`, `Standard ${label} 탭`);
            ok(`결과 탭 "${label}" 확인`);
          } else {
            issue("P1", "/simulate", `${key}-tab`, `결과 "${label}" 탭 없음`);
          }
        }

        // 결과 수치 합리성 검사
        const metrics = await page.evaluate(() => {
          const nums = [];
          document.querySelectorAll("[class*='font-mono'], [class*='metric'], [class*='stat']").forEach((el) => {
            const t = el.textContent?.trim();
            if (t && /\d/.test(t)) nums.push(t);
          });
          return nums.slice(0, 20);
        });
        log(`  📊 결과 수치: ${metrics.slice(0, 8).join(" | ")}`);
      } else {
        issue("P0", "/simulate", "standard-run-btn", "Standard 실행 버튼 비활성화/없음");
      }
    }
    await ctx.close();
  }

  // ── 3-C. Expert 모드 ────────────────────────────────────────────────────
  log("\n── 3-C. Expert 모드 ──");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await goto(page, "/simulate");

    const expertBtn = page.locator('button:has-text("Expert"), button:has-text("Full control")').first();
    if (await expertBtn.isVisible().catch(() => false)) {
      await expertBtn.click();
      await page.waitForTimeout(1000);
      await shot(page, "sim-expert-tab", "Expert 탭 진입");

      // 지표 토글 확인
      const indicators = await page.locator('[class*="indicator"] input[type="checkbox"], [class*="indicator"] button').all();
      log(`  지표 토글 ${indicators.length}개`);

      // 조건 드롭다운 옵션 수 (P0 버그 체크)
      const fieldSelects = await page.locator('select[aria-label="Indicator field"]').all();
      log(`  조건 행 ${fieldSelects.length}개`);
      for (let i = 0; i < fieldSelects.length; i++) {
        const optCount = await fieldSelects[i].locator("option").count();
        if (optCount === 0) {
          issue("P0", "/simulate", `expert-condition-${i}`, `조건 ${i+1}번 드롭다운 옵션 0개`);
        } else {
          ok(`조건 ${i+1}번 드롭다운: ${optCount}개 옵션`);
        }
      }

      // + Add Condition
      const addBtn = page.locator('button:has-text("Add Condition"), button:has-text("조건 추가")').first();
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(400);
        const newSelect = page.locator('select[aria-label="Indicator field"]').last();
        const newOptCount = await newSelect.locator("option").count();
        if (newOptCount === 0) {
          issue("P0", "/simulate", "expert-add-condition", "새 조건 드롭다운 옵션 0개");
        } else {
          ok(`새 조건 드롭다운: ${newOptCount}개 옵션`);
        }
        await shot(page, "sim-expert-add-condition", "Expert 조건 추가 후");
      }

      // 지표 체크해제 테스트
      const firstCheckbox = page.locator('input[type="checkbox"]').first();
      if (await firstCheckbox.isVisible().catch(() => false)) {
        await firstCheckbox.click(); // 체크해제
        await page.waitForTimeout(300);
        const afterCount = await page.locator('select[aria-label="Indicator field"]').count();
        log(`  지표 체크해제 후 조건 행 수: ${afterCount}`);
        await firstCheckbox.click(); // 다시 체크
      }

      // Timeframe 버튼
      const tfBtns = ["1H", "4H", "1D"];
      for (const tf of tfBtns) {
        const btn = page.locator(`button:has-text("${tf}")`).first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(200);
        }
      }
      await shot(page, "sim-expert-full", "Expert 전체");

      // Expert 백테스트 실행
      const runBtn = page.locator('[data-testid="run-simulate"], [data-testid="run-backtest"], button:has-text("Run Backtest"), button:has-text("백테스트 실행"), button:has-text("Run BB")').first();
      if (await runBtn.isVisible().catch(() => false) && !await runBtn.isDisabled().catch(() => true)) {
        await runBtn.click();
        log("  🔄 Expert 백테스트 실행 중...");
        await page.waitForTimeout(15000);
        await shot(page, "sim-expert-result", "Expert 결과");
      } else {
        issue("P1", "/simulate", "expert-run-btn", "Expert 실행 버튼 없음/비활성");
      }
    } else {
      issue("P1", "/simulate", "expert-tab", "Expert 탭 없음");
    }
    await ctx.close();
  }

  // ── 3-D. 모바일 시뮬레이터 ──────────────────────────────────────────────
  log("\n── 3-D. 모바일 시뮬레이터 ──");
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await goto(page, "/simulate");
    await shot(page, "sim-mobile-init", "모바일 시뮬레이터 초기");

    // 모바일에서 Standard 탭
    const standardBtn = page.locator('button:has-text("Standard")').first();
    if (await standardBtn.isVisible().catch(() => false)) {
      await standardBtn.click();
      await page.waitForTimeout(500);
      await shot(page, "sim-mobile-standard", "모바일 Standard 탭");

      // 실행 버튼 터치 타겟 체크
      const runBtn = page.locator('[data-testid="run-simulate"]').first();
      if (await runBtn.isVisible().catch(() => false)) {
        const box = await runBtn.boundingBox();
        if (box) {
          if (box.height < 44) issue("P1", "/simulate", "mobile-run-target", `실행 버튼 높이 ${box.height}px (최소 44px)`);
          else ok(`실행 버튼 터치 타겟: ${box.width}×${box.height}px`);
        }
      } else {
        issue("P0", "/simulate", "mobile-run-btn", "모바일 Standard에서 실행 버튼 안 보임");
      }

      // 모바일 결과 탭 전환 (Config/Results)
      const resultsTab = page.locator('button:has-text("Results"), button:has-text("결과")').first();
      if (await resultsTab.isVisible().catch(() => false)) {
        await resultsTab.click();
        await page.waitForTimeout(300);
        await shot(page, "sim-mobile-results-tab", "모바일 Results 탭");
      }
    }
    await ctx.close();
  }

  // ── 3-E. 한국어 시뮬레이터 ──────────────────────────────────────────────
  log("\n── 3-E. 한국어 시뮬레이터 ──");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await goto(page, "/ko/simulate");
    await shot(page, "sim-ko-init", "한국어 시뮬레이터");

    // 한국어 텍스트 확인
    const pageText = await page.evaluate(() => document.body.innerText);
    const koWords = ["시뮬레이터", "전략", "백테스트", "실행"];
    const foundKo = koWords.filter((w) => pageText.includes(w));
    log(`  한국어 키워드 확인: ${foundKo.join(", ")}`);
    if (foundKo.length < 2) issue("P1", "/ko/simulate", "ko-text", "한국어 텍스트 거의 없음");

    // 영문 하드코딩
    const EN_IN_KO = ["Run Backtest", "Test Period", "Stop Loss", "Take Profit"];
    for (const str of EN_IN_KO) {
      if (pageText.includes(str)) issue("P2", "/ko/simulate", "ko-i18n", `"${str}" 영문 하드코딩`);
    }
    await ctx.close();
  }
}

// ─── 리포트 생성 ──────────────────────────────────────────────────────────────
function generateReport() {
  const p0 = issues.filter((i) => i.severity === "P0");
  const p1 = issues.filter((i) => i.severity === "P1");
  const p2 = issues.filter((i) => i.severity === "P2");

  let md = `# PRUVIQ 전체 감사 리포트\n\n`;
  md += `- **기준 URL**: ${BASE}\n`;
  md += `- **감사 범위**: ${PHASE}\n`;
  md += `- **일시**: ${new Date().toLocaleString("ko-KR")}\n`;
  md += `- **스크린샷**: ${screenshots.length}장\n\n`;
  md += `## 요약\n`;
  md += `| 심각도 | 건수 | 의미 |\n|--------|------|------|\n`;
  md += `| 🔴 P0 | ${p0.length} | 즉시 수정 (기능 불가) |\n`;
  md += `| 🟡 P1 | ${p1.length} | 이번 sprint |\n`;
  md += `| 🟢 P2 | ${p2.length} | 다음 sprint |\n\n`;

  for (const [icon, label, list] of [
    ["🔴", "P0 — 즉시 수정", p0],
    ["🟡", "P1 — 이번 Sprint", p1],
    ["🟢", "P2 — 다음 Sprint", p2],
  ]) {
    if (list.length === 0) continue;
    md += `## ${icon} ${label}\n\n`;
    for (const iss of list) {
      md += `### ${iss.element}: ${iss.desc}\n`;
      md += `- 페이지: \`${iss.page}\`\n`;
      if (iss.detail) md += `- 상세: ${iss.detail}\n`;
      md += "\n";
    }
  }

  md += `## 스크린샷 목록 (${screenshots.length}장)\n\n`;
  md += `| 파일 | 설명 |\n|------|------|\n`;
  for (const ss of screenshots) {
    md += `| \`${ss.fname}\` | ${ss.desc} |\n`;
  }

  writeFileSync(`${OUT}/report.md`, md);
  writeFileSync(`${OUT}/report.json`, JSON.stringify({ base: BASE, phase: PHASE, issues, screenshots }, null, 2));

  return { md, p0: p0.length, p1: p1.length, p2: p2.length };
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
log(`\n${"█".repeat(60)}`);
log(`PRUVIQ 전체 감사 시작`);
log(`URL: ${BASE}`);
log(`범위: ${PHASE}`);
log(`스크린샷: ${SS_DIR}`);
log("█".repeat(60));

const browser = await chromium.launch({ headless: true });
const start = Date.now();

try {
  if (PHASE === "all" || PHASE === "static")      await phaseStatic(browser);
  if (PHASE === "all" || PHASE === "interactive") await phaseInteractive(browser);
  if (PHASE === "all" || PHASE === "simulator")   await phaseSimulator(browser);
} finally {
  await browser.close();
}

const { md, p0, p1, p2 } = generateReport();
const elapsed = Math.round((Date.now() - start) / 1000);

log(`\n${"═".repeat(60)}`);
log(`완료: ${elapsed}초`);
log(`스크린샷: ${screenshots.length}장 → ${SS_DIR}`);
log(`리포트: ${OUT}/report.md`);
log(`\n🔴 P0: ${p0}개  🟡 P1: ${p1}개  🟢 P2: ${p2}개`);
log("═".repeat(60));
