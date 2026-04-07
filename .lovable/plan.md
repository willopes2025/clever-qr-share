

## Campanha de cobrança Asaas com filtro de período de vencimento

### O que será feito
Adicionar um fluxo simplificado para criar campanhas de cobrança direcionadas a clientes com faturas vencidas no Asaas, permitindo escolher um período de vencimento e um template Meta — sem precisar criar manualmente uma lista de transmissão.

### Alterações

**1. Expandir `FilterCriteria` no `useBroadcastLists.ts`**
- Adicionar campos `asaasDueDateFrom?: string` e `asaasDueDateTo?: string` à interface `FilterCriteria`
- Isso permite que listas dinâmicas filtrem por período de vencimento

**2. Atualizar `BroadcastListFormDialog.tsx`**
- Quando `asaasPaymentStatus` for `overdue` ou `pending`, mostrar dois campos de data: "Vencimento de" e "Vencimento até"
- Usar DatePicker do Shadcn para seleção das datas
- Salvar as datas no `filter_criteria` da lista

**3. Atualizar `sync-asaas-contacts` Edge Function**
- Receber parâmetros opcionais `dueDateFrom` e `dueDateTo` no body da requisição
- Adicionar filtros `dueDate[ge]` e `dueDate[le]` na query da API do Asaas ao buscar payments overdue/pending
- Isso garante que só clientes com faturas vencidas dentro do período selecionado sejam sincronizados

**4. Atualizar `start-campaign` Edge Function**
- Ao resolver contatos de uma lista dinâmica com filtro `asaasPaymentStatus` + datas, chamar `sync-asaas-contacts` passando `dueDateFrom`/`dueDateTo` antes de buscar os contatos
- Isso garante que os status estejam atualizados para o período correto no momento do disparo

**5. Atualizar `CampaignFormDialog.tsx`**
- Ao selecionar uma lista dinâmica que tenha filtro de cobrança Asaas, exibir um resumo informativo mostrando o período de vencimento configurado na lista

### Fluxo do usuário
1. Ir em Listas de Transmissão → Criar lista dinâmica
2. Selecionar filtro "Status de Pagamento: Vencido"
3. Definir período: ex. 01/04/2026 a 10/04/2026
4. Salvar a lista
5. Ir em Campanhas → Nova campanha
6. Selecionar Template Meta + número oficial
7. Selecionar a lista criada
8. Disparar

### Detalhes técnicos
- A API do Asaas suporta filtros `dueDate[ge]` e `dueDate[le]` no endpoint `/payments`
- O sync será chamado com esses parâmetros para filtrar apenas pagamentos no intervalo desejado
- As datas serão armazenadas como strings ISO no `filter_criteria` da broadcast list

### Arquivos envolvidos
- `src/hooks/useBroadcastLists.ts` — interface FilterCriteria
- `src/components/broadcasts/BroadcastListFormDialog.tsx` — campos de data
- `supabase/functions/sync-asaas-contacts/index.ts` — filtro por período
- `supabase/functions/start-campaign/index.ts` — passar datas na sincronização pré-disparo

