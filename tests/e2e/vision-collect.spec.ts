import { test } from "@playwright/test";
import fs from "fs";
import path from "path";

/**
 * Vision QA: Screenshot + Data Collector
 *
 * 실제 pruviq.com을 사용자와 동일한 환경에서 접근하여:
 * 1. 전 페이지 스크린샷 (desktop + mobile)
 * 2. 화면에 실제 표시되는 데이터 추출
 * 3. API 데이터와 비교를 위한 정합성 데이터 수집
 *
 * 출력: test-results/vision/ 디렉토리
 *   - *.png  스크린샷
 *   - collect-data.json  추출된 데이터 + 정합성 체크용 수치
 */

const OUTPUT_DIR = "test-results/vision";
const BASE_URL = process.env.BASE_URL || "http://localhost:4321";
const API_BASE = "https://api.pruviq.com";

type PageEntry = {
  path: string;
  name: string;
  viewport: "desktop" | "mobile";
  expectations: string;
};

const PAGES: PageEntry[] = [
  // ── Desktop ──────────────────────────────────────────────────
  {
    path: "/",
    name: "home-desktop",
    viewport: "desktop",
    expectations:
      "hero h1 text, coin count 569+, CTA button, no skeleton/loading, no Korean text visible",
  },
  {
    path: "/simulate/",
    name: "simulate-desktop",
    viewport: "desktop",
    expectations:
      "strategy selector, parameter inputs, run button visible, 569 coin count",
  },
  {
    path: "/strategies/ranking",
    name: "ranking-desktop",
    viewport: "desktop",
    expectations:
      "Best 3 Strategies section with real strategy names, Win Rate %, PF values, not blank",
  },
  {
    path: "/ko/strategies/ranking",
    name: "ranking-ko-desktop",
    viewport: "desktop",
    expectations:
      "Korean text visible: 오늘의 전략 랭킹, Korean strategy labels, Win Rate numbers",
  },
  {
    path: "/market/",
    name: "market-desktop",
    viewport: "desktop",
    expectations:
      "Market Dashboard heading, BTC or crypto price indicators, not completely blank",
  },
  {
    path: "/coins/",
    name: "coins-desktop",
    viewport: "desktop",
    expectations: "coin symbols visible (BTC ETH SOL), list or grid layout",
  },
  {
    path: "/performance/",
    name: "performance-desktop",
    viewport: "desktop",
    expectations:
      "trade history table with actual trade data, P&L values, coin names",
  },
  {
    path: "/strategies/",
    name: "strategies-desktop",
    viewport: "desktop",
    expectations:
      "strategy cards or list with names, parameters visible, not blank",
  },
  {
    path: "/about/",
    name: "about-desktop",
    viewport: "desktop",
    expectations: "About page content, team info or mission statement",
  },
  {
    path: "/fees/",
    name: "fees-desktop",
    viewport: "desktop",
    expectations:
      "exchange fee comparison table with actual fee percentages (0.0x%)",
  },
  // ── Mobile ───────────────────────────────────────────────────
  {
    path: "/",
    name: "home-mobile",
    viewport: "mobile",
    expectations:
      "hero h1 text readable on mobile, coin count visible, CTA button fully visible",
  },
  {
    path: "/simulate/",
    name: "simulate-mobile",
    viewport: "mobile",
    expectations:
      "strategy selector visible on mobile, inputs not overlapping, run button accessible",
  },
  {
    path: "/strategies/ranking",
    name: "ranking-mobile",
    viewport: "mobile",
    expectations:
      "ranking data visible on 375px width, strategy names not cut off, Win Rate readable",
  },
  {
    path: "/ko/strategies/ranking",
    name: "ranking-ko-mobile",
    viewport: "mobile",
    expectations:
      "Korean text on mobile, rankings visible, no horizontal scroll needed for content",
  },
];

type ExtractedData = {
  url: string;
  viewport: string;
  http_status: number;
  screenshot: string;
  collected_at: string;
  page_data: {
    h1_text: string | null;
    h1_visible: boolean;
    coin_count_in_html: string | null;
    has_stale_549: boolean;
    has_skeleton: boolean;
    js_errors: string[];
    visible_text_sample: string;
    korean_text_visible: boolean;
    has_ranking_ssr_fallback: boolean;
    ranking_ssr_has_data: boolean;
    top3_names_visible: string[];
    win_rates_visible: string[];
    canvas_count: number;
    error_messages: string[];
    interactive_elements_count: number;
  };
  data_integrity: {
    api_ranking_date?: string;
    api_top1_strategy?: string;
    api_top1_win_rate?: number;
    rendered_matches_api?: boolean;
    coin_count_api?: number;
    coin_count_rendered?: string;
  };
  expectations: string;
};

