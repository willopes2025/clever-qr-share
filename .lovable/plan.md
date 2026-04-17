
Objetivo: continuar a investigação com base no código e nos logs atuais e atacar o que ainda pode causar o looping.

Diagnóstico atualizado:
- Os logs disponíveis não apontam para uma queda geral do backend de autenticação:
  - há respostas `200` em `/user`;
  - a função `check-subscription` está autenticando usuários e retornando plano normalmente;
  - não apareceu evidência de 401 em cascata nem de falha geral do backend.
- Isso enfraquece a hipótese de “problema global da plataforma” como causa principal deste projeto.
- O padrão restante no código é outro: ainda existem muitos hooks e subsistemas autenticados disparando só com `!!user`, sem exigir `authReady + session.access_token`.
- Depois do login, a rota `/instances` já monta layout completo, sidebar, notificações, realtime e vários hooks que consultam banco/RLS cedo demais. Isso ainda pode gerar estado inconsistente e redirecionamento aparente em loop.

Pontos concretos encontrados:
- `useConversations`, `useUnreadCount`, `useProfile`, `NotificationProvider`, `useGlobalRealtime` e vários outros hooks ainda usam `enabled: !!user` ou `!!user?.id`.
- `DashboardLayout` e `MobileAppLayout` montam `ActivityTracker`, sidebars e componentes que puxam muitos hooks logo no primeiro render protegido.
- `Login.tsx` ainda manda direto para `/instances`, que é uma tela pesada para o primeiro render pós-login.
- Os logs do backend mostram usuários autenticados chegando até `check-subscription`, então o gargalo mais provável está no shell autenticado do app, não no login em si.

Plano de correção:
1. Criar um gate central único de sessão estável
- Consolidar em um sinal único, por exemplo `isAuthenticatedStable = authReady && !!user && !!session?.access_token`.
- Todo código autenticado passa a depender desse sinal, não apenas de `user`.

2. Adicionar uma rota/página de pós-login leve
- Em vez de mandar o usuário direto para `/instances`, criar um “bootstrap” pós-login.
- Essa página só espera a sessão estabilizar e então redireciona para a área interna.
- Isso evita montar sidebar, realtime e queries pesadas no mesmo frame do login.

3. Blindar o shell autenticado
- Fazer `AuthenticatedRoute`, `DashboardLayout` e `MobileAppLayout` só montarem sidebar, tracker, notificações e realtime quando a sessão estiver estável.
- Se não estiver estável: spinner único.
- Se estiver estável sem sessão: `/login`.
- Se estiver estável com sessão: liberar app.

4. Corrigir os hooks que ainda disparam cedo
- Trocar os casos críticos de `enabled: !!user` para `enabled: isAuthenticatedStable`, começando por:
  - `useConversations`
  - `useUnreadCount`
  - `useProfile`
  - `NotificationProvider`
  - `useGlobalRealtime`
  - hooks de badges/unread e demais hooks usados nas sidebars/layouts

5. Reduzir efeitos colaterais no primeiro render
- Evitar criação automática de perfil ou outras escritas logo no primeiro paint autenticado.
- Deixar o primeiro acesso protegido o mais passivo possível: validar sessão primeiro, carregar shell depois.

6. Instrumentar para fechar o diagnóstico
- Adicionar logs temporários na sequência:
  `signIn -> session set -> auth stable -> bootstrap ok -> shell montado -> hooks habilitados`
- Isso vai mostrar exatamente em que ponto o loop reaparece caso ainda exista.

Arquivos mais prováveis:
- `src/contexts/AuthContext.tsx`
- `src/pages/Login.tsx`
- `src/App.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/layouts/AppLayout.tsx`
- `src/components/DashboardLayout.tsx`
- `src/mobile/layouts/MobileAppLayout.tsx`
- `src/components/NotificationProvider.tsx`
- `src/hooks/useConversations.ts`
- `src/hooks/useUnreadCount.ts`
- `src/hooks/useProfile.ts`
- possivelmente outros hooks hoje habilitados apenas por `!!user`

Resultado esperado:
- o login deixa de cair diretamente numa tela pesada;
- o app só monta infraestrutura autenticada depois da sessão estar realmente pronta;
- some o looping visual entre login e área interna;
- se ainda restar problema, os logs temporários vão isolar o ponto exato em vez de continuar “às cegas”.
