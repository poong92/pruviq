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
        return !(/\/learn\/.+/.test(page)) && !page.includes('/demo/') && !page.includes('/builder/');
      },
      serialize(item) {
        if (!item || !item.url) return item;
        if (/\/learn\/.+/.test(item.url)) return undefined;
        if (item.url.includes('/demo/')) return undefined;
        if (item.url.includes('/builder/')) return undefined;
        if (item.url.includes('/ko/404/')) return undefined;

        const url = new URL(item.url);
        const isKo = url.pathname.startsWith('/ko/') || url.pathname === '/ko';
        const basePath = isKo ? url.pathname.replace(/^\/ko/, '') || '/' : url.pathname;
        const enUrl = `https://pruviq.com${basePath}`;
        const koUrl = `https://pruviq.com/ko${basePath === '/' ? '/' : basePath}`;

        item.links = [
          { url: enUrl, lang: 'en' },
          { url: koUrl, lang: 'ko' },
          { url: enUrl, lang: 'x-default' },
        ];

        // lastmod: build date (SSG — content regenerated each deploy)
        item.lastmod = new Date();

        // Priority + crawl frequency by page type
        // @ts-ignore — EnumChangefreq accepts these string values at runtime
        const p = basePath;
        if (p === '/') {
          item.priority = 1.0; item.changefreq = /** @type {any} */ ('daily');
        } else if (['/simulate', '/strategies', '/market', '/leaderboard'].includes(p)) {
          item.priority = 0.9; item.changefreq = /** @type {any} */ ('daily');
        } else if (p === '/strategies/ranking') {
          item.priority = 0.9; item.changefreq = /** @type {any} */ ('daily');
        } else if (p.startsWith('/strategies/') || p.startsWith('/coins/')) {
          item.priority = 0.8; item.changefreq = /** @type {any} */ ('weekly');
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
