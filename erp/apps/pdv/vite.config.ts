import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';

const APP_VERSION = '1.0.0';

export default defineConfig({
  // Em produção o PDV vive em /pdv do mesmo domínio da retaguarda.
  base: process.env.PDV_BASE ?? '/',
  plugins: [
    react(),
    /**
     * O PDV é servido por um domínio na nuvem, mas precisa **abrir** com a
     * internet caída. O service worker guarda o app inteiro no dispositivo na
     * primeira visita; a partir daí o quiosque abre o caixa mesmo sem link, e a
     * venda vai para a fila local.
     */
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Soul PDV',
        short_name: 'Soul PDV',
        description: 'Frente de caixa da Soul Muscle',
        lang: 'pt-BR',
        start_url: process.env.PDV_BASE ?? '/',
        scope: process.env.PDV_BASE ?? '/',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#241463',
        theme_color: '#6147DE',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // Abrir qualquer rota offline serve o app guardado.
        navigateFallback: `${process.env.PDV_BASE ?? '/'}index.html`,
        // A API nunca é cacheada: dado de venda vem do servidor ou da fila local,
        // nunca de uma resposta velha guardada pelo navegador.
        navigateFallbackDenylist: [/^\/v1\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fontes',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
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
