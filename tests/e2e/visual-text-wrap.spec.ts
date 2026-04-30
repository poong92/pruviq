import { test, expect, type Page } from "@playwright/test";

/**
 * Sprint 4 — 디자인 만점 평가 검증 우선순위 1: "쓸데없는 줄바꿈" 회귀 차단.
 *
 * 사용자 피드백 (2026-04-29):
 * "한국어/영문 글자수 차이로 줄바꿈 어색함" — 자동 회귀 가드.
 *
 * 검사 대상: hero 영역의 CTA 버튼 (.btn-primary, .btn-ghost) 텍스트가
 * 2줄 이상 wrap되면 fail. CTA는 한 줄에 들어가야 시각적 강조 유지.
 *
 * Selector: hero section 안의 .btn-primary / .btn-ghost (보조 CTA 포함).
 * 측정: offsetHeight vs computed line-height. 1.7 임계 (line-height 1.5 * 1.13 여유).
 */

const PAGES = ["/", "/ko/"];

async function checkButtonWrap(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  const failures = await page.$$eval(
    'section[id="hero-section"] a.btn, section[id="hero-section"] a.btn-primary, section[id="hero-section"] a.btn-ghost',
    (els: HTMLElement[]) => {
      const fails: { text: string; lines: number; lineHeight: number }[] = [];
      for (const el of els) {
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight);
        const pT = parseFloat(cs.paddingTop) || 0;
        const pB = parseFloat(cs.paddingBottom) || 0;
        const bT = parseFloat(cs.borderTopWidth) || 0;
        const bB = parseFloat(cs.borderBottomWidth) || 0;
        // 정밀 측정: 텍스트 영역 = offsetHeight - padding - border. lines = textHeight / lineHeight.
        const textHeight = el.offsetHeight - pT - pB - bT - bB;
        const lines = lh > 0 ? Math.round(textHeight / lh) : 1;
        if (lines > 1) {
          fails.push({
            text: (el.textContent || "").trim().slice(0, 40),
            lines,
            lineHeight: Math.round(lh),
          });
        }
      }
      return fails;
    },
  );

  if (failures.length > 0) {
    const msg = failures
      .map(
        (f) =>
          `  - "${f.text}" → ${f.lines} lines (lineHeight ${f.lineHeight}px)`,
      )
      .join("\n");
    throw new Error(
      `${path}: ${failures.length} hero CTA button(s) wrapped to multiple lines:\n${msg}`,
    );
  }
}

for (const path of PAGES) {
  test(`hero CTA single-line — ${path}`, async ({ page }) => {
    await checkButtonWrap(page, path);
  });
}
