import { test } from '@playwright/test';
import fs from 'fs';

const pages = ['/', '/simulate', '/strategies', '/coins', '/market', '/fees', '/ko', '/ko/simulate'];

test.describe('Mobile touch-target audit (non-failing) — enumerates interactive elements and writes a report', () => {
  test('enumerate interactive elements and write report', async ({ page }) => {
    const report: any[] = [];

    for (const p of pages) {
      await page.goto(p);
      await page.waitForLoadState('networkidle');

      const nodes = await page.evaluate(() => {
        const selectors = ['button', 'a', '[role="button"]', '.btn', '.btn-icon', '.icon-button', '.icon-link', 'nav a'];
        const elems = Array.from(document.querySelectorAll(selectors.join(',')));
        return elems.map((el) => {
          const r = (el as HTMLElement).getBoundingClientRect();
          return {
            tag: el.tagName,
            classes: (el as HTMLElement).className,
            text: ((el.textContent || '') as string).trim().slice(0, 80),
            width: Math.round(r.width),
            height: Math.round(r.height),
            outerHTML: (el as HTMLElement).outerHTML.slice(0, 300)
          };
        });
      });

      report.push({ page: p, count: nodes.length, elements: nodes });
    }

    fs.mkdirSync('./reports', { recursive: true });
    fs.writeFileSync('./reports/touch-targets.json', JSON.stringify(report, null, 2));
    console.log('Touch-target audit written: reports/touch-targets.json');
  });
});
