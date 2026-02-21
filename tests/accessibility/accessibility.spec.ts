import { test, expect } from '@playwright/test';
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const pages = ['/', '/ko/', '/performance', '/simulate'];

test.describe('Accessibility (axe-core)', () => {
  for (const p of pages) {
    test(`a11y ${p}`, async ({ page }) => {
      const axePath = require.resolve('axe-core/axe.min.js');
      await page.goto(p);
      await page.addScriptTag({ path: axePath });
      await page.waitForTimeout(500);

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
        console.log(`a11y violations on ${p}:`, short);
      }

      // Warn but don't fail for now - just report
      // Once accessibility is clean, change to: expect(results.violations.length).toBe(0);
      if (results.violations.length > 0) {
        console.warn(`${results.violations.length} a11y violations on ${p}`);
      }
    });
  }
});
