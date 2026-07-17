# Plano de Otimização de Performance — Faseado

Objetivo: reduzir latência percebida no frontend e carga no banco. Executamos uma fase por vez, medimos e seguimos.

## Fase 1 — Ganhos rápidos no banco (baixo risco, alto impacto)
1. Rodar `supabase--slow_queries` e `supabase--linter` para identificar as 10 queries mais custosas e políticas RLS ineficientes.
2. Adicionar índices faltantes nas colunas mais filtradas/ordenadas:
   - `inbox_messages(conversation_id, created_at DESC)` — já existe? confirmar.
   - `funnel_deals(user_id, stage_id)`, `funnel_deals(contact_id)`.
   - `billing_reminders(scheduled_for, status)` parcial `WHERE status='pending'`.
   - `email_messages(thread_id, created_at)`.
3. `ANALYZE` nas tabelas grandes após criar índices.
4. Consolidar policies RLS duplicadas usando `(select auth.uid())` para cache InitPlan onde ainda não foi feito.

## Fase 2 — Reduzir round-trips no Inbox
1. Converter `useUnreadCount` de fetch multi-etapa (conversations → contacts chunked → warming) para uma única RPC `get_unread_count()` SECURITY DEFINER que devolve o número final.
2. Mesclar `notification-only` + `warming phones` num único fetch cacheado por 5 min via `staleTime`.
3. Deduplicar realtime: hoje `useGlobalRealtime` já otimiza, mas `funnel_deals` invalida 5 chaves — restringir a mudanças que realmente afetam a tela atual.

## Fase 3 — Paginação e virtualização
1. Trocar carregamentos "top 200" (Inbox) por paginação infinita real com `useInfiniteQuery`.
2. Virtualizar listas longas (Inbox, Contatos, Broadcast) com `@tanstack/react-virtual` — só renderizar linhas visíveis.
3. Aplicar `React.memo` + `useMemo` em `ConversationListItem` e `ContactCard`.

## Fase 4 — Bundle e carregamento inicial
1. Auditar `dist` com `rollup-plugin-visualizer` e identificar libs pesadas.
2. Lazy-load rotas ainda carregadas eager (Analysis, Warming, Chatbots, AIAgents, Ssotica, Financeiro).
3. Code-split de bibliotecas pesadas (recharts, editor rich text, mapas) via `import()` dinâmico.
4. Pré-carregar apenas a rota "/" e Inbox; resto sob demanda.

## Fase 5 — Realtime e assinaturas
1. Auditar todos `supabase.channel(...)` para garantir cleanup e evitar duplicações.
2. Consolidar canais por página em vez de por componente.
3. Debounce de invalidações do React Query (agrupar bursts de eventos em 250 ms).

## Fase 6 — Cache e prefetch
1. Aumentar `staleTime` de queries estáveis (funnels, tags, custom fields, task types) para 5–10 min.
2. `prefetchQuery` de dados prováveis (ex.: ao passar mouse em conversa, pré-buscar mensagens).
3. Persistir cache do React Query em `localStorage` para navegação entre sessões.

## Fase 7 — Edge Functions
1. Revisar funções chamadas por request do usuário — mover trabalho pesado para `EdgeRuntime.waitUntil`.
2. Cache HTTP (`Cache-Control`) em endpoints idempotentes de leitura.
3. Reduzir cold-starts consolidando funções pouco usadas.

## Fase 8 — Compute / infra (último recurso)
Só depois das fases 1–7: avaliar `db_health`; se memória/conexões seguirem saturadas, propor resize via `resize_compute`.

## Execução
Fazemos uma fase por turno: eu implemento, você valida percepção de velocidade, e passamos para a próxima. Começo pela Fase 1 assim que aprovar.
