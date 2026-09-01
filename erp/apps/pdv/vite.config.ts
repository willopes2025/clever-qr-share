import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'node:path';

const APP_VERSION = '1.0.0';

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@soul/contracts': resolve(__dirname, '../../packages/contracts/src'),
      '@soul/money': resolve(__dirname, '../../packages/money/src'),
      '@soul/ui': resolve(__dirname, '../../packages/ui/src'),
    },
  },
  server: { proxy: { '/v1': 'http://localhost:3000' } },
});
