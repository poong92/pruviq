#!/usr/bin/env npx tsx
/**
 * Vision QA: Claude Vision Analyzer (Claude CLI 방식)
 *
 * ANTHROPIC_API_KEY 불필요 — Claude Code CLI 인증 재사용.
 * `claude --print --input-format stream-json` 으로 이미지 분석.
 *
 * Usage:
 *   npx tsx scripts/vision-analyze.ts
 *   VISION_DIR=test-results/vision npx tsx scripts/vision-analyze.ts
 */

import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const VISION_DIR = process.env.VISION_DIR ?? "test-results/vision";
const REPORT_PATH = path.join(VISION_DIR, "vision-report.json");
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-4-7";

// QA 지식 베이스 로드 (tests/harness/qa-knowledge.md)
const QA_KNOWLEDGE_PATH = path.join(
  process.cwd(),
  "tests/harness/qa-knowledge.md",
);
const QA_KNOWLEDGE = fs.existsSync(QA_KNOWLEDGE_PATH)
  ? fs.readFileSync(QA_KNOWLEDGE_PATH, "utf-8")
  : "";

// QA 규칙 config 로드 (tests/harness/qa-rules.json) — 코드 수정 없이 규칙 변경 가능
const QA_RULES_PATH = path.join(process.cwd(), "tests/harness/qa-rules.json");
const QA_RULES = fs.existsSync(QA_RULES_PATH)
  ? JSON.parse(fs.readFileSync(QA_RULES_PATH, "utf-8"))
  : null;

// qa-rules.json에서 현재 코인 수를 동적으로 읽기
const CURRENT_COIN_COUNT: number = QA_RULES?.coin_count?.current ?? 569;
const STALE_COIN_COUNT: number = QA_RULES?.coin_count?.stale_value ?? 549;

// ── 타입 ──────────────────────────────────────────────────────────────────

type Severity = "critical" | "warning" | "info";

type Issue = {
  type: string;
  severity: Severity;
  description: string;
  evidence?: string;
};

type Improvement = {
  priority: "P0" | "P1" | "P2";
  area: string;
  suggestion: string;
};

type PageAnalysis = {
  page: string;
  viewport: string;
  url: string;
  screenshot: string;
  overall: "pass" | "warning" | "fail";
  issues: Issue[];
  improvements: Improvement[];
  data_integrity_issues: Issue[];
  summary: string;
  analyzed_at: string;
};

type VisionReport = {
  analyzed_at: string;
  base_url: string;
  model: string;
  total_pages: number;
  critical_count: number;
  warning_count: number;
  pass_count: number;
  overall: "pass" | "warning" | "fail";
  pages: PageAnalysis[];
  top_improvements: Improvement[];
  action_required: boolean;
};

// ── 페이지별 분석 컨텍스트 ──────────────────────────────────────────────────

