
# Plano: Corrigir Exclusão de Leads na Retomada de Campanhas

## Problema Identificado

O usuário Matheus Suave está enfrentando um problema onde contatos que já receberam um template específico estão recebendo novamente, mesmo com a opção "Mesmo Template" selecionada como critério de exclusão.

### Causa Raiz

A função `resume-campaign` **NÃO implementa lógica de exclusão**. Quando uma campanha é retomada:

1. A função apenas conta mensagens `queued` e `sending`
2. Reseta mensagens travadas (`sending` → `queued`)
3. Envia TODAS as mensagens pendentes sem verificar exclusões

**Isso significa que:**
- Ao retomar uma campanha cancelada, TODOS os 1436 contatos na fila receberão mensagens
- Mesmo que alguns desses contatos já tenham recebido o mesmo template via outra campanha, eles não serão excluídos
- A lógica de exclusão só é aplicada no `start-campaign`, não no `resume-campaign`

### Evidência nos Logs

```
15:12:26 - Filtered out 0 contacts (checked 0 records)
15:12:28 - Created 1437 message records
15:12:41 - 1 mensagem enviada
15:13:11 - Campanha cancelada
```

Quando a campanha foi iniciada pela primeira vez, não havia mensagens anteriores. Porém, ao retomar, as mensagens já enviadas deveriam ser consideradas.

---

## Solução Proposta

Adicionar lógica de exclusão na função `resume-campaign` para remover mensagens `queued` de contatos que já receberam mensagens conforme as regras de exclusão.

### Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/resume-campaign/index.ts` | Adicionar lógica de exclusão antes de retomar |

---

## Detalhes Técnicos

### Nova Lógica para `resume-campaign`

```typescript
// 1. Buscar configurações de exclusão da campanha
const skipMode = campaign.skip_mode || 'same_template';
const skipDaysPeriod = campaign.skip_days_period || 30;
const skipAlreadySent = campaign.skip_already_sent !== false;

if (skipAlreadySent) {
  // 2. Calcular período
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - skipDaysPeriod);
  const periodStartISO = periodStart.toISOString();

  // 3. Buscar campanhas relevantes baseado no skip_mode
  let campaignIdsToCheck: string[] = [];
  
  if (skipMode === 'same_campaign') {
    campaignIdsToCheck = [campaignId];
  } else if (skipMode === 'same_template' && campaign.template_id) {
    const { data: sameTemplateCampaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('template_id', campaign.template_id);
    campaignIdsToCheck = sameTemplateCampaigns?.map(c => c.id) || [];
  } else if (skipMode === 'same_list' && campaign.list_id) {
    const { data: sameListCampaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('list_id', campaign.list_id);
    campaignIdsToCheck = sameListCampaigns?.map(c => c.id) || [];
  } else if (skipMode === 'any_campaign') {
    const { data: userCampaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('user_id', campaign.user_id);
    campaignIdsToCheck = userCampaigns?.map(c => c.id) || [];
  }

  // 4. Buscar contatos que já receberam mensagens (com paginação)
  let allAlreadySentIds: string[] = [];
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('campaign_messages')
      .select('contact_id')
      .in('status', ['sent', 'delivered'])
      .gte('sent_at', periodStartISO)
      .range(offset, offset + pageSize - 1);

    if (campaignIdsToCheck.length > 0) {
      query = query.in('campaign_id', campaignIdsToCheck);
    }

    const { data: batch } = await query;
    if (batch && batch.length > 0) {
      allAlreadySentIds.push(...batch.map(m => m.contact_id));
      offset += pageSize;
      hasMore = batch.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  // 5. Marcar mensagens desses contatos como 'skipped' (excluídas)
  if (allAlreadySentIds.length > 0) {
    const alreadySentIds = [...new Set(allAlreadySentIds)];
    
    const { count: skippedCount } = await supabase
      .from('campaign_messages')
      .update({ status: 'skipped' })
      .eq('campaign_id', campaignId)
      .eq('status', 'queued')
      .in('contact_id', alreadySentIds)
      .select('id', { count: 'exact', head: true });

    console.log(`Excluded ${skippedCount || 0} contacts based on ${skipMode} rule`);
  }
}
```

### Fluxo Atualizado

```
Campanha Retomada (resume-campaign)
     |
     v
[Verificar skip_already_sent] --> Exclusões ativadas?
     |                                    |
     | Sim                                | Não
     v                                    v
[Buscar campanhas por skip_mode]    [Continuar normalmente]
     |
     v
[Buscar contact_ids já enviados]
     |
     v
[Marcar queued → skipped para esses contatos]
     |
     v
[Contar mensagens pendentes restantes]
     |
     v
[Chamar send-campaign-messages]
```

---

## Considerações de Implementação

### Tratamento para Grandes Volumes

- A lógica usa paginação para buscar IDs de contatos já enviados
- Atualização em batch para marcar mensagens como `skipped`
- Para volumes muito grandes (>10k contatos para excluir), pode ser necessário chunkar as atualizações

### Status `skipped`

Criaremos um novo status `skipped` para mensagens excluídas por regras de exclusão:
- Permite distinguir entre mensagens que falharam vs. mensagens excluídas intencionalmente
- Mantém histórico para auditoria
- Não conta como "falha" na campanha

### Atualização de Contadores

Após excluir mensagens:
- Atualizar `total_contacts` da campanha para refletir apenas os que serão enviados
- Ou manter o total original e adicionar um campo `skipped_contacts`

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Retomar envia para TODOS os queued | Retomar aplica regras de exclusão |
| Contatos duplicados recebem mensagem | Contatos já enviados são marcados como skipped |
| Log: "0 contacts filtered" (nunca filtrava) | Log: "X contacts excluded by same_template rule" |

## Arquivos a Criar/Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `supabase/functions/resume-campaign/index.ts` | Modificar | Adicionar lógica de exclusão completa |
