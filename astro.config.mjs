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
      serialize(item) {
        // Add lastmod to all URLs
        // Use build date for all pages (blog posts will get their date from frontmatter in future enhancement)
        item.lastmod = new Date();
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