// PAGE_CONTEXT: qa-rules.json의 pages 정의와 동기화 유지 필수
// 수정 시 qa-rules.json pages 섹션도 함께 확인
const PAGE_CONTEXT: Record<string, string> = {
  "home-desktop": `PRUVIQ.com 홈페이지 (데스크탑). 정상 기대: H1 "Test Your Strategy Before You Trade.", '${CURRENT_COIN_COUNT}+' 코인 수 배지, CTA 버튼 2개("Try Simulator Free →", "See Backtest Results"), social proof 섹션. ${STALE_COIN_COUNT} 표시 시 STALE_DATA critical.`,
  "home-mobile": `PRUVIQ.com 홈페이지 (모바일 375px). 정상 기대: h1 가독성, ${CURRENT_COIN_COUNT}+ 코인 수, CTA 버튼 터치 영역 충분, 가로 스크롤 없음, 쿠키 배너가 CTA를 완전히 가리면 MOBILE_BROKEN.`,
  "simulate-desktop": `시뮬레이터 페이지 (데스크탑). 정상 기대: H1에 "${CURRENT_COIN_COUNT}+ Coins" 포함, 시나리오 카드 5개(Breakout/Reversals/Range Trading/Trend Following/Hedging), Quick Test/Standard/Expert 탭. 중요: Run 버튼은 초기 화면에 없음이 정상 — 시나리오 카드 클릭 = 실행 트리거. 결과 없는 초기 상태 = PASS. "Run a backtest to see results." = 정상 초기 상태.`,
  "simulate-mobile": `시뮬레이터 페이지 (모바일 375px). 정상 기대: 시나리오 카드들이 겹치지 않고 터치 가능, 탭 전환 가능, 가로 스크롤 없음. Run 버튼 없음 = 정상(시나리오 카드가 실행 트리거).`,
  "ranking-desktop": `전략 랭킹 페이지 (데스크탑, EN). 정상 기대: H1 "Daily Strategy Ranking", BEST 3 카드(전략명/Win Rate/PF/Trades), WORST 3 카드, 필터 버튼(30 Days/365 Days/7 Days/Top 30/Top 50/Top 100/BTC Only), 날짜 2일 이내. 한국어 텍스트 메인 섹션에 있으면 LANGUAGE_WRONG.`,
  "ranking-mobile": `전략 랭킹 페이지 (모바일, EN). 정상 기대: 랭킹 카드 세로 스택, 전략명/수치 가독성, 필터 버튼 터치 가능, 가로 스크롤 없음.`,
  "ranking-ko-desktop": `전략 랭킹 페이지 (데스크탑, KO). 정상 기대: H1 "오늘의 전략 랭킹", 한국어 레이블(승률 등), 전략명은 영어 유지(MACD Cross 등 — 의도된 설계). SSR div 비어있으면 BLANK_PAGE critical(PR#464 재발).`,
  "ranking-ko-mobile": `전략 랭킹 페이지 (모바일, KO). 정상 기대: 한국어 텍스트 모바일 표시, 가로 스크롤 없음.`,
  "market-desktop": `마켓 대시보드 (데스크탑). 정상 기대: H1 "Market Dashboard", 초기 스켈레톤 허용(동적 데이터), BTC/ETH 가격/Fear & Greed Index. 4초 후에도 완전 공백이면 DATA_MISSING warning.`,
  "coins-desktop": `코인 목록 (데스크탑). 정상 기대: H1 "Browse All Coins", BTC/ETH/SOL 등 코인 카드, 스파크라인 차트(SVG/canvas), 검색창. 코인 목록 없이 완전 공백이면 DATA_MISSING.`,
  "performance-desktop": `성과 페이지 (데스크탑). 정상 기대: H1 "Every Trade Published. Including Losses.", 실제 거래 테이블(코인명/날짜/P&L/SL/TP), 2,898+ 거래 기록. 거래 테이블 없으면 DATA_MISSING.`,
  "strategies-desktop": `전략 목록 (데스크탑). 정상 기대: 전략 카드들(BB Squeeze/RSI Divergence 등), 각 카드에 Win Rate/PF/Trades. 필터(Active/Retired/Under Review). 카드 없으면 DATA_MISSING.`,
  "about-desktop": `소개 페이지 (데스크탑). 정상 기대: H1 존재, 텍스트 렌더링, 내용 완전 표시. 완전 공백이면 BLANK_PAGE critical.`,
  "fees-desktop": `수수료 비교 (데스크탑). 정상 기대: 거래소 수수료 비교 테이블, 실제 % 수치(0.0x%). 완전 공백이면 BLANK_PAGE critical.`,
  // ── EN Desktop 추가 ──────────────────────────────────────────────
  "learn-desktop": `학습 센터(EN). 정상 기대: 아티클 카드 6개+, 난이도 분류(Beginner/Intermediate/Advanced), 카드 클릭 가능. 카드 없으면 DATA_MISSING. 완전 공백이면 BLANK_PAGE critical.`,
  "leaderboard-desktop": `리더보드(EN). 정상 기대: 주간 최고 전략 테이블, 전략명/PF/WR 수치 표시. 테이블 없으면 DATA_MISSING. 완전 공백이면 BLANK_PAGE critical.`,
  "compare-tradingview-desktop": `TradingView 비교(EN). 정상 기대: 기능 비교 테이블, PRUVIQ/TradingView 컬럼. 내용 없으면 BLANK_PAGE critical. 비교 항목이 5개 미만이면 UX_ISSUE.`,
  "api-desktop": `API 문서(EN). 정상 기대: 엔드포인트 목록, 사용법 설명. 완전 비어있으면 BLANK_PAGE critical.`,
  "methodology-desktop": `방법론(EN). 정상 기대: 슬리피지/수수료 가정, survivorship bias 설명 페이지. 텍스트 콘텐츠 있어야 함. 완전 공백이면 BLANK_PAGE critical.`,
  "builder-desktop": `전략 빌더(EN). 정상 기대: 지표 선택, 파라미터 입력, 실행 버튼. 완전 공백이면 BLANK_PAGE critical.`,
  "changelog-desktop": `변경 이력(EN). 정상 기대: 날짜별 업데이트 항목, 최소 3개 이상 항목 존재. 완전 공백이면 BLANK_PAGE critical.`,
  "privacy-desktop": `개인정보 처리방침(EN). 정상 기대: 법적 텍스트, 섹션 구분. 완전 공백이면 BLANK_PAGE critical.`,
  "terms-desktop": `이용약관(EN). 정상 기대: 법적 텍스트, 섹션 구분. 완전 공백이면 BLANK_PAGE critical.`,
  // ── KO Desktop 추가 ──────────────────────────────────────────────
  "home-ko-desktop": `홈(KO). 정상 기대: H1 "실전 전에 전략을 검증하세요.", ${CURRENT_COIN_COUNT}+ 코인 수 배지, CTA 버튼 한국어. 영어 H1이면 LANGUAGE_WRONG critical.`,
  "simulate-ko-desktop": `시뮬레이터(KO). 정상 기대: H1에 "${CURRENT_COIN_COUNT}" 포함, UI 레이블 한국어, 시나리오 카드 존재. 영어만 있으면 LANGUAGE_WRONG.`,
  "leaderboard-ko-desktop": `리더보드(KO). 정상 기대: 한국어 레이블, 랭킹 데이터 테이블. 완전 공백이면 BLANK_PAGE critical.`,
  "market-ko-desktop": `마켓(KO). 정상 기대: 한국어 H1, BTC/ETH 가격 표시, 시장 지표. 완전 공백이면 DATA_MISSING.`,
  "fees-ko-desktop": `수수료 비교(KO). 정상 기대: 한국어 레이블, 거래소 수수료 테이블, % 수치. 완전 공백이면 BLANK_PAGE critical.`,
  "about-ko-desktop": `소개(KO). 정상 기대: H1 한국어, 소개 텍스트. 완전 공백이면 BLANK_PAGE critical.`,
  "learn-ko-desktop": `학습 센터(KO). 정상 기대: 한국어 아티클 카드, 난이도 분류. 완전 공백이면 BLANK_PAGE critical.`,
  // ── Tablet 추가 ──────────────────────────────────────────────────
  "home-tablet": `홈(Tablet 768px). 정상 기대: H1 가독성, ${CURRENT_COIN_COUNT}+ 코인 수, CTA 버튼 겹치지 않음, 레이아웃 적응. 가로 스크롤이면 LAYOUT_BROKEN.`,
  "simulate-tablet": `시뮬레이터(Tablet 768px). 정상 기대: 시나리오 카드 가독성, 입력 필드 겹치지 않음, 가로 스크롤 없음.`,
  "ranking-tablet": `랭킹(Tablet 768px). 정상 기대: 랭킹 카드 가독성, 필터 버튼 터치 가능, 전략명 잘리지 않음.`,
  "leaderboard-tablet": `리더보드(Tablet 768px). 정상 기대: 테이블 가독성, 컬럼 잘리지 않음, 가로 스크롤 최소화.`,
  "fees-tablet": `수수료 비교(Tablet 768px). 정상 기대: 테이블 가독성, 거래소 컬럼 모두 표시, 가로 스크롤 최소화.`,
};

