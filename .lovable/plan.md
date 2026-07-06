## Auditoria + correções em uma leva

Varredura completa gerou 16 achados. Vou aplicar todos (Alta → Baixa), agrupados por tipo de mudança pra minimizar risco de regressão.

---

## Fase 1 — Performance (impacto imediato)

### 1.1 Hoist `NotificationProvider` acima das rotas (H1 + M6)
- `src/App.tsx`: mover `<NotificationProvider>` pra englobar `<Routes>` uma única vez em vez de encapsular cada rota. Elimina ~25 canais Realtime duplicados e observers de `useUnreadCount` que hoje são criados/destruídos a cada navegação.
- Manter dentro do `<ProtectedRoute>` conceitual: renderizar só quando `user` existe (guard interno no provider).

### 1.2 Memoizar valores de contextos (H2 + L2)
- `src/contexts/AuthContext.tsx:91` → envolver o `value` do provider em `useMemo` dependente de `[user, session, loading]`. Funções `signIn/signUp/signOut/signInWithGoogle` viram `useCallback`.
- `src/contexts/SidebarContext.tsx:94` → mesmo tratamento com deps `[isCollapsed, isMobileOpen, isMobile]`.

### 1.3 Virtualização das listas grandes (H3 + M1 + L1)
- Instalar `@tanstack/react-virtual`.
- `src/components/inbox/ConversationList.tsx`: virtualizar a lista dentro do `ScrollArea` (item height estimado + `overscan: 8`).
- `src/pages/Contacts.tsx`: virtualizar as linhas da tabela paginada (mantém a paginação client existente, só evita repintar 500+ linhas).
- `src/components/funnels/FunnelKanbanView.tsx`: virtualização por coluna de deals quando > 40 cards na coluna.

### 1.4 `WhatsNewDialog` fora do shell público (M4)
- `src/App.tsx:78-79`: mover `<WhatsNewDialog />` pra dentro do layout autenticado (após `<ProtectedRoute>`) pra não consultar Supabase em `/`, `/login`, políticas de privacidade etc.
- `TimezoneBootstrap` permanece — depende de `user` mas é barato; adicionar early-return se `!user`.

### 1.5 `staleTime` do React Query nas rotas realtime (L3)
- `src/hooks/useConversations.ts` (e mensagens): setar `staleTime: 0` já que o canal Realtime é fonte de verdade — evita servir dados velhos por até 5 min se o canal cair.

---

## Fase 2 — Consistência visual e UI obsoleta

### 2.1 Tokens do design system (M2)
Trocar cores hardcoded por tokens semânticos:
- `src/components/dashboard/customizable/EmptyDashboardState.tsx:28` → `bg-primary text-primary-foreground`.
- `src/components/settings/meta-official/WhatsAppConnectButton.tsx:86` → criar variante local `--whatsapp-gradient` em `index.css` e usar.
- `src/components/instances/InstancesListView.tsx:115` → `bg-accent text-accent-foreground`.
- `src/components/settings/MetaSocialSettings.tsx:80` → token `--facebook-gradient`.

### 2.2 Locale de datas unificado (M5)
- Criar `src/lib/dateLocale.ts` exportando `ptBR` + helper `formatBR(date, pattern)`.
- Refatorar chamadas `format(...)` sem locale em `src/lib/date-utils.ts` e demais consumidores pra usar o helper.

### 2.3 Navegação unificada mobile/desktop (H4 + L4)
- Criar `src/config/navGroups.ts` como fonte única (labels dos grupos, itens, `restrictedToEmails`, `dynamicNavGroups`).
- `DashboardSidebar.tsx` e `MobileSidebarDrawer.tsx` passam a importar dessa fonte. Mobile ganha os itens ausentes (Formulários, Agentes IA, Webhooks, Treinamentos) e a lógica de `restrictedToEmails`.

### 2.4 Limpeza de UI obsoleta
- Durante o refactor do `navGroups`, identifico entradas mortas/duplicadas e removo.
- Se aparecerem botões sem handler ou com "TODO" no caminho, sinalizo no relatório final e removo caso claramente inertes.

---

## Fase 3 — Acessibilidade (H5)

Adicionar `<DialogDescription className="sr-only">` logo após `<DialogTitle>` em:
- `src/components/SupportButton.tsx:116`
- `src/pages/Tasks.tsx:352`
- `src/components/analysis/BuyerReportsTab.tsx:195`
- `src/components/dynamic-reports/DynamicReportDialog.tsx:174`
- `src/components/webhooks/WebhookLogsTable.tsx:67`
- `src/components/contacts/BulkTagDialog.tsx:54`
- `src/components/ai-agents/AgentMediaLibraryTab.tsx:187`

Elimina os warnings recorrentes do console e cumpre WCAG.

---

## Fase 4 — Higiene de código (M3 + L5)

Substituir `console.log` de produção por `if (import.meta.env.DEV)` em:
- `src/contexts/SubscriptionContext.tsx:86`
- `src/hooks/useFacebookLogin.ts:82,90,92,141,146`
- `src/hooks/useSsotica.ts:119`
- `src/hooks/useElevenLabsConversation.ts:49,54,58,97`
- `src/hooks/useDealTasks.ts:35`, `src/hooks/useConversationTasks.ts:39`
- `src/components/funnels/OpportunityBroadcastDialog.tsx:247`
- `src/components/funnels/AutomationFormDialog.tsx:421`

Reduz ruído no console em produção e evita vazamento de dados operacionais.

---

## Fora do escopo
- Não mexo em regras de negócio, RLS, edge functions, nem no schema.
- Não redesenho páginas — só ajusto tokens e primitivos.
- Bugs funcionais não relatados nesta auditoria ficam pra ticket separado.

## Riscos e mitigação
- Virtualização pode quebrar animações do Kanban: valido rolando visualmente após aplicar.
- Hoist do NotificationProvider muda ordem de mount: valido que badges/toasts continuam funcionando após navegar por 3-4 rotas.
- Unificação dos navGroups: valido que sidebar desktop e mobile mostram os mesmos itens visíveis pro usuário logado.

Ao final entrego um resumo do que foi aplicado por fase.
