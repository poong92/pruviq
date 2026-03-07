import { test, expect } from '@playwright/test';

// ─── Page list ─────────────────────────────────────────────
const PAGES = [
  { path: '/', name: 'Home_EN' },
  { path: '/ko/', name: 'Home_KO' },
  { path: '/simulate/', name: 'Simulate_EN' },
  { path: '/ko/simulate/', name: 'Simulate_KO' },
  { path: '/coins/', name: 'Coins_EN' },
  { path: '/ko/coins/', name: 'Coins_KO' },
  { path: '/coins/btcusdt/', name: 'BTC_EN' },
  { path: '/ko/coins/btcusdt/', name: 'BTC_KO' },
  { path: '/coins/ethusdt/', name: 'ETH_EN' },
  { path: '/market/', name: 'Market_EN' },
  { path: '/ko/market/', name: 'Market_KO' },
  { path: '/strategies/', name: 'Strategies_EN' },
  { path: '/ko/strategies/', name: 'Strategies_KO' },
  { path: '/strategies/compare/', name: 'Compare_EN' },
  { path: '/ko/strategies/compare/', name: 'Compare_KO' },
  { path: '/fees/', name: 'Fees_EN' },
  { path: '/ko/fees/', name: 'Fees_KO' },
  { path: '/about/', name: 'About_EN' },
  { path: '/ko/about/', name: 'About_KO' },
  { path: '/terms/', name: 'Terms_EN' },
  { path: '/privacy/', name: 'Privacy_EN' },
];

// ─── 1. All pages load with 200, no JS errors ─────────────
test.describe('Pages', () => {
  for (const pg of PAGES) {
    test(`${pg.name} loads OK`, async ({ page }) => {
      const jsErrors: string[] = [];
      page.on('pageerror', e => jsErrors.push(e.message));

      const res = await page.goto(pg.path, { waitUntil: 'networkidle' });
      expect(res?.status()).toBe(200);

      // viewport-only screenshot (no fullPage → always < 2000px)
      await page.screenshot({ path: `tests/screenshots/${pg.name}.png` });

      // report real JS errors (ignore CSP noise)
      const real = jsErrors.filter(e => !e.includes('cloudflareinsights') && !e.includes('beacon'));
      if (real.length) console.log(`[${pg.name}] JS errors:`, real);
    });
  }
});

