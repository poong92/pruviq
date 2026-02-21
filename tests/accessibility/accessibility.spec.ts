import { test, expect } from '@playwright/test';
import fs from 'fs';

const pages = ['/', '/ko/', '/coins', '/strategies', '/simulate'];

test.describe('Accessibility (axe-core) checks', () => {
  for (const p of pages) {
    test(`a11y ${p}`, async ({ page }) => {
      // inject axe-core from local package
      const axePath = require.resolve('axe-core/axe.min.js');
      await page.addScriptTag({ path: axePath });
      await page.goto(p);
      // run axe
      const results = await page.evaluate(async () => {
        // @ts-ignore
        return await (window as any).axe.run(document, { runOnly: { type: 'tag', values: ['wcag2aa'] } });
      });
      if (results.violations && results.violations.length > 0) {
        // write a small report for artifact
        const short = results.violations.map((v: any) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
        fs.writeFileSync(`./reports/axe-${p.replace(/[^a-z0-9]/gi,'_')}.json`, JSON.stringify(short, null, 2));
      }
      expect(results.violations.length).toBe(0);
    });
  }
});
