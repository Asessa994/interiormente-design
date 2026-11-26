// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
// Pagine statiche servite da Cloudflare. compressHTML false mantiene il markup
// identico all'anteprima approvata (dati JSON e script inline).
export default defineConfig({
  output: 'static',
  compressHTML: false,
  adapter: cloudflare()
});
