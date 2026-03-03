import puppeteer from 'puppeteer';
import { resolve } from 'path';

const PUBLIC = resolve(import.meta.dirname, '../public');

// Shared CSS for the IQ block — single source of truth
const IQ_BLOCK_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&display=swap');
  * { margin:0;padding:0;box-sizing:border-box; }
  .iq-block {
    background:linear-gradient(135deg,#5cff9f 0%,#33ff88 30%,#00E676 70%,#00b85c 100%);
    display:flex;align-items:center;justify-content:center;
    font-family:'JetBrains Mono',monospace;font-weight:800;color:#0a0e27;
    position:relative;
  }
  .iq-block::before {
    content:'';position:absolute;top:0;left:0;right:0;height:50%;
    background:linear-gradient(to bottom,rgba(255,255,255,0.2),transparent);
  }
  .check {
    position:absolute;background:#2a2f4e;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
  }
  .check-inner {
    background:#00E676;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
  }
  .check-inner svg { display:block; }
`;

async function render(browser, html, outputPath, width, height, transparent = false, dpi = 4) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: dpi });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.fonts.ready);
  await page.screenshot({
    path: outputPath, type: 'png',
    omitBackground: transparent,
    clip: { x: 0, y: 0, width, height }
  });
  await page.close();
  console.log(`  ✓ ${outputPath.split('/').pop()} (${width}x${height} @${dpi}x = ${width*dpi}px${transparent ? ' transparent' : ''})`);
}

function iconHTML(size) {
  const block = Math.round(size * 0.75);
  const radius = Math.round(block * 0.16);
  const fontSize = Math.round(block * 0.45);
  const checkOuter = Math.round(block * 0.36);    // 1.8x from 0.20 (user spec)
  const checkInner = Math.round(checkOuter * 0.65); // green inner circle
  const checkSvg = Math.round(checkInner * 0.65);
  const shadowBlur = Math.round(block * 0.12);
  const shadowSpread = Math.round(block * 0.06);
  const skipCheck = size <= 48; // checkmark invisible at tiny sizes

  return `<!DOCTYPE html><html><head><style>
    ${IQ_BLOCK_CSS}
    body { width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:transparent; }
    .iq-block {
      width:${block}px;height:${block}px;border-radius:${radius}px;
      font-size:${fontSize}px;letter-spacing:${Math.round(fontSize*0.04)}px;
      box-shadow:0 0 ${shadowBlur}px rgba(0,230,118,0.3),0 ${shadowSpread}px ${shadowSpread*2}px rgba(0,0,0,0.25);
    }
    .iq-block::before { border-radius:${radius}px ${radius}px 0 0; }
    .check { top:${-Math.round(checkOuter*0.28)}px;right:${-Math.round(checkOuter*0.28)}px;width:${checkOuter}px;height:${checkOuter}px; }
    .check-inner { width:${checkInner}px;height:${checkInner}px; }
    .check-inner svg { width:${checkSvg}px;height:${checkSvg}px; }
  </style></head><body>
    <div class="iq-block">IQ
      ${skipCheck ? '' : '<div class="check"><div class="check-inner"><svg viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>'}
    </div>
  </body></html>`;
}

// Circle-crop safe version: block = 58% (X/social profile won't clip the checkmark)
function profileIconHTML(size) {
  const block = Math.round(size * 0.58);
  const radius = Math.round(block * 0.16);
  const fontSize = Math.round(block * 0.45);
  const checkOuter = Math.round(block * 0.36);
  const checkInner = Math.round(checkOuter * 0.65);
  const checkSvg = Math.round(checkInner * 0.65);
  const shadowBlur = Math.round(block * 0.12);
  const shadowSpread = Math.round(block * 0.06);

  return `<!DOCTYPE html><html><head><style>
    ${IQ_BLOCK_CSS}
    body { width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:transparent; }
    .iq-block {
      width:${block}px;height:${block}px;border-radius:${radius}px;
      font-size:${fontSize}px;letter-spacing:${Math.round(fontSize*0.04)}px;
      box-shadow:0 0 ${shadowBlur}px rgba(0,230,118,0.3),0 ${shadowSpread}px ${shadowSpread*2}px rgba(0,0,0,0.25);
    }
    .iq-block::before { border-radius:${radius}px ${radius}px 0 0; }
    .check { top:${-Math.round(checkOuter*0.28)}px;right:${-Math.round(checkOuter*0.28)}px;width:${checkOuter}px;height:${checkOuter}px; }
    .check-inner { width:${checkInner}px;height:${checkInner}px; }
    .check-inner svg { width:${checkSvg}px;height:${checkSvg}px; }
  </style></head><body>
    <div class="iq-block">IQ
      <div class="check"><div class="check-inner"><svg viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
    </div>
  </body></html>`;
}

async function main() {
  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--font-render-hinting=none', '--disable-lcd-text']
  });

  // === Icons (75% block, tight, for favicons/website) @4x ===
  await render(browser, iconHTML(512), `${PUBLIC}/icon-512.png`, 512, 512, true);
  await render(browser, iconHTML(192), `${PUBLIC}/icon-192.png`, 192, 192, true);
  await render(browser, iconHTML(180), `${PUBLIC}/apple-touch-icon.png`, 180, 180, true);
  await render(browser, iconHTML(32),  `${PUBLIC}/favicon-32.png`, 32, 32, true);

  // === pruviq-logo (58% block, circle-crop safe, for X/social profile) @4x ===
  await render(browser, profileIconHTML(512), `${PUBLIC}/pruviq-logo.png`, 512, 512, true);

  // === Social Profile (800x800, dark bg) ===
  const socialHTML = `<!DOCTYPE html><html><head><style>
    ${IQ_BLOCK_CSS}
    body { width:800px;height:800px;background:#0a0e27;font-family:'JetBrains Mono',monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px; }
    .grid { position:absolute;inset:0;background-image:linear-gradient(rgba(0,230,118,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,230,118,0.03) 1px,transparent 1px);background-size:40px 40px; }
    .iq-block {
      width:280px;height:280px;border-radius:44px;font-size:130px;letter-spacing:5px;
      box-shadow:0 0 60px rgba(0,230,118,0.3),0 8px 30px rgba(0,0,0,0.3);
    }
    .iq-block::before { border-radius:44px 44px 0 0; }
    .check { top:-18px;right:-18px;width:86px;height:86px; }
    .check-inner { width:56px;height:56px; }
    .check-inner svg { width:35px;height:35px; }
    .brand { font-size:52px;font-weight:600;letter-spacing:5px; }
    .pruv { color:#e8eaf0; }
    .iq-text { color:#00E676;font-weight:700; }
    .tagline { font-size:17px;color:#8892b0;letter-spacing:4px; }
    .sep { width:140px;height:1px;background:rgba(0,230,118,0.15); }
    .corner { position:absolute;width:28px;height:28px;border-color:rgba(0,230,118,0.1);border-style:solid;border-width:0; }
    .tl { top:40px;left:40px;border-top-width:1px;border-left-width:1px; }
    .tr { top:40px;right:40px;border-top-width:1px;border-right-width:1px; }
    .bl { bottom:40px;left:40px;border-bottom-width:1px;border-left-width:1px; }
    .br { bottom:40px;right:40px;border-bottom-width:1px;border-right-width:1px; }
  </style></head><body>
    <div class="grid"></div>
    <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
    <div class="iq-block">IQ
      <div class="check"><div class="check-inner"><svg viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
    </div>
    <div class="brand"><span class="pruv">PRUV</span><span class="iq-text">IQ</span></div>
    <div class="sep"></div>
    <div class="tagline">PROVE YOUR STRATEGY</div>
  </body></html>`;

  await render(browser, socialHTML, `${PUBLIC}/social-profile.png`, 800, 800, false);

  // === X Banner (1500x500, dark bg) ===
  const bannerHTML = `<!DOCTYPE html><html><head><style>
    ${IQ_BLOCK_CSS}
    body { width:1500px;height:500px;background:#0a0e27;font-family:'JetBrains Mono',monospace;position:relative;overflow:hidden; }
    .grid { position:absolute;inset:0;background-image:linear-gradient(rgba(0,230,118,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,230,118,0.03) 1px,transparent 1px);background-size:50px 50px; }
    .center { position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:40px; }
    .iq-block {
      width:260px;height:260px;border-radius:42px;font-size:120px;letter-spacing:4px;
      box-shadow:0 0 60px rgba(0,230,118,0.3),0 8px 30px rgba(0,0,0,0.3);
      flex-shrink:0;
    }
    .iq-block::before { border-radius:42px 42px 0 0; }
    .check { top:-16px;right:-16px;width:83px;height:83px; }
    .check-inner { width:54px;height:54px; }
    .check-inner svg { width:34px;height:34px; }
    .text-group { display:flex;flex-direction:column;gap:12px; }
    .brand { font-size:72px;font-weight:600;letter-spacing:5px; }
    .pruv { color:#e8eaf0; }
    .iq-text { color:#00E676;font-weight:700; }
    .tagline { font-size:24px;color:#8892b0;letter-spacing:4px; }
    .corner { position:absolute;width:30px;height:30px;border-color:rgba(0,230,118,0.1);border-style:solid;border-width:0; }
    .tl { top:30px;left:30px;border-top-width:1px;border-left-width:1px; }
    .tr { top:30px;right:30px;border-top-width:1px;border-right-width:1px; }
    .bl { bottom:30px;left:30px;border-bottom-width:1px;border-left-width:1px; }
    .br { bottom:30px;right:30px;border-bottom-width:1px;border-right-width:1px; }
  </style></head><body>
    <div class="grid"></div>
    <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
    <div class="center">
      <div class="iq-block">IQ
        <div class="check"><div class="check-inner"><svg viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
      </div>
      <div class="text-group">
        <div class="brand"><span class="pruv">PRUV</span><span class="iq-text">IQ</span></div>
        <div class="tagline">PROVE YOUR STRATEGY</div>
      </div>
    </div>
  </body></html>`;

  await render(browser, bannerHTML, `${PUBLIC}/x-banner.png`, 1500, 500, false);

  // === OG Image (1200x630, dark bg) ===
  const ogHTML = `<!DOCTYPE html><html><head><style>
    ${IQ_BLOCK_CSS}
    body { width:1200px;height:630px;background:#0a0e27;font-family:'JetBrains Mono',monospace;position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px; }
    .grid { position:absolute;inset:0;background-image:linear-gradient(rgba(0,230,118,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,230,118,0.03) 1px,transparent 1px);background-size:50px 50px; }
    .top { display:flex;align-items:center;gap:30px;z-index:1; }
    .iq-block {
      width:160px;height:160px;border-radius:26px;font-size:76px;letter-spacing:3px;
      box-shadow:0 0 50px rgba(0,230,118,0.3),0 6px 24px rgba(0,0,0,0.3);
      flex-shrink:0;
    }
    .iq-block::before { border-radius:26px 26px 0 0; }
    .check { top:-12px;right:-12px;width:50px;height:50px; }
    .check-inner { width:33px;height:33px; }
    .check-inner svg { width:21px;height:21px; }
    .brand { font-size:64px;font-weight:600;letter-spacing:5px; }
    .pruv { color:#e8eaf0; }
    .iq-text { color:#00E676;font-weight:700; }
    .tagline { font-size:20px;color:#8892b0;letter-spacing:4px;z-index:1; }
    .sep { width:140px;height:1px;background:rgba(0,230,118,0.15);z-index:1; }
    .stats { display:flex;gap:50px;font-size:16px;color:#00E676;letter-spacing:1px;z-index:1;font-family:'JetBrains Mono',monospace; }
    .corner { position:absolute;width:25px;height:25px;border-color:rgba(0,230,118,0.1);border-style:solid;border-width:0; }
    .tl { top:25px;left:25px;border-top-width:1px;border-left-width:1px; }
    .tr { top:25px;right:25px;border-top-width:1px;border-right-width:1px; }
    .bl { bottom:25px;left:25px;border-bottom-width:1px;border-left-width:1px; }
    .br { bottom:25px;right:25px;border-bottom-width:1px;border-right-width:1px; }
  </style></head><body>
    <div class="grid"></div>
    <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
    <div class="top">
      <div class="iq-block">IQ
        <div class="check"><div class="check-inner"><svg viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
      </div>
      <div class="brand"><span class="pruv">PRUV</span><span class="iq-text">IQ</span></div>
    </div>
    <div class="tagline">PROVE YOUR STRATEGY</div>
    <div class="sep"></div>
    <div class="stats">
      <span>1,625+ Trades</span>
      <span>54% Win Rate</span>
      <span>47 Days Verified</span>
    </div>
  </body></html>`;

  await render(browser, ogHTML, `${PUBLIC}/og-image.png`, 1200, 630, false);

  // Attempt to convert og-image.png → webp/avif using optional sharp (if installed)
  try {
    const { spawn } = await import('child_process');
    const scriptPath = new URL('./convert-og-image.mjs', import.meta.url).pathname;
    const p = spawn('node', [scriptPath], { stdio: 'inherit' });
    await new Promise((resolve) => {
      p.on('close', () => resolve());
      p.on('error', () => resolve());
    });
  } catch (e) {
    console.log('Skipping og-image conversion spawn:', e && (e.message || e));
  }

  await browser.close();
  console.log('\nAll assets rendered!');
}

main().catch(console.error);
