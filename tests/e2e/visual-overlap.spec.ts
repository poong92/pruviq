import { test, type Page } from "@playwright/test";

/**
 * Sprint 4 — 디자인 만점 평가 검증 우선순위 5: "영역 겹침" 회귀 차단.
 *
 * 사용자 피드백 (2026-04-29):
 * "영역 겹치거나 마진 안 맞거나" — 자동 회귀 가드.
 *
 * 검사: hero CTA 버튼이 sticky/fixed element (bottom-cta-bar 등)에 의해
 * 클릭 영역이 가려지지 않는지 확인.
 *
 * 측정: elementsFromPoint(buttonCenter)에서 우리 button이 stack 최상단(또는 자식 포함)에
 * 있으면 OK. 다른 element가 우리 button을 가리면 fail.
 *
 * 페이지: / + /ko/ (hero CTA 핵심).
 */

const PAGES = ["/", "/ko/"];

async function checkOverlap(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200); // hydration + sticky bar transition

  const overlapped = await page.$$eval(
    'section[id="hero-section"] a.btn-primary',
    (els: HTMLElement[]) => {
      const fails: { text: string; coveredBy: string }[] = [];
      for (const el of els) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        // viewport 안에 있어야 측정 가능
        if (cy < 0 || cy > window.innerHeight) continue;

        const stack = document.elementsFromPoint(cx, cy) as HTMLElement[];
        if (!stack.length) continue;
        const top = stack[0];
        // 우리 button(또는 자식/조상)이 stack 최상단이면 OK
        const isSelfOrRelated =
          top === el || el.contains(top) || top.contains(el);
        if (!isSelfOrRelated) {
          fails.push({
            text: (el.textContent || "").trim().slice(0, 30),
            coveredBy: `<${top.tagName.toLowerCase()}${top.id ? "#" + top.id : ""}>`,
          });
        }
      }
      return fails;
    },
  );

  if (overlapped.length > 0) {
    const msg = overlapped
      .map((f) => `  - "${f.text}" covered by ${f.coveredBy}`)
      .join("\n");
    throw new Error(
      `${path}: ${overlapped.length} hero CTA(s) overlapped by sticky/fixed:\n${msg}`,
    );
  }
}

for (const path of PAGES) {
  test(`hero CTA not overlapped — ${path}`, async ({ page }) => {
    await checkOverlap(page, path);
  });
}
