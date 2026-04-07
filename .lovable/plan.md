

## Diagnóstico

A automação "Transferir lead" (`on_scheduled_before_date_field` → `move_stage`) está sendo **detectada e registrada** no log de execução, mas o deal **nunca é movido de etapa**.

### Causa Raiz

O fluxo é:
1. `process-scheduled-automations` detecta o gatilho temporal e chama `process-funnel-automations` passando `{ dealId, triggerType: 'on_scheduled_before_date_field' }`
2. `process-funnel-automations` busca as automações correspondentes e, no loop de processamento (linha 151-164), verifica se a automação tem `stage_id` definido
3. Como a automação TEM `stage_id` (etapa "Pré-venda"), e o trigger NÃO é `on_message_received` nem `on_funnel_enter`, o código entra no bloco `else` (linha 158-163) que compara `automation.stage_id` contra `toStageId` e `fromStageId`
4. **Problema**: `toStageId` e `fromStageId` são `undefined` (não enviados pelo scheduled trigger), então a condição `automation.stage_id !== undefined` é SEMPRE verdadeira → **automação é SEMPRE ignorada (skip)**

O log de execução em `automation_execution_log` é gravado pelo `process-scheduled-automations` ANTES de verificar se a ação foi realmente executada, o que mascara o bug.

### Plano de Correção

**Arquivo**: `supabase/functions/process-funnel-automations/index.ts`

1. Adicionar os gatilhos agendados (`on_scheduled_before_date_field`, `on_scheduled_exact_time`, `on_scheduled_daily`, `on_hours_after_last_message`) à lista de triggers que devem comparar com o `deal.stage_id` atual (assim como os message triggers), em vez de comparar com `toStageId`/`fromStageId`:

```typescript
const isScheduledTrigger = [
  'on_scheduled_before_date_field',
  'on_scheduled_exact_time', 
  'on_scheduled_daily',
  'on_hours_after_last_message'
].includes(automation.trigger_type);

if (automation.stage_id && !isFunnelEnterTrigger) {
  if (isMessageTrigger || isScheduledTrigger) {
    // For message/scheduled triggers, check deal's CURRENT stage
    if (automation.stage_id !== deal.stage_id) {
      continue;
    }
  } else {
    // For stage-change triggers, check toStageId/fromStageId
    if (automation.stage_id !== toStageId && automation.stage_id !== fromStageId) {
      continue;
    }
  }
}
```

2. **Mover o log de execução** em `process-scheduled-automations` para DEPOIS da chamada bem-sucedida (já está assim — o problema é só o filtro de stage acima). Basta corrigir a lógica de stage matching.

**Deploy**: Redesplegar a edge function `process-funnel-automations`.

### Resultado Esperado

Automações agendadas com `stage_id` definido passarão a verificar corretamente se o deal está na etapa correta usando `deal.stage_id`, permitindo que a ação `move_stage` execute de fato.