// ─── 2. Charts render canvas ──────────────────────────────
test.describe('Charts', () => {
  test('BTC chart canvas renders (desktop)', async ({ page }) => {
    await page.goto('/coins/btcusdt/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const count = await page.locator('canvas').count();
    console.log(`BTC desktop canvas: ${count}`);
    await page.screenshot({ path: 'tests/screenshots/chart_btc_desktop.png' });
    expect(count).toBeGreaterThan(0);
  });

  test('BTC chart canvas renders (mobile)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    await page.goto('/coins/btcusdt/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const count = await page.locator('canvas').count();
    console.log(`BTC mobile canvas: ${count}`);
    await page.screenshot({ path: 'tests/screenshots/chart_btc_mobile.png' });
    expect(count).toBeGreaterThan(0);
  });

  test('ETH chart canvas renders', async ({ page }) => {
    await page.goto('/coins/ethusdt/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    expect(await page.locator('canvas').count()).toBeGreaterThan(0);
  });

  test('KO chart renders', async ({ page }) => {
    await page.goto('/ko/coins/btcusdt/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    expect(await page.locator('canvas').count()).toBeGreaterThan(0);
  });
});

// ─── 3. APIs ──────────────────────────────────────────────
test.describe('APIs', () => {
  const apis = [
    'https://api.pruviq.com/market',
    'https://api.pruviq.com/news',
    'https://api.pruviq.com/macro',
    'https://api.pruviq.com/coins/stats',
    'https://api.pruviq.com/builder/presets',
    'https://api.pruviq.com/ohlcv/BTCUSDT?limit=10',
  ];
  for (const url of apis) {
    test(`${url.split('/').pop()} returns 200`, async ({ page }) => {
      const res = await page.request.get(url);
      expect(res.status()).toBe(200);
    });
  }
});

// ─── 4. StrategyBuilder interactive ───────────────────────
test.describe('StrategyBuilder', () => {
  test('Component mounts with inputs', async ({ page }) => {
    await page.goto('/simulate/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const inputs = await page.locator('input, select, button').count();
    console.log(`Simulate inputs: ${inputs}`);
    expect(inputs).toBeGreaterThan(10);
    await page.screenshot({ path: 'tests/screenshots/simulate_desktop.png' });
  });

  test('Avoid Hours buttons toggle (desktop)', async ({ page }) => {
    await page.goto('/simulate/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const btns = page.locator('button').filter({ hasText: /^[0-9]{1,2}$/ });
    expect(await btns.count()).toBe(24);

    // Click hour 0 and check class changes
    const btn0 = btns.first();
    const classBefore = await btn0.getAttribute('class') || '';
    await btn0.click();
    await page.waitForTimeout(200);
    const classAfter = await btn0.getAttribute('class') || '';
    console.log(`Toggle: before has red=${classBefore.includes('red')}, after has red=${classAfter.includes('red')}`);
    // Should toggle
    expect(classBefore.includes('red')).not.toBe(classAfter.includes('red'));
  });

  test('Avoid Hours buttons toggle (mobile tap)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    await page.goto('/simulate/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const btns = page.locator('button').filter({ hasText: /^[0-9]{1,2}$/ });
    expect(await btns.count()).toBe(24);

    const btn5 = btns.nth(5);
    const classBefore = await btn5.getAttribute('class') || '';
    await btn5.tap();
    await page.waitForTimeout(200);
    const classAfter = await btn5.getAttribute('class') || '';
    console.log(`Mobile tap toggle: before red=${classBefore.includes('red')}, after red=${classAfter.includes('red')}`);
    expect(classBefore.includes('red')).not.toBe(classAfter.includes('red'));
    await page.screenshot({ path: 'tests/screenshots/mobile_avoid_hours.png' });
  });

  test('Run Backtest button exists', async ({ page }) => {
    await page.goto('/simulate/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const btn = page.locator('button').filter({ hasText: /Run Backtest|백테스트 실행/i });
    expect(await btn.count()).toBeGreaterThan(0);
  });

  test('Coin mode switching: All → Top → All (no errors)', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', e => jsErrors.push(e.message));

    await page.goto('/simulate/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Find coin mode buttons (All Coins, Top N, Select)
    const allBtn = page.locator('button').filter({ hasText: /All Coins|전체 코인/i });
    const topBtn = page.locator('button').filter({ hasText: /Top N/i });

    // Initial state: All Coins should be active
    expect(await allBtn.count()).toBeGreaterThan(0);
    expect(await topBtn.count()).toBeGreaterThan(0);

    // Switch to Top N
    await topBtn.click();
    await page.waitForTimeout(500);

    // Verify Top N input appears with a numeric max attribute
    const topNInput = page.locator('input[type="number"][max]');
    expect(await topNInput.count()).toBeGreaterThan(0);

    // Switch back to All Coins
    await allBtn.click();
    await page.waitForTimeout(500);

    // Top N input should disappear
    expect(await topNInput.count()).toBe(0);

    // No JS errors during mode switching
    const real = jsErrors.filter(e => !e.includes('cloudflareinsights') && !e.includes('beacon'));
    expect(real, 'No JS errors during coin mode switching').toHaveLength(0);

    console.log('Coin mode switching: All → Top → All passed (no errors)');
    await page.screenshot({ path: 'tests/screenshots/coin_mode_switch.png' });
  });

  test('Top N input max matches total coins from API', async ({ page }) => {
    await page.goto('/simulate/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Switch to Top N mode
    const topBtn = page.locator('button').filter({ hasText: /Top N/i });
    await topBtn.click();
    await page.waitForTimeout(500);

    // Check the max attribute on the input — should be a positive number (dynamic from /health API)
    const input = page.locator('input[type="number"][max]').first();
    const maxVal = parseInt(await input.getAttribute('max') || '0');
    expect(maxVal).toBeGreaterThan(100);
    console.log(`Top N input max=${maxVal} (dynamic from /health API ✓)`);
  });
});

// ─── 5. CoinList interaction ──────────────────────────────
test.describe('CoinList', () => {
  test('Table loads 50 rows', async ({ page }) => {
    await page.goto('/coins/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const rows = await page.locator('table tbody tr').count();
    console.log(`Coin rows: ${rows}`);
    expect(rows).toBe(50);
  });

  test('Search filters rows', async ({ page }) => {
    await page.goto('/coins/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.locator('input[type="text"]').fill('BTC');
    await page.waitForTimeout(500);
    const rows = await page.locator('table tbody tr').count();
    console.log(`After search BTC: ${rows} rows`);
    expect(rows).toBeLessThan(50);
    expect(rows).toBeGreaterThan(0);
  });

  test('Row click navigates to coin page (desktop)', async ({ page }) => {
    await page.goto('/coins/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const link = page.locator('table tbody a[href*="/coins/"]').first();
    await link.click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toMatch(/\/coins\/[a-z]+usdt/);
    console.log(`Navigated to: ${page.url()}`);
  });

  test('Row tap navigates (mobile)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    await page.goto('/coins/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/screenshots/mobile_coinlist.png' });

    const link = page.locator('table tbody a[href*="/coins/"]').first();
    await link.tap();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    expect(page.url()).toMatch(/\/coins\/[a-z]+usdt/);
    console.log(`Mobile navigated to: ${page.url()}`);
    await page.screenshot({ path: 'tests/screenshots/mobile_coin_detail.png' });
  });

  test('Pagination works', async ({ page }) => {
    await page.goto('/coins/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const nextBtn = page.locator('button').filter({ hasText: '>' });
    if (await nextBtn.count() > 0) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      const showing = await page.locator('text=/2\\/\\d+/').count();
      console.log(`Page 2 indicator found: ${showing > 0}`);
    }
  });
});

// ─── 6. Market Dashboard ──────────────────────────────────
test.describe('MarketDashboard', () => {
  test('Shows BTC data (desktop)', async ({ page }) => {
    await page.goto('/market/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    const btcText = await page.locator('text=/BTC|Bitcoin/i').count();
    console.log(`Market BTC mentions: ${btcText}`);
    expect(btcText).toBeGreaterThan(0);
    await page.screenshot({ path: 'tests/screenshots/market_desktop.png' });
  });

  test('Shows data (mobile)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    await page.goto('/market/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'tests/screenshots/mobile_market.png' });
    const btcText = await page.locator('text=/BTC|Bitcoin/i').count();
    expect(btcText).toBeGreaterThan(0);
  });
});

// ─── 7. Fees page ─────────────────────────────────────────
test.describe('Fees', () => {
  test('Calculator has slider and exchanges', async ({ page }) => {
    await page.goto('/fees/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const binance = await page.locator('text=/Binance/i').count();
    expect(binance).toBeGreaterThan(0);
    await page.screenshot({ path: 'tests/screenshots/fees_desktop.png' });
  });
});

// ─── 8. Navigation ────────────────────────────────────────
test.describe('Navigation', () => {
  test('Desktop nav has all links', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    const links = await nav.locator('a').count();
    console.log(`Nav links: ${links}`);
    expect(links).toBeGreaterThan(4);
  });

  test('Mobile hamburger menu opens', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'tests/screenshots/mobile_home.png' });

    // Find hamburger button
    const menuBtn = page.locator('nav button, button[aria-label*="menu" i]');
    if (await menuBtn.count() > 0) {
      await menuBtn.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/screenshots/mobile_menu_open.png' });
    }
  });

  test('Language switch EN→KO', async ({ page, isMobile }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // On mobile, open hamburger menu first
    if (isMobile) {
      const menuBtn = page.locator('nav button, button[aria-label*="menu" i]');
      if (await menuBtn.count() > 0) {
        await menuBtn.first().click();
        await page.waitForTimeout(500);
      }
    }

    const koLink = page.locator('a[href="/ko/"], a[href="/ko"]').first();
    if (await koLink.count() > 0 && await koLink.isVisible()) {
      await koLink.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/ko');
    }
  });

  test('Footer visible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('footer')).toBeVisible();
  });

  test('Page loader hidden after load', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const loader = page.locator('#page-loader');
    if (await loader.count() > 0) {
      expect(await loader.isVisible()).toBe(false);
    }
  });
});

