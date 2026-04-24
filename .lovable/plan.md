## Objetivo

Hoje o switch "Campo obrigatório" é global — ou o campo é obrigatório em todos os lugares ou em nenhum. Você precisa que ele seja obrigatório **apenas a partir de uma etapa específica de um funil específico**.

Exemplo do seu caso: no funil "Centro de Saúde Visual", o campo "Data da consulta" só passa a ser obrigatório quando o lead é movido para a etapa "Exame agendado" (ou qualquer etapa posterior). Antes dela, o campo continua opcional.

---

## Como vai funcionar (visão do usuário)

### 1. Configurar a obrigatoriedade
No gerenciador de campos personalizados (botão **"Campos"** no Funil), ao editar um campo do tipo **Lead**, além do switch "Campo obrigatório" atual aparecerá uma nova seção:

> **Regras de obrigatoriedade por etapa**  
> [+ Adicionar regra]

Cada regra terá:
- **Funil** (select) — qual funil
- **A partir da etapa** (select com as etapas do funil escolhido, em ordem)

Você pode adicionar várias regras (ex.: obrigatório a partir de "Exame agendado" no funil de Saúde Visual **e** a partir de "Proposta enviada" no funil Comercial).

### 2. Validação ao mover o lead
Quando o usuário tentar mover um lead para uma etapa onde o campo se tornou obrigatório (via drag-and-drop no Kanban, dropdown na Lista, ou edição no formulário do deal):

- Se o valor estiver preenchido → move normalmente
- Se estiver vazio → bloqueia, mostra um diálogo "Preencha os campos obrigatórios para esta etapa" listando os campos faltantes, com inputs inline para preencher e botão **"Preencher e mover"**

Vai funcionar nos 3 fluxos: Kanban (drag), Lista (dropdown da etapa) e DealFormDialog (salvar).

### 3. Indicação visual
- No editor de campos do lead (`DealCustomFieldsEditor`), o asterisco vermelho aparece dinamicamente baseado na etapa atual do deal
- O switch global "Campo obrigatório" continua existindo (= obrigatório sempre, em todos os funis) e tem precedência

---

## Detalhes técnicos

### Migração de banco
Nova tabela:
```sql
CREATE TABLE custom_field_required_rules (
  id uuid PK,
  field_definition_id uuid REFERENCES custom_field_definitions ON DELETE CASCADE,
  funnel_id uuid REFERENCES funnels ON DELETE CASCADE,
  from_stage_id uuid REFERENCES funnel_stages ON DELETE CASCADE,
  -- "from_stage_id" = a partir desta etapa em diante (usa display_order da etapa)
  user_id uuid,
  created_at timestamptz default now(),
  UNIQUE(field_definition_id, funnel_id)
);
```
RLS espelhando as policies de `custom_field_definitions` (owner + membros da org).

Nova função `is_field_required_at_stage(field_id, funnel_id, stage_id)` para resolver server-side se necessário (opcional; validação principal será client-side para UX rápida).

### Frontend
- **Novo hook** `useFieldRequiredRules.ts`: CRUD das regras por campo
- **`CustomFieldsManager.tsx`**: nova seção "Regras de obrigatoriedade por etapa" no editor de cada campo do tipo Lead (lista de regras + adicionar/remover)
- **Novo helper** `getRequiredFieldsForStage(stageId, funnelId, fieldDefs, rules)`: retorna lista de field_keys obrigatórios para uma etapa específica (considera display_order ≥ from_stage)
- **Novo componente** `RequiredFieldsCheckDialog.tsx`: modal de bloqueio que lista campos faltantes com inputs inline e botão "Preencher e mover"
- **`FunnelKanbanView.tsx`** (linha 84): antes de `updateDeal.mutate`, validar e abrir o dialog se faltar algo
- **`FunnelListView.tsx`** (linhas 752, 1341): mesma validação no dropdown de mudança de etapa e no menu de contexto
- **`DealFormDialog.tsx`**: validar no submit quando `selectedStageId` for diferente de `deal.stage_id`
- **`DealCustomFieldsEditor.tsx`**: aceitar prop `currentStageId` e `funnelId` para mostrar asterisco condicional

### Arquivos afetados
- Nova migration SQL (criar tabela + RLS)
- `src/hooks/useFieldRequiredRules.ts` (novo)
- `src/lib/required-fields.ts` (novo helper)
- `src/components/funnels/RequiredFieldsCheckDialog.tsx` (novo)
- `src/components/inbox/CustomFieldsManager.tsx`
- `src/components/funnels/DealCustomFieldsEditor.tsx`
- `src/components/funnels/FunnelKanbanView.tsx`
- `src/components/funnels/FunnelListView.tsx`
- `src/components/funnels/DealFormDialog.tsx`

---

## Pontos de atenção

1. **Compatibilidade**: o switch global `is_required` continua funcionando como hoje. As regras por etapa são **adicionais** e só se aplicam quando configuradas. Nenhum dado existente é afetado.
2. **Campos de Contato** vs **Campos de Lead**: regras por etapa só fazem sentido para campos do tipo **Lead** (que vivem dentro do funil). Para campos do tipo Contato, a seção fica oculta.
3. **Ordem das etapas**: "a partir de X" usa o `display_order` da etapa. Se o usuário reordenar etapas depois, a regra continua apontando para a etapa pelo ID, então a faixa de obrigatoriedade acompanha a nova ordem automaticamente.
4. **Etapas finais (won/lost)**: serão incluídas na obrigatoriedade se estiverem após a etapa-gatilho na ordem do funil — comportamento esperado, pois normalmente você quer dados completos antes de fechar.

Posso aplicar?