type CollectReport = {
  collected_at: string;
  base_url: string;
  total_pages: number;
  pages: ExtractedData[];
};

test.describe.configure({ mode: "parallel" });

test.describe("Vision QA: collect screenshots and data", () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  for (const entry of PAGES) {
    test(`[${entry.viewport}] ${entry.path}`, async ({ browser }) => {
      const viewport =
        entry.viewport === "mobile"
          ? { width: 375, height: 812 }
          : { width: 1280, height: 900 };

      const context = await browser.newContext({
        viewport,
        isMobile: entry.viewport === "mobile",
        hasTouch: entry.viewport === "mobile",
        userAgent:
          entry.viewport === "mobile"
            ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      });

      const page = await context.newPage();
      const jsErrors: string[] = [];
      page.on("pageerror", (e) => {
        const msg = e.message;
        if (
          !msg.includes("net::") &&
          !msg.includes("fetch") &&
          !msg.includes("AbortError") &&
          !msg.includes("NetworkError") &&
          !msg.includes("Failed to fetch")
        ) {
          jsErrors.push(msg.slice(0, 200));
        }
      });

      const url = `${BASE_URL}${entry.path}`;
      let httpStatus = 0;
      const res = await page.goto(url, { waitUntil: "domcontentloaded" });
      httpStatus = res?.status() ?? 0;

      // 하이드레이션 대기 (실제 사용자와 동일한 경험)
      await page.waitForTimeout(4000);

      // ── 데이터 추출 ──────────────────────────────────────────
      const extracted = await page.evaluate(() => {
        const getVisibleText = () => {
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode(node) {
                const p = node.parentElement;
                if (!p) return NodeFilter.FILTER_REJECT;
                const t = p.tagName.toLowerCase();
                if (["script", "style", "noscript"].includes(t))
                  return NodeFilter.FILTER_REJECT;
                const s = getComputedStyle(p);
                if (s.display === "none" || s.visibility === "hidden")
                  return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
              },
            },
          );
          const texts: string[] = [];
          let n: Node | null;
          while ((n = walker.nextNode())) {
            const t = n.textContent?.trim();
            if (t && t.length > 1) texts.push(t);
          }
          return texts.join(" ");
        };

        const visibleText = getVisibleText();
        const h1El = document.querySelector("h1");
        const h1Text = h1El?.textContent?.trim() ?? null;
        const h1Rect = h1El?.getBoundingClientRect();
        const h1Visible =
          !!h1El &&
          !!h1Rect &&
          h1Rect.height > 0 &&
          h1Rect.top < window.innerHeight;

        // 코인 카운트
        const coinCountMatch =
          visibleText.match(/(\d{3,4})[+개\s]*(coins?|코인)/i) ||
          visibleText.match(/(569|549)\+?/);
        const coinCountStr = coinCountMatch ? coinCountMatch[0] : null;

        // 스켈레톤 감지
        const skeletons = document.querySelectorAll(
          "[class*='skeleton'], [class*='loading'], [class*='shimmer'], [aria-busy='true']",
        );
        const hasSkeleton = skeletons.length > 0;

        // SSR ranking fallback
        const ssrDiv = document.querySelector("#ranking-ssr-fallback");
        const ssrHasData = ssrDiv
          ? (ssrDiv.textContent?.length ?? 0) > 100
          : false;

        // Top3 전략 이름
        const strategyPattern =
          /\b(MACD|RSI|BB Squeeze|Breakout|ATR|Bollinger|EMA|SMA|Stoch)\b/gi;
        const top3Names = [
          ...new Set(visibleText.match(strategyPattern) ?? []),
        ].slice(0, 5);

        // Win Rate 수치
        const winRates = (
          visibleText.match(/(?:Win Rate|승률)[:\s]*(\d+\.?\d*%?)/gi) ?? []
        ).slice(0, 3);

        // 에러 메시지
        const errorMsgs: string[] = [];
        document
          .querySelectorAll('[class*="error"], [role="alert"]')
          .forEach((el) => {
            const t = el.textContent?.trim();
            if (t && t.length > 3) errorMsgs.push(t.slice(0, 100));
          });

        return {
          h1_text: h1Text,
          h1_visible: h1Visible,
          coin_count_in_html: coinCountStr,
          has_stale_549:
            visibleText.includes("549") && !visibleText.includes("569"),
          has_skeleton: hasSkeleton,
          visible_text_sample: visibleText.slice(0, 500),
          korean_text_visible: /[\uAC00-\uD7AF]/.test(visibleText),
          has_ranking_ssr_fallback: !!ssrDiv,
          ranking_ssr_has_data: ssrHasData,
          top3_names_visible: top3Names,
          win_rates_visible: winRates,
          canvas_count: document.querySelectorAll("canvas").length,
          error_messages: errorMsgs,
          interactive_elements_count: document.querySelectorAll(
            "button, input, select, [role='button'], [role='combobox']",
          ).length,
        };
      });

      // ── 스크린샷 촬영 ──────────────────────────────────────────
      const screenshotPath = path.join(OUTPUT_DIR, `${entry.name}.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        animations: "disabled",
      });

      // 폴드 위 영역 (ATF) 별도 촬영 — 사용자가 처음 보는 화면
      const atfPath = path.join(OUTPUT_DIR, `${entry.name}-atf.png`);
      await page.screenshot({
        path: atfPath,
        fullPage: false,
        animations: "disabled",
      });

      // ── API 데이터 정합성 수집 ─────────────────────────────────
      const dataIntegrity: ExtractedData["data_integrity"] = {};

      if (entry.path.includes("ranking") && BASE_URL.includes("pruviq.com")) {
        try {
          const apiRes = await page.evaluate(async () => {
            const r = await fetch(
              "https://api.pruviq.com/rankings/daily?period=30d&group=Market%20Cap%20Top%2050",
            );
            return r.ok ? await r.json() : null;
          });
          if (apiRes) {
            dataIntegrity.api_ranking_date = apiRes.date;
            dataIntegrity.api_top1_strategy = apiRes.top3?.[0]?.name_en;
            dataIntegrity.api_top1_win_rate = apiRes.top3?.[0]?.win_rate;
            const apiTop1 = apiRes.top3?.[0]?.name_en ?? "";
            const renderedTop1 = extracted.top3_names_visible[0] ?? "";
            dataIntegrity.rendered_matches_api =
              !apiTop1 ||
              !renderedTop1 ||
              apiTop1.toLowerCase().includes(renderedTop1.toLowerCase()) ||
              renderedTop1.toLowerCase().includes(apiTop1.toLowerCase());
          }
        } catch {
          // API unreachable
        }
      }

      if (
        (entry.path === "/" || entry.path.includes("simulate")) &&
        BASE_URL.includes("pruviq.com")
      ) {
        try {
          const coinStats = await page.evaluate(async () => {
            const r = await fetch("https://api.pruviq.com/coins/stats");
            return r.ok ? await r.json() : null;
          });
          if (coinStats) {
            dataIntegrity.coin_count_api = coinStats.total ?? coinStats.count;
            dataIntegrity.coin_count_rendered =
              extracted.coin_count_in_html ?? "not found";
          }
        } catch {
          // skip
        }
      }

      // ── 결과 저장 ──────────────────────────────────────────────
      const result: ExtractedData = {
        url,
        viewport: entry.viewport,
        http_status: httpStatus,
        screenshot: `${entry.name}.png`,
        collected_at: new Date().toISOString(),
        page_data: {
          ...extracted,
          js_errors: jsErrors,
        },
        data_integrity: dataIntegrity,
        expectations: entry.expectations,
      };

      // 개별 결과 저장 (병렬 실행 충돌 방지)
      const resultPath = path.join(OUTPUT_DIR, `${entry.name}.json`);
      fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));

      await context.close();
    });
  }

  // 모든 개별 JSON을 합쳐서 collect-data.json 생성
  test("merge collected data", async () => {
    // 다른 테스트 완료 대기
    await new Promise((r) => setTimeout(r, 2000));

    const files = fs
      .readdirSync(OUTPUT_DIR)
      .filter((f) => f.endsWith(".json") && f !== "collect-data.json");

    const pages: ExtractedData[] = [];
    for (const f of files) {
      try {
        const data = JSON.parse(
          fs.readFileSync(path.join(OUTPUT_DIR, f), "utf-8"),
        );
        pages.push(data);
      } catch {
        // skip malformed
      }
    }

    const report: CollectReport = {
      collected_at: new Date().toISOString(),
      base_url: BASE_URL,
      total_pages: pages.length,
      pages,
    };

    fs.writeFileSync(
      path.join(OUTPUT_DIR, "collect-data.json"),
      JSON.stringify(report, null, 2),
    );

    console.log(
      `\nVision collect complete: ${pages.length} pages captured → ${OUTPUT_DIR}/`,
    );
  });
});