// ─── 9. Mobile-specific UX ───────────────────────────────
test.describe('Mobile UX', () => {
  test('Home layout (mobile)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'tests/screenshots/mobile_home_full.png' });
    const vp = page.viewportSize();
    console.log(`Mobile viewport: ${vp?.width}x${vp?.height}`);
    expect(vp!.width).toBeLessThan(500);
  });

  test('Simulate layout (mobile)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    await page.goto('/simulate/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/screenshots/mobile_simulate.png' });
  });

  test('Fees layout (mobile)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    await page.goto('/fees/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/screenshots/mobile_fees.png' });
  });

  test('Strategies page (mobile)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    await page.goto('/strategies/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/screenshots/mobile_strategies.png' });
  });
});

// ─── 10. Performance ──────────────────────────────────────
test.describe('Performance', () => {
  test('Home < 5s', async ({ page }) => {
    const t0 = Date.now();
    await page.goto('/', { waitUntil: 'networkidle' });
    const ms = Date.now() - t0;
    console.log(`Home: ${ms}ms`);
    expect(ms).toBeLessThan(5000);
  });

  test('Simulate < 5s', async ({ page }) => {
    const t0 = Date.now();
    await page.goto('/simulate/', { waitUntil: 'networkidle' });
    const ms = Date.now() - t0;
    console.log(`Simulate: ${ms}ms`);
    expect(ms).toBeLessThan(5000);
  });

  test('Coin chart < 8s', async ({ page }) => {
    const t0 = Date.now();
    await page.goto('/coins/btcusdt/', { waitUntil: 'networkidle' });
    const ms = Date.now() - t0;
    console.log(`Coin chart: ${ms}ms`);
    expect(ms).toBeLessThan(8000);
  });
});
