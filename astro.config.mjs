// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import preact from '@astrojs/preact';

// https://astro.build/config
export default defineConfig({
  site: 'https://pruviq.com',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ko'],
    routing: {
      prefixDefaultLocale: false
    }
  },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en',
          ko: 'ko'
        }
      },
      filter(page) {
        return !(/\/learn\/.+/.test(page)) && !page.includes('/demo/') && !page.includes('/builder/') && !page.includes('/404');
      },
      serialize(item) {
        if (!item || !item.url) return item;
        if (/\/learn\/.+/.test(item.url)) return undefined;
        if (item.url.includes('/demo/')) return undefined;
        if (item.url.includes('/builder/')) return undefined;
        if (item.url.includes('/404')) return undefined;

        const url = new URL(item.url);
        const isKo = url.pathname.startsWith('/ko/') || url.pathname === '/ko';
        const basePath = isKo ? url.pathname.replace(/^\/ko/, '') || '/' : url.pathname;
        const enUrl = `https://pruviq.com${basePath}`;
        const koUrl = `https://pruviq.com/ko${basePath === '/' ? '/' : basePath}`;

        // Only emit ko hreflang for paths known to have Korean versions
        const koPathPrefixes = ['/', '/about', '/api', '/fees', '/simulate', '/strategies', '/coins/', '/blog/', '/market', '/compare/', '/leaderboard', '/changelog', '/privacy', '/terms', '/methodology', '/signals', '/learn', '/best-crypto-backtesting', '/crypto-trading-simulator', '/why-backtests-fail'];
        const hasKoVersion = koPathPrefixes.some(prefix => basePath === prefix || basePath.startsWith(prefix));

        item.links = [
          { url: enUrl, lang: 'en' },
          ...(hasKoVersion ? [{ url: koUrl, lang: 'ko' }] : []),
          { url: enUrl, lang: 'x-default' },
        ];

        // Priority + crawl frequency by page type
        // @ts-ignore — EnumChangefreq accepts these string values at runtime
        const p = basePath;
        const today = new Date().toISOString().slice(0, 10);
        if (p === '/') {
          item.priority = 1.0; item.changefreq = /** @type {any} */ ('daily'); item.lastmod = today;
        } else if (['/simulate', '/strategies', '/market', '/leaderboard'].includes(p)) {
          item.priority = 0.9; item.changefreq = /** @type {any} */ ('daily'); item.lastmod = today;
        } else if (p === '/strategies/ranking') {
          item.priority = 0.9; item.changefreq = /** @type {any} */ ('daily'); item.lastmod = today;
        } else if (p.startsWith('/strategies/') || p.startsWith('/coins/')) {
          item.priority = 0.8; item.changefreq = /** @type {any} */ ('weekly'); item.lastmod = today;
        } else if (p.startsWith('/compare/') || p.startsWith('/vs/') || p.startsWith('/vs-')) {
          item.priority = 0.7; item.changefreq = /** @type {any} */ ('monthly');
        } else if (p.startsWith('/blog/')) {
          item.priority = 0.6; item.changefreq = /** @type {any} */ ('monthly');
        } else if (['/fees', '/learn', '/about', '/api'].includes(p)) {
          item.priority = 0.6; item.changefreq = /** @type {any} */ ('monthly');
        } else {
          item.priority = 0.5; item.changefreq = /** @type {any} */ ('monthly');
        }

        return item;
      }
    }),
    preact()
  ],
  vite: {
    plugins: [tailwindcss()],
    define: {
      'import.meta.env.PUBLIC_PRUVIQ_API_URL': JSON.stringify('https://api.pruviq.com')
    }
  }
});
