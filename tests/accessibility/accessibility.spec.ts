import { test, expect } from '@playwright/test';
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);

const pages = ['/', '/ko/', '/simulate'];

test.describe('Accessibility (axe-core)', () => {
  for (const p of pages) {
    test(`a11y ${p}`, async ({ page }) => {
      await page.goto(p);
      await page.waitForLoadState('networkidle');

      const axePath = require.resolve('axe-core/axe.min.js');
      await page.addScriptTag({ path: axePath });
      await page.waitForFunction(() => typeof (window as any).axe !== 'undefined');

      const results = await page.evaluate(async () => {
        return await (window as any).axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2aa'] },
        });
      });

      if (results.violations && results.violations.length > 0) {
        const short = results.violations.map((v: any) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
        }));
        fs.mkdirSync('./reports', { recursive: true });
        fs.writeFileSync(
          `./reports/axe-${p.replace(/[^a-z0-9]/gi, '_')}.json`,
          JSON.stringify(short, null, 2)
        );
        console.warn(`${results.violations.length} a11y violations on ${p}:`, short);
      }
    });
  }
});
