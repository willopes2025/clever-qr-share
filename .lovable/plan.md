
# Plano: Transformar Site em PWA (Android + iOS)

## Situacao Atual

O projeto ja possui algumas configuracoes basicas para mobile:
- Meta tags `apple-mobile-web-app-capable` e `apple-mobile-web-app-status-bar-style` ja existem
- Meta tag `theme-color` ja existe (cor `#215C54`)
- Favicon ja configurado

**O que falta:**
- Arquivo manifest.webmanifest
- Service Worker
- Icones PWA (192x192 e 512x512)
- Link para o manifest no HTML
- Registro do Service Worker no React
- Apple touch icon

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `public/manifest.webmanifest` | Manifesto PWA com configuracoes do app |
| `public/service-worker.js` | Service Worker basico |
| `public/icon-192.png` | Icone 192x192 para PWA |
| `public/icon-512.png` | Icone 512x512 para PWA |

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `index.html` | Adicionar link para manifest e apple-touch-icon |
| `src/main.tsx` | Registrar Service Worker |

## Detalhes Tecnicos

### 1. Manifest (public/manifest.webmanifest)

```json
{
  "name": "Widezap",
  "short_name": "Widezap",
  "description": "Plataforma de Disparo WhatsApp com QR Code Ilimitado",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#0F0F0F",
  "theme_color": "#215C54",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### 2. Service Worker (public/service-worker.js)

```javascript
const CACHE_NAME = 'widezap-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network-first strategy para SPA
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
  }
});
```

### 3. Alteracoes no index.html

Adicionar dentro do `<head>`:

```html
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

### 4. Registro do Service Worker (src/main.tsx)

Adicionar apos o render:

```typescript
// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}
```

### 5. Icones PWA

Serao criados icones placeholder com as dimensoes corretas:
- `icon-192.png`: 192x192 pixels
- `icon-512.png`: 512x512 pixels

Nota: Os icones serao criados como placeholders. Voce pode substituir depois por icones personalizados com o logo do Widezap.

## Compatibilidade com React Router

O Service Worker ja esta configurado com estrategia "network-first" para navegacao, garantindo que:
- Todas as rotas SPA funcionem corretamente
- Em caso de offline, retorna a pagina inicial para o React Router gerenciar
- Nao interfere no roteamento existente

## Resultado Esperado

**Android (Chrome):**
- Banner "Instalar app" aparece automaticamente
- App abre em tela cheia (modo standalone)
- Icone na home screen

**iOS (Safari):**
- Compartilhar → Adicionar a Tela de Inicio
- App abre em modo standalone
- Status bar com estilo translucido

**Validacao Tecnica:**
- Manifest acessivel via `/manifest.webmanifest`
- Service Worker registrado corretamente
- Lighthouse PWA score melhorado
- Pronto para empacotamento via Bubblewrap (TWA)
