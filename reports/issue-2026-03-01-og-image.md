Summary:

Performed automated performance check (cron: performance-lighthouse). Actions taken:
1) git pull origin main -> already up to date.
2) Measured frontend pages TTFB and total time (using Python urllib as curl not available in this environment):
- https://pruviq.com/ -> HTTP 200 TTFB: 0.481s Total: 0.495s Size: 28941 bytes
- https://pruviq.com/simulate/ -> HTTP 200 TTFB: 0.439s Total: 0.442s Size: 12383 bytes
- https://pruviq.com/coins/ -> HTTP 200 TTFB: 0.433s Total: 0.436s Size: 12499 bytes
- https://pruviq.com/market/ -> HTTP 200 TTFB: 0.461s Total: 0.464s Size: 12634 bytes
- https://pruviq.com/ko/ -> HTTP 200 TTFB: 0.437s Total: 0.452s Size: 29752 bytes

All TTFB are < 500ms and page sizes are well under 500KB (targets met).

3) Searched for large images (>200KB) in public/ and src/ -> none found.
4) Built site (npm run build) -> success (2446 pages built).
5) Scanned dist for JS/CSS asset sizes. Largest client asset:
- dist/_astro/lightweight-charts.production.DtvchTwF.js -> 163.1KB
Other notable bundles are small (<50KB).

Findings / Problem:
- There is a raster PNG present at public/og-image.png (1200x630) and it is referenced across pages (og:image, twitter:image). Requirement in performance-lighthouse cron: "All images WebP/AVIF" is not satisfied because og-image.png remains a PNG.
- Conversion tools are not available in this execution environment (no cwebp/ffmpeg and Python Pillow not installed), so I could not safely generate a WebP/AVIF asset here.

Why this matters:
- Social/Open Graph images are typically large and served on every page as meta tags; providing WebP/AVIF reduces bytes for clients that request them and improves Lighthouse scores for image formats.

Proposed fix (manual steps / automated script):
1) Convert public/og-image.png to WebP and AVIF (lossy, quality ~80):
   - Preferred: Node + sharp (fast, reliable):
     - npm i -D sharp
     - Create scripts/convert-og-image.js:

       const sharp = require('sharp');
       sharp('public/og-image.png').resize(1200,630).webp({quality:80}).toFile('public/og-image.webp');
       sharp('public/og-image.png').resize(1200,630).avif({quality:50}).toFile('public/og-image.avif');

     - node scripts/convert-og-image.js
   - Alternative: use imagemagick or cwebp if available: `cwebp -q 80 public/og-image.png -o public/og-image.webp` and `avifenc public/og-image.png public/og-image.avif`

2) Update src/layouts/Layout.astro to prefer WebP/AVIF for OG tags or add <link rel="preload" as="image" href="/og-image.webp" type="image/webp"> and update meta tags to point to /og-image.webp while keeping png fallback where necessary.

3) Run `npm run build` and verify `dist` contains og-image.webp and that built HTML references the .webp URL (or both via correct fallbacks).

4) Add a CI check or npm script to auto-generate WebP/AVIF from PNG sources during build to prevent regressions. E.g. add `postbuild` or `prebuild` script calling `node scripts/convert-og-image.js` or integrate into the existing build pipeline.

Attached diagnostics (copy of commands run during automated check):
- git pull: already up to date
- python urllib checks (see above)
- npm run build: Completed in 34.34s; 2446 pages built.
- dist asset scan: lightweight-charts 163.1KB (ok)
- image scan: public/og-image.png found (only raster image)

Action requested:
- I could not create WebP/AVIF in this environment due to missing binary dependencies. Please either: (A) let me install sharp (npm) and run the conversion here, or (B) a human run the conversion locally or add generated `public/og-image.webp` and `public/og-image.avif` to the repo and I will update the code & build, or (C) approve adding a small dev dependency (sharp) and a build-step script so future builds auto-generate these formats.

If you want, I can proceed to implement (A) autonomously: add sharp as devDependency, a conversion script, update Layout.astro to prefer .webp, run `npm run build`, commit the generated files and code changes, and open a PR. But I did NOT proceed because this environment lacks binary converters; I left a detailed plan here.

Evidence: (build output and files scanned are recorded in the automated run logs).
