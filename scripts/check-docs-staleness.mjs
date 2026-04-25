#!/usr/bin/env node
// Docs staleness checker — 60일 초과 + archive/ 밖 = warn, 180일 초과 = error.
//
// 매 .md 파일의 마지막 수정 시각을 `git log -1 --format=%ct` 로 조회.
// frontmatter `last-modified` 필드가 있으면 그 값 우선.
//
// Usage:
//   node scripts/check-docs-staleness.mjs            # 전체 출력
//   node scripts/check-docs-staleness.mjs --strict   # error도 종료 코드 1
//
// Output: NDJSON per file → { path, age_days, status: ok|warn|error }

import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import process from "node:process";

const ROOT = resolve(process.cwd());
const STRICT = process.argv.includes("--strict");
const WARN_DAYS = 60;
const ERROR_DAYS = 180;

function findMdFiles() {
  // git ls-files: tracked .md files only
  const out = execSync(
    "git ls-files '*.md' ':!docs/archive/**' ':!.claude/**' ':!playwright-report/**' ':!node_modules/**'",
    { encoding: "utf-8", cwd: ROOT },
  );
  return out
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => resolve(ROOT, l));
}

function lastModified(file) {
  // frontmatter last-modified 우선
  try {
    const head = readFileSync(file, "utf-8").slice(0, 1024);
    const m = head.match(/^last-modified:\s*"?(\d{4}-\d{2}-\d{2})/m);
    if (m) return new Date(m[1] + "T00:00:00Z").getTime() / 1000;
  } catch {}
  // git log fallback
  try {
    const ct = execSync(`git log -1 --format=%ct -- "${file}"`, {
      encoding: "utf-8",
      cwd: ROOT,
    }).trim();
    if (ct) return Number(ct);
  } catch {}
  // mtime fallback
  return statSync(file).mtimeMs / 1000;
}

function main() {
  const files = findMdFiles();
  const now = Date.now() / 1000;
  let warns = 0;
  let errors = 0;

  for (const file of files) {
    const ts = lastModified(file);
    const ageDays = Math.floor((now - ts) / 86400);
    let status = "ok";
    if (ageDays > ERROR_DAYS) {
      status = "error";
      errors++;
    } else if (ageDays > WARN_DAYS) {
      status = "warn";
      warns++;
    }
    process.stdout.write(
      JSON.stringify({
        path: relative(ROOT, file),
        age_days: ageDays,
        status,
      }) + "\n",
    );
  }

  process.stderr.write(
    `\nSummary: ${files.length} files. warn=${warns} (>60d) error=${errors} (>180d)\n`,
  );

  if (STRICT && errors > 0) process.exit(1);
}

main();
