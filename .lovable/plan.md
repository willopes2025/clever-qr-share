## Problema

Na `analyze-funnel-opportunities`, dois bugs fazem a análise não respeitar as configurações:

### 1. Leads sem resposta entram como "respondidos"
O filtro de "lead com conversa no período" usa `conversations.last_message_at >= sinceDate`. Mas `last_message_at` é atualizado para qualquer direção — inclusive mensagens que o **vendedor** enviou. Resultado: um lead onde só o vendedor mandou mensagem (sem nenhuma resposta) é classificado como `prioritizedDeals` (com conversa) e analisado como se tivesse interagido. Não existe nenhuma checagem de `direction = 'inbound'`.

### 2. Período configurado não é aplicado ao deal
- O scan de deals em `funnel_deals` é ordenado por `created_at desc` sobre **todos** os abertos do funil (até 20 páginas × 1000), sem nenhum corte por `opportunity_message_days`. Então deals antiquíssimos sem qualquer atividade entram na pool quando `includeNoConversation` está ligado.
- Mesmo quando `includeNoConversation = false`, a checagem (`messages.length > 0`) só olha o array de mensagens (limitado a 40 últimas) mas como o `last_message_at` recente já marcou a conversa como elegível, deals sem resposta inbound passam.

### 3. Rótulo de direção errado
No `dealsContext`, o código compara `message.direction === "outgoing"`, mas o banco usa `outbound`/`inbound`. Todas as mensagens vão pra IA rotuladas como `[Cliente]`, distorcendo o score.

---

## Correção (arquivo único: `supabase/functions/analyze-funnel-opportunities/index.ts`)

1. **Substituir a checagem de "conversa recente" por "resposta inbound recente"**
   - Em vez de buscar `conversations` por `last_message_at`, buscar `inbox_messages` com `direction = 'inbound'` e `created_at >= sinceDate` para os `contact_id` da página.
   - Construir `contactsWithReply: Set<contactId>` e `contactConversationMap` a partir desse resultado (conversation_id da mensagem inbound mais recente).
   - Deal vai para `prioritizedDeals` somente se o contato respondeu no período. Caso contrário, `fallbackDeals`.

2. **Aplicar o período ao deal quando `includeNoConversation = false`**
   - Quando `includeNoConversation` for `false`: ignorar `fallbackDeals` por completo (já é hoje, mas reforçar) e exigir `messages.filter(m => m.direction === 'inbound').length > 0` em `analyzableDeals`.
   - Adicional: descartar deals cujo `created_at < sinceDate` E sem resposta no período, evitando leads antigos abandonados.

3. **Corrigir rótulo de direção**
   - `message.direction === 'outbound' ? 'Vendedor' : 'Cliente'`.

4. **Log adicional** com contagens de `withReply` vs `withoutReply` para confirmar comportamento.

Nenhuma mudança de schema, UI ou outras edge functions. Após o deploy, a próxima análise vai considerar somente leads que efetivamente responderam dentro de `opportunity_message_days` (e respeitar o toggle de "incluir sem conversa").