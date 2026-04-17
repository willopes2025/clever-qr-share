
Objetivo: eliminar o looping infinito de login em todos os ambientes atacando o problema pela raiz, não só o `signOut()` do plano anterior.

Diagnóstico mais provável:
- O app ainda tem várias consultas/automações autenticadas disparando cedo demais no primeiro render pós-login.
- Hoje `AuthProvider` e `SubscriptionProvider` envolvem o app inteiro em `App.tsx`, inclusive rotas públicas.
- Após o login, várias partes dependentes de auth podem montar quase ao mesmo tempo:
  - `SubscriptionContext.checkSubscription()`
  - `useOrganization()` / `PermissionGate`
  - layouts laterais/mobile que usam `useOrganization`, `useAdmin`, `useConversations`, `useActivitySession`
- Essas queries ainda são habilitadas principalmente por `user?.id`, não por um estado forte de “auth realmente pronto + token disponível”.
- Isso combina com o padrão clássico de hidratação parcial de sessão: o usuário existe/está mudando, mas o token ainda não está estável para todas as queries RLS/edge functions.

Plano de implementação:
1. Fortalecer o estado global de auth
- Expandir `AuthContext` para expor um sinal explícito de prontidão, algo como `initialized` / `authReady`.
- Considerar auth pronto só quando a sessão inicial tiver sido resolvida de forma definitiva.
- Evitar qualquer lógica assíncrona extra dentro de `onAuthStateChange`.

2. Travar queries autenticadas até auth estar realmente pronto
- Atualizar hooks críticos para usar `enabled: authReady && !!user && !!session?.access_token`:
  - `useOrganization`
  - `useAdmin`
  - `useActivitySession`
  - hooks de navegação/layout que dependem de tabelas com RLS
- Onde houver `supabase.from(...)` ou `rpc(...)` iniciado só por `user?.id`, trocar para depender de `authReady`.

3. Parar de inicializar assinatura em rotas públicas
- Tirar `SubscriptionProvider` do escopo global e movê-lo para a área protegida, ou
- manter global, mas deixá-lo completamente inerte enquanto não estiver em área autenticada e com `authReady`.
- Isso reduz chamadas prematuras para `check-subscription` no handshake.

4. Blindar guards e telas de entrada
- `ProtectedRoute` deve esperar `authReady`, não apenas `loading`.
- `Login.tsx` deve navegar somente quando `authReady && user && session`.
- Se o login for bem-sucedido mas a sessão ainda estiver hidratando, mostrar loading curto em vez de navegar/voltar.

5. Remover loaders infinitos causados por dependências circulares
- Revisar `PermissionGate` + `useOrganization` para não prender a tela em loading se a query nem deveria rodar ainda.
- Garantir fallback controlado:
  - auth não pronto => spinner
  - auth pronto sem usuário => `/login`
  - auth pronto com usuário, mas query falhou => erro claro, não loop

6. Instrumentar diagnóstico temporário
- Adicionar logs de frontend em pontos-chave:
  - auth inicializado
  - signIn sucesso
  - session disponível
  - ProtectedRoute liberou/bloqueou
  - useOrganization iniciou/finalizou
  - check-subscription iniciou/finalizou
- Isso permite confirmar se o loop é:
  - redirect prematuro
  - query RLS cedo demais
  - falha de token no primeiro render

Validação após aplicar:
- Testar login por senha em `zap.wideic.com`, publicado e preview.
- Confirmar sequência esperada:
  ```text
  signIn -> authReady=true -> session ok -> route protegida -> queries habilitadas
  ```
- Verificar que aparecem requests reais de login e que não há retorno imediato para `/login`.
- Testar desktop e mobile.

Arquivos mais prováveis de ajuste:
- `src/contexts/AuthContext.tsx`
- `src/contexts/SubscriptionContext.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/pages/Login.tsx`
- `src/hooks/useOrganization.ts`
- `src/hooks/useAdmin.ts`
- `src/hooks/useActivitySession.ts`
- possivelmente `src/App.tsx` para reescopo do `SubscriptionProvider`

Detalhes técnicos:
- O problema atual parece menos “credencial inválida” e mais “queries autenticadas disparando antes da sessão estar estável”.
- O código já melhorou o logout forçado, mas ainda não centralizou um `authReady` forte para todo o app.
- Sem esse gate único, cada hook tenta adivinhar sozinho quando a auth está pronta, e isso costuma gerar loop/intermitência.
