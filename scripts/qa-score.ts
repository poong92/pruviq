#!/usr/bin/env npx tsx
/**
 * QA Score Calculator — 전체 하네스 결과를 종합해 점수(0-10) 산출
 *
 * 읽는 파일:
 *   test-results/harness/golden-result.json  (run-golden.ts 출력)
 *   test-results/vision/vision-report.json   (vision-analyze.ts 출력)
 *
 * 출력:
 *   test-results/qa-score.json  (CI artifact, 트렌드 추적용)
 *   stdout: 점수 요약
 *
 * Usage:
 *   npx tsx scripts/qa-score.ts
 */

import fs from "fs";
import path from "path";

const GOLDEN_RESULT = "test-results/harness/golden-result.json";
const VISION_REPORT = "test-results/vision/vision-report.json";
const SCORE_OUTPUT = "test-results/qa-score.json";
const SCORE_HISTORY = "test-results/qa-score-history.jsonl";

// ── 점수 가중치 ────────────────────────────────────────────────────────────
// 총 10점 기준
const WEIGHTS = {
  golden: 4.0, // API 계산 정확성 — 가장 중요
  vision: 3.0, // 시각적 QA
  smoke: 3.0, // 배포 smoke (golden-result에 포함)
};

// ── 타입 ──────────────────────────────────────────────────────────────────

type GoldenResult = {
  ran_at: string;
  total_cases: number;
  passed: number;
  failed: number;
  total_failures: number;
  overall: "pass" | "fail";
};

type VisionReport = {
  analyzed_at: string;
  total_pages: number;
  critical_count: number;
  warning_count: number;
  pass_count: number;
  overall: "pass" | "warning" | "fail";
};

type QAScore = {
  scored_at: string;
  total_score: number;
  max_score: number;
  grade: string;
  components: {
    golden: { score: number; max: number; detail: string };
    vision: { score: number; max: number; detail: string };
  };
  overall: "pass" | "warning" | "fail";
  summary: string;
};

// ── 점수 계산 ─────────────────────────────────────────────────────────────

function calcGoldenScore(result: GoldenResult | null): {
  score: number;
  max: number;
  detail: string;
} {
  const max = WEIGHTS.golden;
  if (!result) return { score: 0, max, detail: "golden-result.json 없음" };

  if (result.overall === "pass") {
    return {
      score: max,
      max,
      detail: `${result.passed}/${result.total_cases} 케이스 통과`,
    };
  }

  // 부분 점수: 실패 케이스당 -0.5점 (최소 0)
  const deduction = Math.min(result.failed * 0.5, max);
  return {
    score: Math.max(0, max - deduction),
    max,
    detail: `${result.passed}/${result.total_cases} 통과, ${result.failed} 실패 (-${deduction.toFixed(1)}점)`,
  };
}

function calcVisionScore(report: VisionReport | null): {
  score: number;
  max: number;
  detail: string;
} {
  const max = WEIGHTS.vision + WEIGHTS.smoke; // 6점
  if (!report)
    return {
      score: max * 0.5,
      max,
      detail: "vision-report.json 없음 (기본점 부여)",
    };

  if (report.overall === "pass") {
    return {
      score: max,
      max,
      detail: `${report.pass_count}/${report.total_pages} 페이지 PASS`,
    };
  }

  // critical 하나당 -0.8점, warning 하나당 -0.2점
  const critDeduction = Math.min(report.critical_count * 0.8, max * 0.8);
  const warnDeduction = Math.min(report.warning_count * 0.2, max * 0.2);
  const score = Math.max(0, max - critDeduction - warnDeduction);
  return {
    score,
    max,
    detail: `🔴 ${report.critical_count} critical (-${critDeduction.toFixed(1)}), 🟡 ${report.warning_count} warning (-${warnDeduction.toFixed(1)})`,
  };
}

function grade(score: number): string {
  if (score >= 9.5) return "S";
  if (score >= 9.0) return "A+";
  if (score >= 8.0) return "A";
  if (score >= 7.0) return "B+";
  if (score >= 6.0) return "B";
  if (score >= 5.0) return "C";
  return "F";
}

// ── 메인 ──────────────────────────────────────────────────────────────────

function main() {
  const goldenRaw = fs.existsSync(GOLDEN_RESULT)
    ? (JSON.parse(fs.readFileSync(GOLDEN_RESULT, "utf-8")) as GoldenResult)
    : null;
  const visionRaw = fs.existsSync(VISION_REPORT)
    ? (JSON.parse(fs.readFileSync(VISION_REPORT, "utf-8")) as VisionReport)
    : null;

  const goldenComp = calcGoldenScore(goldenRaw);
  const visionComp = calcVisionScore(visionRaw);

  const totalScore = parseFloat(
    (goldenComp.score + visionComp.score).toFixed(2),
  );
  const maxScore = goldenComp.max + visionComp.max;
  const g = grade(totalScore);

  const overall: "pass" | "warning" | "fail" =
    totalScore >= 7.0 ? "pass" : totalScore >= 5.0 ? "warning" : "fail";

  const qaScore: QAScore = {
    scored_at: new Date().toISOString(),
    total_score: totalScore,
    max_score: maxScore,
    grade: g,
    components: {
      golden: goldenComp,
      vision: visionComp,
    },
    overall,
    summary: `QA Score ${totalScore}/${maxScore} (Grade ${g}) — Golden: ${goldenComp.score.toFixed(1)}/${goldenComp.max}, Vision: ${visionComp.score.toFixed(1)}/${visionComp.max}`,
  };

  // 출력 저장
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync(SCORE_OUTPUT, JSON.stringify(qaScore, null, 2));

  // 히스토리 추가 (JSONL)
  const historyLine = JSON.stringify({
    scored_at: qaScore.scored_at,
    total_score: qaScore.total_score,
    grade: qaScore.grade,
    overall: qaScore.overall,
  });
  fs.appendFileSync(SCORE_HISTORY, historyLine + "\n");

  // 콘솔 출력
  console.log("\n═══ PRUVIQ QA Score ═══");
  console.log(
    `Score: ${totalScore}/${maxScore}  Grade: ${g}  Overall: ${overall.toUpperCase()}`,
  );
  console.log(
    `  Golden: ${goldenComp.score.toFixed(1)}/${goldenComp.max}  → ${goldenComp.detail}`,
  );
  console.log(
    `  Vision: ${visionComp.score.toFixed(1)}/${visionComp.max}  → ${visionComp.detail}`,
  );
  console.log(`Saved: ${SCORE_OUTPUT}`);

  if (overall === "fail") {
    process.exit(1);
  }
}

main();
