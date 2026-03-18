#!/usr/bin/env npx tsx
/**
 * Vision QA: Report Generator
 *
 * vision-report.json을 읽어서:
 * 1. GitHub issue 자동 생성 (critical/warning 발견 시)
 * 2. Telegram 알림 전송
 * 3. 개선 제안 요약
 *
 * Usage:
 *   GITHUB_TOKEN=... TELEGRAM_TOKEN=... TELEGRAM_CHAT_ID=... npx tsx scripts/vision-report.ts
 */

import fs from "fs";
import path from "path";

const VISION_DIR = process.env.VISION_DIR ?? "test-results/vision";
const REPORT_PATH = path.join(VISION_DIR, "vision-report.json");

const GITHUB_TOKEN = process.env.PRUVIQ_GH_TOKEN ?? process.env.GITHUB_TOKEN;
const TELEGRAM_TOKEN = process.env.PRUVIQ_TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.PRUVIQ_TELEGRAM_CHAT_ID;
const GITHUB_REPO = process.env.GITHUB_REPOSITORY ?? "pruviq/pruviq";
const RUN_URL = process.env.RUN_URL ?? "";

type Issue = {
  type: string;
  severity: string;
  description: string;
  evidence?: string;
};

type PageAnalysis = {
  page: string;
  viewport: string;
  url: string;
  screenshot: string;
  overall: string;
  issues: Issue[];
  improvements: { priority: string; area: string; suggestion: string }[];
  data_integrity_issues: Issue[];
  summary: string;
};

type VisionReport = {
  analyzed_at: string;
  base_url: string;
  model: string;
  total_pages: number;
  critical_count: number;
  warning_count: number;
  pass_count: number;
  overall: string;
  pages: PageAnalysis[];
  top_improvements: { priority: string; area: string; suggestion: string }[];
  action_required: boolean;
};

async function sendTelegram(msg: string) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: msg,
        parse_mode: "HTML",
      }),
    });
  } catch (e) {
    console.error("Telegram send failed:", e);
  }
}

async function createGitHubIssue(title: string, body: string) {
  if (!GITHUB_TOKEN) {
    console.log("GITHUB_TOKEN not set — skipping issue creation");
    return null;
  }
  const [owner, repo] = GITHUB_REPO.split("/");
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body,
        labels: ["vision-qa", "claude-auto"],
      }),
    },
  );
  if (res.ok) {
    const data = (await res.json()) as { html_url: string; number: number };
    return data;
  }
  return null;
}

async function main() {
  if (!fs.existsSync(REPORT_PATH)) {
    console.error(`Report not found: ${REPORT_PATH}`);
    process.exit(1);
  }

  const report: VisionReport = JSON.parse(
    fs.readFileSync(REPORT_PATH, "utf-8"),
  );

  const failedPages = report.pages.filter((p) => p.overall === "fail");
  const warningPages = report.pages.filter((p) => p.overall === "warning");
  const allIssues = report.pages.flatMap((p) => [
    ...p.issues,
    ...p.data_integrity_issues,
  ]);
  const criticalIssues = allIssues.filter((i) => i.severity === "critical");

  console.log(`\nVision QA Report: ${report.overall.toUpperCase()}`);
  console.log(
    `  ${report.pass_count} pass / ${report.warning_count} warning / ${report.critical_count} fail`,
  );

  // ── Telegram 알림 ──────────────────────────────────────────────────────

  if (report.overall === "fail") {
    const issueLines = criticalIssues
      .slice(0, 5)
      .map((i) => `• [${i.type}] ${i.description}`)
      .join("\n");

    const msg =
      `🚨 <b>PRUVIQ Vision QA FAIL</b>\n\n` +
      `사이트: ${report.base_url}\n` +
      `분석: ${report.total_pages}페이지 | 🔴 ${report.critical_count} critical\n\n` +
      `<b>Critical 이슈:</b>\n${issueLines}\n\n` +
      (RUN_URL ? `Log: ${RUN_URL}` : "");
    await sendTelegram(msg);
  } else if (report.overall === "warning") {
    const msg =
      `⚠️ <b>PRUVIQ Vision QA WARNING</b>\n\n` +
      `${report.total_pages}페이지 분석 | 🟡 ${report.warning_count} warning\n` +
      (RUN_URL ? `Log: ${RUN_URL}` : "");
    await sendTelegram(msg);
  } else {
    const topImp = report.top_improvements.slice(0, 3);
    const impLines = topImp
      .map((i) => `• [${i.priority}] ${i.area}: ${i.suggestion}`)
      .join("\n");

    const msg =
      `✅ <b>PRUVIQ Vision QA PASS</b>\n\n` +
      `${report.total_pages}페이지 전체 정상\n\n` +
      (impLines ? `<b>개선 제안:</b>\n${impLines}` : "개선 제안 없음");
    await sendTelegram(msg);
  }

  // ── GitHub Issue 생성 (Critical 있을 때) ───────────────────────────────

  if (criticalIssues.length > 0 && GITHUB_TOKEN) {
    const issueRows = failedPages
      .map((p) => {
        const issues = [...p.issues, ...p.data_integrity_issues].filter(
          (i) => i.severity === "critical",
        );
        const rows = issues
          .map(
            (i) => `| \`${i.type}\` | ${i.description} | ${i.evidence ?? ""} |`,
          )
          .join("\n");
        return `### ${p.page} (${p.viewport})\n> ${p.summary}\n\n| Type | Description | Evidence |\n|------|-------------|----------|\n${rows}`;
      })
      .join("\n\n");

    const impRows = report.top_improvements
      .slice(0, 8)
      .map((i) => `| ${i.priority} | ${i.area} | ${i.suggestion} |`)
      .join("\n");

    const body = [
      `## Vision QA Failure Report`,
      ``,
      `**Date:** ${new Date(report.analyzed_at).toLocaleString("ko-KR")}`,
      `**Site:** ${report.base_url}`,
      `**Model:** ${report.model}`,
      `**Result:** 🔴 ${report.critical_count} critical / 🟡 ${report.warning_count} warning / ✅ ${report.pass_count} pass`,
      RUN_URL ? `**Run:** ${RUN_URL}` : "",
      ``,
      `## Critical Issues`,
      ``,
      issueRows,
      ``,
      `## Top Improvements`,
      ``,
      `| Priority | Area | Suggestion |`,
      `|----------|------|------------|`,
      impRows,
      ``,
      `## Reproduce`,
      `\`\`\`bash`,
      `BASE_URL=https://pruviq.com npx playwright test tests/e2e/vision-collect.spec.ts --project prod-smoke`,
      `ANTHROPIC_API_KEY=... npx tsx scripts/vision-analyze.ts`,
      `\`\`\``,
      ``,
      `> 스크린샷은 CI 아티팩트 \`vision-qa-screenshots\` 에서 확인 가능`,
    ]
      .filter((l) => l !== null)
      .join("\n");

    const issue = await createGitHubIssue(
      `[vision-qa] ${report.critical_count} critical issues on pruviq.com`,
      body,
    );
    if (issue) {
      console.log(`GitHub issue created: #${issue.number} ${issue.html_url}`);
    }
  }

  // ── 개선 제안 출력 ──────────────────────────────────────────────────────

  if (report.top_improvements.length > 0) {
    console.log("\nTop Improvements (for next sprint):");
    for (const imp of report.top_improvements.slice(0, 8)) {
      console.log(`  [${imp.priority}] ${imp.area}: ${imp.suggestion}`);
    }
  }

  if (report.overall === "fail") {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Report error:", e);
  process.exit(1);
});
