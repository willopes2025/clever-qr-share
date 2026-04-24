# Atualização instantânea ao editar dados do lead

## Problema

Quando você edita um campo do lead (título, valor, ou campos personalizados de lead/contato) no painel lateral do Inbox ou no Kanban, o valor é salvo no banco mas o painel exibe o valor antigo até apertar F5. O motivo é que as mutations de salvamento invalidam apenas algumas chaves de cache do React Query, deixando outras (que alimentam o painel) com dados desatualizados.

Especificamente:
- O painel lateral lê os dados via a query `['contact-deal', contactId]` (`useContactDeal`).
- As mutations atuais invalidam apenas `['funnels']` e `['funnel-deals']`, **nunca** `['contact-deal']`.
- O mesmo acontece com edições de nome/campos do contato (não invalidam `['contact-deal']` nem `['funnels']`).

## Mudanças

### 1. `src/hooks/useCustomFields.ts`
- Em `updateDealCustomFields.onSuccess`: adicionar `invalidateQueries({ queryKey: ['contact-deal'] })`.
- Em `updateContactCustomFields.onSuccess`: adicionar `invalidateQueries({ queryKey: ['contact-deal'] })` e `invalidateQueries({ queryKey: ['funnels'] })` (o Kanban exibe nome/campos do contato no card).

### 2. `src/components/inbox/lead-panel/LeadFieldsSection.tsx`
- Em `handleSaveTitle` e `handleSaveValue`: adicionar `invalidateQueries({ queryKey: ['contact-deal'] })` para refletir alterações imediatamente no painel.
- Aplicar atualização otimista local imediata em `localTitle`/`localValue` (já feito), mas garantir que a invalidação dispare também `['conversations']` (o título do deal aparece no header do painel via `LeadPanelHeader`).

### 3. `src/components/inbox/lead-panel/ContactFieldsSection.tsx`
- Em `handleSaveName` (edição do nome do contato): além de invalidar `contacts`/`conversations`, invalidar `['contact-deal']` e `['funnels']` para que o cartão e o painel reflitam o novo nome sem F5.

### 4. (Opcional, mas recomendado) Atualização otimista do cache `contact-deal`
Para feedback ainda mais instantâneo (sem aguardar refetch), na mutation `updateDealCustomFields` podemos aplicar um `setQueryData` otimista que mescla `customFields` no cache `['contact-deal', contactId]` antes do servidor responder. Isso elimina o "flicker" entre clicar e ver o valor novo.

## Resultado esperado

- Editar título, valor ou qualquer campo personalizado do lead atualiza o painel lateral instantaneamente.
- Editar o nome ou campos personalizados do contato também atualiza o painel e o card no Kanban sem reload.
- Nenhuma necessidade de F5.

Posso aplicar?