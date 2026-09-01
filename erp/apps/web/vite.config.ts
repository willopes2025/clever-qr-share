import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@soul/contracts': resolve(__dirname, '../../packages/contracts/src'),
      '@soul/ui': resolve(__dirname, '../../packages/ui/src'),
    },
  },
  server: { proxy: { '/v1': 'http://localhost:3000' } },
});