// ── Claude CLI Vision 분석 ──────────────────────────────────────────────────

function analyzeWithClaude(
  screenshotPath: string,
  pageContext: string,
  extractedData: Record<string, unknown>,
): {
  issues: Issue[];
  improvements: Improvement[];
  overall: string;
  summary: string;
} {
  const imageData = fs.readFileSync(screenshotPath);
  const base64 = imageData.toString("base64");

  // QA rules에서 현재 수치 기준을 동적으로 주입 (qa-rules.json 수정 → 프롬프트 자동 반영)
  const rulesSection = QA_RULES
    ? `## 현재 유효 기준 (qa-rules.json 자동 주입)
코인 수: ${CURRENT_COIN_COUNT}+ (${STALE_COIN_COUNT} 표시 = STALE_DATA critical)
데이터 소스: ${QA_RULES.data_sources?.expected} (${QA_RULES.data_sources?.deprecated?.join(", ")} 표시 = warning)
알려진 버그 재발 감시:
${QA_RULES.known_bugs
  ?.filter((b: { recheck: boolean }) => b.recheck)
  .map(
    (b: { id: string; symptom: string; severity: string }) =>
      `  - ${b.id}: ${b.symptom} → ${b.severity}`,
  )
  .join("\n")}

`
    : "";

  const knowledgeSection = QA_KNOWLEDGE
    ? `## PRUVIQ QA 지식 베이스 (판단 기준)\n\n${rulesSection}${QA_KNOWLEDGE}\n\n---\n\n`
    : rulesSection
      ? `## 현재 유효 기준\n\n${rulesSection}\n\n---\n\n`
      : "";

  const prompt = `당신은 PRUVIQ.com의 QA 엔지니어입니다. 이 스크린샷을 실제 사용자 관점에서 분석해주세요.

${knowledgeSection}## 이 페이지 정보
${pageContext}

## 자동 추출된 데이터 (참고용)
\`\`\`json
${JSON.stringify(extractedData, null, 2)}
\`\`\`

## 반드시 체크할 항목
1. **BLANK_PAGE**: 본문 영역이 비어있거나 스켈레톤/로딩 상태인가?
2. **DATA_MISSING**: 숫자/전략이름/차트가 보여야 하는데 없는가?
3. **LAYOUT_BROKEN**: 텍스트 겹침, 요소가 viewport 밖, 그리드 깨짐
4. **LANGUAGE_WRONG**: 영어 페이지에 한국어, 또는 한국어 페이지에 영어 (의도치 않은 것)
5. **STALE_DATA**: "549" 코인 수 표시 (현재 569+이어야 함)
6. **COMPONENT_CRASH**: "undefined", "NaN", "Error", "Failed to load" 등 에러 상태
7. **CHART_EMPTY**: 차트 영역은 있는데 데이터 선/바가 없음
8. **MOBILE_BROKEN**: 모바일에서 텍스트 잘림, 버튼 겹침, 가로 스크롤 (모바일 페이지만)
9. **UX_ISSUE**: 사용자가 혼란스러울 수 있는 UI 문제

## 개선 제안 항목
- UX/UI 개선점, 데이터 표시 방식, 모바일 최적화, SEO 기회

## 응답 형식 (JSON만, 다른 텍스트 없이)

{
  "overall": "pass|warning|fail",
  "summary": "한 문장 요약",
  "issues": [
    {
      "type": "BLANK_PAGE|DATA_MISSING|LAYOUT_BROKEN|LANGUAGE_WRONG|STALE_DATA|COMPONENT_CRASH|CHART_EMPTY|MOBILE_BROKEN|UX_ISSUE",
      "severity": "critical|warning|info",
      "description": "구체적으로 스크린샷에서 무엇이 보이는지",
      "evidence": "실제로 보이는 텍스트나 요소"
    }
  ],
  "improvements": [
    {
      "priority": "P0|P1|P2",
      "area": "개선 영역",
      "suggestion": "구체적인 개선 제안"
    }
  ]
}`;

  const payload = JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: base64 },
        },
        { type: "text", text: prompt },
      ],
    },
  });

  const result = spawnSync(
    "claude",
    [
      "--print",
      "--model",
      CLAUDE_MODEL,
      "--input-format",
      "stream-json",
      "--output-format",
      "stream-json",
      "--verbose",
    ],
    {
      input: payload,
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
      timeout: 60000,
    },
  );

  if (result.error || result.status !== 0) {
    throw new Error(
      `Claude CLI failed: ${result.stderr?.slice(0, 500) ?? result.error}`,
    );
  }

  // stream-json 응답에서 assistant 메시지 추출
  let responseText = "";
  for (const line of (result.stdout ?? "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const d = JSON.parse(trimmed);
      if (d.type === "assistant") {
        for (const c of d.message?.content ?? []) {
          if (c.type === "text") responseText += c.text;
        }
      }
    } catch {
      // skip
    }
  }

  const jsonMatch =
    responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
    responseText.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {
      /* fall through */
    }
  }

  return {
    issues: [],
    improvements: [],
    overall: "pass",
    summary: responseText.slice(0, 200),
  };
}

