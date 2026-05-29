## Objetivo

Na aba **Respostas** do formulário, permitir:
1. **Excluir** uma resposta → também exclui o cartão (lead/deal) gerado por ela.
2. **Editar** uma resposta → os campos editados também são atualizados no cartão do lead correspondente (ex.: Agendamento, Nome Completo, Condição do Exame, etc.).

Hoje a tabela `form_submissions` não guarda referência ao deal criado, então não há como saber qual cartão atualizar/excluir.

## Mudanças

### 1. Banco (`form_submissions`)
- Adicionar coluna `deal_id uuid` com FK para `funnel_deals(id) ON DELETE SET NULL`.
- Índice em `deal_id`.

### 2. Edge function `submit-form`
- Sempre que a submissão criar OU atualizar um `funnel_deals` (fluxo de `lookup_by_lead_number`, `target_funnel_id`, fallback de `lead fields`), gravar o `deal_id` resultante em `form_submissions.deal_id`.

### 3. Hook `useFormSubmissions`
- Adicionar `deleteSubmission(id)`: busca o `deal_id` da submission e, se existir, deleta o `funnel_deals` correspondente (cascata cuida das mensagens/atividades), depois deleta a `form_submissions`.
- Ajustar `updateSubmission(id, data)`: após atualizar a submissão, se houver `deal_id`, recalcular `custom_fields` do deal a partir dos campos do form com `mapping_type ∈ {lead_field, new_lead_field}` e fazer `UPDATE funnel_deals SET custom_fields = custom_fields || <novos>` no deal alvo. Campos com `mapping_type = contact_field` atualizam o `contacts` vinculado.

### 4. UI (`SubmissionsList.tsx` + `EditSubmissionDialog.tsx`)
- Nova coluna de ações na tabela com ícone de **lixeira** ao lado do lápis.
- Botão abre `AlertDialog` confirmando "Excluir resposta e o lead vinculado?".
- No diálogo de edição, exibir aviso curto: "As alterações também serão aplicadas ao cartão do lead vinculado."

## Detalhes técnicos

- A propagação no `updateSubmission` é feita no cliente lendo `form_fields` (já disponíveis em `SubmissionsList`) — passar `fields` para o hook ou para a função de update.
- Submissões antigas sem `deal_id` (criadas antes da migration) continuam funcionando: o delete só remove a submission; o update só altera os dados da submission. Isso é aceitável e não quebra nada.
- RLS já permite UPDATE/DELETE em `form_submissions` e `funnel_deals` para membros da organização.

Posso prosseguir?