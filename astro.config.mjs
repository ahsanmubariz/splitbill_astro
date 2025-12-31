import { defineConfig } from 'astro/config';
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  integrations: [react(), tailwind(), sitemap()],

  // Production optimizations
  build: {
    // Inline stylesheets smaller than this limit
    inlineStylesheets: 'auto',
  },

  // Vite configuration for production optimizations
  vite: {
    build: {
      // Enable minification
      minify: 'esbuild',
      // Optimize chunks
      rollupOptions: {
        output: {
          manualChunks: {
            // Separate vendor chunks for better caching
            vendor: ['react', 'react-dom'],
          },
        },
      },
    },
    // Enable compression
    server: {
      host: process.env.HOST || '0.0.0.0',
      port: parseInt(process.env.PORT || '4321'),
    },
  },

  // Security headers and optimizations
  server: {
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.PORT || '4321'),
  },

  // Site configuration for SEO
  site: process.env.SITE_URL || 'https://ai-splitbill-astro.cloud/',

});