// ── 데이터 정합성 검증 ────────────────────────────────────────────────────

function checkDataIntegrity(
  pageData: Record<string, unknown>,
  dataIntegrity: Record<string, unknown>,
): Issue[] {
  const issues: Issue[] = [];

  const apiCount = dataIntegrity.coin_count_api as number | undefined;
  const rendered = dataIntegrity.coin_count_rendered as string | undefined;
  if (apiCount && rendered && rendered !== "not found") {
    const renderedNum = parseInt(rendered.replace(/\D/g, ""));
    if (!isNaN(renderedNum) && Math.abs(renderedNum - apiCount) > 20) {
      issues.push({
        type: "DATA_INTEGRITY",
        severity: "warning",
        description: `코인 수 불일치: API=${apiCount}, 화면표시="${rendered}"`,
        evidence: `API: ${apiCount}개, 렌더링: "${rendered}"`,
      });
    }
  }

  if (pageData.has_stale_549) {
    issues.push({
      type: "STALE_DATA",
      severity: "critical",
      description: `화면에 구버전 코인 수 '${STALE_COIN_COUNT}'가 표시됨 (현재 ${CURRENT_COIN_COUNT}+이어야 함)`,
      evidence: `has_stale_${STALE_COIN_COUNT} = true`,
    });
  }

  if (dataIntegrity.rendered_matches_api === false) {
    issues.push({
      type: "DATA_INTEGRITY",
      severity: "warning",
      description: `랭킹 데이터 불일치: API 1위="${dataIntegrity.api_top1_strategy}", 화면 불일치`,
      evidence: `API: ${dataIntegrity.api_top1_strategy}`,
    });
  }

  if (
    pageData.has_ranking_ssr_fallback === true &&
    pageData.ranking_ssr_has_data === false
  ) {
    issues.push({
      type: "BLANK_PAGE",
      severity: "critical",
      description:
        "랭킹 SSR fallback div 존재하지만 데이터 없음 (크롤러에 빈 화면 노출)",
      evidence: "has_ranking_ssr_fallback=true, ranking_ssr_has_data=false",
    });
  }

  const jsErrors = pageData.js_errors as string[] | undefined;
  if (jsErrors && jsErrors.length > 0) {
    issues.push({
      type: "COMPONENT_CRASH",
      severity: "critical",
      description: `JS 에러 ${jsErrors.length}개 감지: ${jsErrors[0]}`,
      evidence: jsErrors.slice(0, 3).join(" | "),
    });
  }

  return issues;
}

