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
        return !page.includes('/learn/') && !page.includes('/demo/') && !page.includes('/builder/');
      },
      serialize(item) {
        if (!item || !item.url) return item;
        if (item.url.includes('/learn/')) return undefined;
        if (item.url.includes('/demo/')) return undefined;
        if (item.url.includes('/builder/')) return undefined;
        if (item.url.includes('/ko/404/')) return undefined;
        item.lastmod = new Date().toISOString();
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
