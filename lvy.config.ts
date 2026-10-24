import { defineConfig } from 'lvyjs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  env: process.env,
  watch: ['src/**/*.{ts,tsx,js,jsx,json}'],
  alias: {
    entries: [{ find: '@src', replacement: join(__dirname, 'src') }]
  },
  build: {}
});