// ── 메인 ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n═══ PRUVIQ Vision QA Analyzer (Claude CLI) ═══\n");

  try {
    execSync("which claude", { stdio: "pipe" });
  } catch {
    console.error("claude CLI not found.");
    process.exit(1);
  }

  const collectPath = path.join(VISION_DIR, "collect-data.json");
  if (!fs.existsSync(collectPath)) {
    console.error(`collect-data.json not found: ${collectPath}`);
    process.exit(1);
  }

  const collectData = JSON.parse(fs.readFileSync(collectPath, "utf-8"));
  const pages = collectData.pages as Record<string, unknown>[];

  console.log(`Pages to analyze: ${pages.length}`);
  console.log(`Model: ${CLAUDE_MODEL}`);
  console.log(`Vision dir: ${VISION_DIR}\n`);

  const pageResults: PageAnalysis[] = [];
  let criticalCount = 0,
    warningCount = 0,
    passCount = 0;

  for (const page of pages) {
    const name = (page.screenshot as string).replace(".png", "");
    const atfPath = path.join(VISION_DIR, `${name}-atf.png`);
    const screenshotPath = path.join(VISION_DIR, page.screenshot as string);
    const analysisScreenshot = fs.existsSync(atfPath)
      ? atfPath
      : screenshotPath;
    const pageCtx = PAGE_CONTEXT[name] ?? `Page: ${page.url}`;

    process.stdout.write(`  [${name}] `);

    const integrityIssues = checkDataIntegrity(
      page.page_data as Record<string, unknown>,
      page.data_integrity as Record<string, unknown>,
    );

    let visionIssues: Issue[] = [],
      visionImprovements: Improvement[] = [];
    let overall = "pass",
      summary = "";

    if (fs.existsSync(analysisScreenshot)) {
      try {
        const result = analyzeWithClaude(analysisScreenshot, pageCtx, {
          url: page.url,
          viewport: page.viewport,
          page_data: page.page_data,
          data_integrity: page.data_integrity,
        });
        visionIssues = result.issues ?? [];
        visionImprovements = result.improvements ?? [];
        overall = result.overall ?? "pass";
        summary = result.summary ?? "";
      } catch (e) {
        summary = `Vision failed: ${e}`;
      }
    } else {
      summary = "Screenshot not found";
    }

    const allIssues = [...visionIssues, ...integrityIssues];
    const hasCritical = allIssues.some((i) => i.severity === "critical");
    const hasWarning = allIssues.some((i) => i.severity === "warning");

    if (hasCritical || overall === "fail") {
      overall = "fail";
      criticalCount++;
    } else if (hasWarning || overall === "warning") {
      overall = "warning";
      warningCount++;
    } else {
      overall = "pass";
      passCount++;
    }

    const icon =
      overall === "fail" ? "❌" : overall === "warning" ? "⚠️ " : "✅";
    console.log(
      `${icon} ${overall.toUpperCase()} (${allIssues.length} issues)`,
    );
    for (const issue of allIssues) {
      const sev =
        issue.severity === "critical"
          ? "🔴"
          : issue.severity === "warning"
            ? "🟡"
            : "🔵";
      console.log(`      ${sev} [${issue.type}] ${issue.description}`);
    }
    if (summary) console.log(`      → ${summary}`);

    pageResults.push({
      page: name,
      viewport: page.viewport as string,
      url: page.url as string,
      screenshot: page.screenshot as string,
      overall: overall as "pass" | "warning" | "fail",
      issues: visionIssues,
      improvements: visionImprovements,
      data_integrity_issues: integrityIssues,
      summary,
      analyzed_at: new Date().toISOString(),
    });
  }

  const topImprovements = pageResults
    .flatMap((p) => p.improvements)
    .sort((a, b) => a.priority.localeCompare(b.priority))
    .slice(0, 10);

  const overallStatus: "pass" | "warning" | "fail" =
    criticalCount > 0 ? "fail" : warningCount > 0 ? "warning" : "pass";

  const report: VisionReport = {
    analyzed_at: new Date().toISOString(),
    base_url: collectData.base_url,
    model: CLAUDE_MODEL,
    total_pages: pageResults.length,
    critical_count: criticalCount,
    warning_count: warningCount,
    pass_count: passCount,
    overall: overallStatus,
    pages: pageResults,
    top_improvements: topImprovements,
    action_required: criticalCount > 0,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log("\n═══ SUMMARY ═══");
  console.log(`Overall: ${overallStatus.toUpperCase()}`);
  console.log(
    `Pages: ${passCount} pass / ${warningCount} warning / ${criticalCount} fail`,
  );
  console.log(`Report: ${REPORT_PATH}`);

  if (topImprovements.length > 0) {
    console.log("\nTop Improvements:");
    for (const imp of topImprovements.slice(0, 5)) {
      console.log(`  [${imp.priority}] ${imp.area}: ${imp.suggestion}`);
    }
  }

  if (overallStatus === "fail") process.exit(1);
}

main().catch((e) => {
  console.error("Vision analyze error:", e);
  process.exit(1);
});
