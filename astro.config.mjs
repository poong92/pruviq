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
      // Exclude legacy /learn/ redirect routes from the generated sitemap.
      // Those pages redirect to /blog/* and should not be indexed as separate URLs.
      filter(page) {
        return !page.includes('/learn/') && !page.includes('/demo/');
      },
      // Add `lastmod` and filter out unwanted paths (double-check /learn/ and /ko/404/)
      serialize(item) {
        if (!item || !item.url) return item;
        if (item.url.includes('/learn/')) return undefined;
        if (item.url.includes('/demo/')) return undefined;
        if (item.url.includes('/ko/404/')) return undefined;
        return {
          url: item.url,
          lastmod: new Date().toISOString()
        };
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
