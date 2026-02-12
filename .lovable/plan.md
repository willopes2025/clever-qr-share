

## Problema

O formulário público é renderizado dentro de um `<iframe>` (via `PublicFormPage.tsx`). Quando o usuário submete o formulário e existe uma URL de redirecionamento configurada, o código atual usa:

```javascript
window.location.href = redirectUrl;
```

Isso faz com que a navegação aconteça **dentro do iframe**, criando uma "página dentro da página" ao invés de redirecionar o usuário para fora do formulário.

## Solucao

Alterar o redirecionamento no Edge Function `public-form` para usar `window.top.location.href`, que navega na **janela principal** (topo da hierarquia de frames), garantindo que o usuário saia completamente do formulário.

## Alteracao

**Arquivo:** `supabase/functions/public-form/index.ts`

- Linha ~343: Trocar `window.location.href = redirectUrl` por `window.top.location.href = redirectUrl`
- Isso funciona tanto quando o formulario esta em modo embed (iframe dentro de site externo) quanto quando esta na pagina publica do sistema (`/f/:slug`)

## Detalhes Tecnicos

- `window.top` referencia a janela mais alta na hierarquia de frames, ignorando qualquer nivel de iframe intermediario
- O sandbox do iframe em `PublicFormPage.tsx` ja possui `allow-same-origin`, o que permite acesso ao `window.top` quando o formulario esta hospedado no mesmo dominio
- Para formularios em modo embed (dominio externo), sera adicionado um fallback com `window.parent.postMessage` caso `window.top` esteja bloqueado por restricoes de cross-origin

