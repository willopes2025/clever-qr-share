# Unificação completa de leads (campos + conversas)

## Situação atual

O diálogo **"Unir Leads"** (`MergeDealsDialog` + `useMergeDeals`) já permite:
- Escolher o lead **principal** (mantém ID e histórico).
- Selecionar, **campo a campo**, de qual lead vem o valor final (título, valor, responsável, campos personalizados do lead e do contato).
- Mesclar tags e notas dos contatos.
- Migrar referências (chatbot_executions, automation_execution_log, calendly_events) e excluir os secundários.

**O que falta:** as conversas dos leads secundários **não são unificadas** na conversa do lead principal. Cada `funnel_deal` aponta para um `conversation_id` próprio, então após a união as mensagens dos cards secundários ficam órfãs (o deal foi excluído, mas a conversa e o contato continuam separados na Inbox).

## O que será feito

### 1. Backend de união (`src/hooks/useMergeDeals.ts`)
Adicionar uma nova etapa **antes** de excluir os deals secundários: para cada deal secundário com `conversation_id` diferente do principal, mover **tudo** para a conversa do lead principal — reusando exatamente a mesma lógica já validada em `useConversationActions.mergeConversations`:

- `inbox_messages` → conversation_id do principal (com verificação de contagem para não perder histórico).
- `conversation_notes`, `conversation_tasks`, `voip_calls`, `ai_phone_calls` → mesma migração.
- `conversation_tag_assignments` → deduplicar tags já existentes.
- `funnel_deals.conversation_id` → apontar para a conversa principal (caso outros deals usem a secundária).
- Marcar a conversa secundária como `status='archived'` (não excluir, para preservar logs/auditoria).

Novo parâmetro no payload:
```ts
mergeConversations: boolean // default true
```

### 2. UI (`src/components/funnels/MergeDealsDialog.tsx`)
- Adicionar nova opção na seção **"4. Opções adicionais"**:
  - ☑ **Unificar conversas** (default: ligado)
  - Texto: *"Move todas as mensagens, notas, tarefas e chamadas dos leads secundários para a conversa do lead principal. As conversas secundárias serão arquivadas."*
- Mostrar um aviso visual indicando quantas conversas distintas serão mescladas (contar `conversation_id` únicos entre os deals selecionados).

### 3. Garantias / segurança
- A verificação de `beforeCount` vs `remainingCount` em `inbox_messages` (já existente em `mergeConversations`) será replicada para abortar se RLS impedir a movimentação — assim nenhum histórico se perde silenciosamente.
- Ordem da operação: **mover conversas → mover refs → atualizar campos → excluir deals secundários**. Se a unificação de conversas falhar, a transação para antes de excluir nada.
- Invalidar caches: `conversations`, `inbox-messages`, `funnel-deals`, `funnels`, `contacts`.

## Detalhes técnicos

```text
useMergeDeals (novo fluxo)
├── 1. valida master + stage
├── 2. atualiza campos do master (já existe)
├── 3. mescla custom_fields do contato (já existe)
├── 4. NOVO: para cada conversation_id secundário ≠ master:
│      ├─ move inbox_messages (com verificação)
│      ├─ move notes, tasks, voip_calls, ai_phone_calls
│      ├─ deduplica e move tag_assignments
│      ├─ aponta outros funnel_deals.conversation_id → master
│      └─ archives a conversa antiga
├── 5. migra chatbot_executions/automation_logs/calendly (já existe)
├── 6. mescla tags e notes dos contatos secundários (já existe)
└── 7. exclui deals secundários (já existe)
```

Arquivos a alterar:
- `src/hooks/useMergeDeals.ts` — adicionar etapa 4 e parâmetro `mergeConversations`.
- `src/components/funnels/MergeDealsDialog.tsx` — checkbox + contador de conversas únicas + passar flag.

Nenhuma migração de banco é necessária (todas as colunas já existem).

## Resultado esperado
Após confirmar a união:
- 1 lead único com os campos escolhidos por você campo-a-campo.
- 1 conversa única contendo **todas** as mensagens dos cards originais, em ordem cronológica.
- Conversas antigas arquivadas (recuperáveis se preciso).
