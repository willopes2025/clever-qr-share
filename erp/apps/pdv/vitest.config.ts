import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  // O PDV não tem CSS em teste, e procurar postcss árvore acima encontra a
  // configuração de outro projeto quando este repositório mora aninhado.
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: {
      '@soul/contracts': resolve(__dirname, '../../packages/contracts/src'),
      '@soul/money': resolve(__dirname, '../../packages/money/src'),
    },
  },
  test: { environment: 'node', include: ['src/**/*.spec.ts'] },
});
