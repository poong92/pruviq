// Expert Builder — visual + UX + a11y deep audit (prod-only).

import AxeBuilder from "@axe-core/playwright";
import { test } from "@playwright/test";
import * as fs from "fs";

const BASE = process.env.BASE_URL || "http://localhost:4321";
const IS_PROD_LIKE = /pruviq\.com/.test(BASE);
test.skip(!IS_PROD_LIKE, "prod-only");

const SCREENSHOT_DIR = "/tmp/builder-audit";
if (!fs.existsSync(SCREENSHOT_DIR))
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

test.describe("Builder visual audit", () => {
  test("A. screenshots: cold EN + cold KO + deep-link + mobile", async ({
    browser,
  }) => {
    const desktop = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const mobile = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });

    const paths = [
      {
        ctx: desktop,
        vp: "desktop",
        path: "/simulate/builder/",
        name: "01_cold_en_desktop",
      },
      {
        ctx: desktop,
        vp: "desktop",
        path: "/ko/simulate/builder/",
        name: "02_cold_ko_desktop",
      },
      {
        ctx: desktop,
        vp: "desktop",
        path: "/simulate/builder/?preset=atr-breakout&dir=short&sl=3&tp=7&coins=20",
        name: "03_deeplink_desktop",
      },
      {
        ctx: mobile,
        vp: "mobile",
        path: "/simulate/builder/",
        name: "04_cold_en_mobile",
      },
      {
        ctx: mobile,
        vp: "mobile",
        path: "/simulate/builder/?preset=atr-breakout&dir=short&sl=3&tp=7&coins=20",
        name: "05_deeplink_mobile",
      },
    ];
    for (const s of paths) {
      const page = await s.ctx.newPage();
      await page.goto(s.path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3500);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/${s.name}.png`,
        fullPage: true,
      });
      console.log(`[screenshot] ${s.name} saved`);
    }
    await desktop.close();
    await mobile.close();
  });

  test("B. axe a11y on builder EN + KO", async ({ page }) => {
    for (const p of ["/simulate/builder/", "/ko/simulate/builder/"]) {
      await page.goto(p, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
      const r = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const crit = r.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      const mod = r.violations.filter(
        (v) => v.impact === "moderate" || v.impact === "minor",
      );
      console.log(
        `[${p}] critical+serious: ${crit.length}, moderate+minor: ${mod.length}`,
      );
      for (const v of r.violations) {
        console.log(
          ` ${v.impact?.toUpperCase()} ${v.id} × ${v.nodes.length} — ${v.description}`,
        );
      }
    }
  });

  test("C. visual-hierarchy + tap-targets (desktop deep-link)", async ({
    page,
  }) => {
    await page.goto(
      "/simulate/builder/?preset=atr-breakout&dir=short&sl=3&tp=7&coins=20",
    );
    await page.waitForTimeout(3500);
    const info = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      const hs = Array.from(document.querySelectorAll("h1,h2,h3,h4")).map(
        (h) => ({
          tag: h.tagName,
          text: (h as HTMLElement).innerText.slice(0, 60),
        }),
      );
      const btns = Array.from(document.querySelectorAll("button"))
        .map((b) => {
          const r = (b as HTMLElement).getBoundingClientRect();
          return {
            text: (b as HTMLElement).innerText.trim().slice(0, 30),
            w: Math.round(r.width),
            h: Math.round(r.height),
            disabled: (b as HTMLButtonElement).disabled,
          };
        })
        .filter((b) => b.text && b.w > 0);
      // 2026-04-23: WCAG 2.2 AA target size is 24×24 CSS px (SC 2.5.8).
      // 44×44 is AAA (SC 2.5.5 Enhanced). Align audit to AA so "compliant"
      // reflects spec. Tracked separately for AAA interest.
      const smallTargets = btns.filter((b) => b.w < 24 || b.h < 24);
      const aaaTargets = btns.filter((b) => b.w < 44 || b.h < 44);
      const inputs = Array.from(document.querySelectorAll("input,select")).map(
        (i) => {
          const r = (i as HTMLElement).getBoundingClientRect();
          return {
            type: (i as HTMLInputElement).type || i.tagName,
            w: Math.round(r.width),
            h: Math.round(r.height),
          };
        },
      );
      return {
        h1_text: h1?.textContent?.trim(),
        heading_count: hs.length,
        heading_map: hs.slice(0, 12),
        total_buttons: btns.length,
        small_targets: smallTargets.length,
        small_samples: smallTargets.slice(0, 8),
        aaa_small_targets: aaaTargets.length,
        total_inputs: inputs.length,
        narrow_inputs: inputs.filter((i) => i.w < 24 || i.h < 24).length,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        scrollHeight: document.documentElement.scrollHeight,
      };
    });
    console.log(
      "[desktop deep-link visual]",
      JSON.stringify(info, null, 2).slice(0, 2500),
    );
  });

  test("D. color contrast probe (buttons + labels)", async ({ page }) => {
    await page.goto(
      "/simulate/builder/?preset=atr-breakout&dir=short&sl=3&tp=7&coins=20",
    );
    await page.waitForTimeout(3000);
    const cs = await page.evaluate(() => {
      const rgb = (s: string) => {
        const m = s.match(/\d+(\.\d+)?/g);
        return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
      };
      const lum = (c: number) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      const rel = (r: number[]) =>
        0.2126 * lum(r[0]) + 0.7152 * lum(r[1]) + 0.0722 * lum(r[2]);
      const ratio = (fg: number[], bg: number[]) => {
        const L1 = rel(fg),
          L2 = rel(bg);
        const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
        return (hi + 0.05) / (lo + 0.05);
      };
      const targets = Array.from(
        document.querySelectorAll(
          "button, label, .step-badge, [data-testid^=dir-]",
        ),
      );
      const low: {
        el: string;
        fg: string;
        bg: string;
        ratio: number;
        text?: string;
      }[] = [];
      for (const el of targets.slice(0, 60)) {
        const s = getComputedStyle(el);
        const fg = rgb(s.color);
        // climb parents for opaque bg
        let bgEl: HTMLElement | null = el as HTMLElement;
        let bgStr = s.backgroundColor;
        while (bgEl && (!bgStr || /rgba\(.*, 0\)/.test(bgStr))) {
          bgEl = bgEl.parentElement;
          if (bgEl) bgStr = getComputedStyle(bgEl).backgroundColor;
          else break;
        }
        const bg = rgb(bgStr || "rgb(9,9,11)");
        const r = ratio(fg, bg);
        if (r < 4.5) {
          low.push({
            el:
              el.tagName +
              (el.getAttribute("data-testid")
                ? `[${el.getAttribute("data-testid")}]`
                : ""),
            fg: s.color,
            bg: bgStr,
            ratio: Math.round(r * 100) / 100,
            text: (el as HTMLElement).innerText?.trim().slice(0, 30),
          });
        }
      }
      return {
        scanned: Math.min(targets.length, 60),
        low_contrast_count: low.length,
        low_contrast_samples: low.slice(0, 10),
      };
    });
    console.log("[contrast probe]", JSON.stringify(cs, null, 2));
  });

  test("E. cognitive load: how many interactive elements on first screen?", async ({
    page,
  }) => {
    await page.goto(
      "/simulate/builder/?preset=atr-breakout&dir=short&sl=3&tp=7&coins=20",
    );
    await page.waitForTimeout(3000);
    const above = await page.evaluate(() => {
      const vh = window.innerHeight;
      const all = Array.from(
        document.querySelectorAll(
          "button, a, input, select, [role=tab], [role=button]",
        ),
      );
      const visible = all.filter((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return r.top < vh && r.bottom > 0 && r.width > 0 && r.height > 0;
      });
      return {
        total_interactive: all.length,
        above_fold: visible.length,
        above_fold_texts: visible
          .map(
            (el) =>
              (el as HTMLElement).innerText?.trim().slice(0, 25) ||
              (el as HTMLInputElement).name ||
              el.tagName,
          )
          .filter(Boolean)
          .slice(0, 40),
      };
    });
    console.log(
      "[cognitive load]",
      JSON.stringify(above, null, 2).slice(0, 2500),
    );
  });
});
