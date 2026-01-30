
# Plano: Correção de Funil Errado em Disparos de Campanha

## Problema Identificado

Ao efetuar disparos de campanhas com listas de broadcast filtradas por funil específico, os leads/deals estão sendo criados no **funil padrão da instância WhatsApp** ao invés do **funil configurado na lista de broadcast**.

## Causa Raiz

O fluxo atual cria deals baseado no `default_funnel_id` da **instância WhatsApp**, ignorando completamente o `filter_criteria.funnelId` da lista de broadcast:

```text
┌──────────────────────────────────────────────────────────────┐
│ FLUXO ATUAL (BUGADO)                                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ 1. Lista de Broadcast                                        │
│    filter_criteria: { funnelId: "A", stageId: "X" }         │
│    → Usado APENAS para buscar contatos                       │
│                                                              │
│ 2. Campanha usa Instância                                    │
│    instância.default_funnel_id: "B"                         │
│                                                              │
│ 3. Webhook processa mensagem enviada                         │
│    → Cria deal em: "B" (funil da instância)                 │
│    → DEVERIA criar em: "A" (funil da lista)                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Solução Proposta

Propagar o `funnelId` da lista de broadcast através de todo o fluxo de campanha para que os deals sejam criados no funil correto.

```text
┌──────────────────────────────────────────────────────────────┐
│ FLUXO CORRIGIDO                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ 1. start-campaign                                            │
│    → Extrair funnelId/stageId do filter_criteria da lista   │
│    → Armazenar na campanha (novo campo target_funnel_id)    │
│                                                              │
│ 2. send-campaign-messages                                    │
│    → Incluir target_funnel_id nos metadados da mensagem     │
│    → Passar na chamada ao Evolution API (ou via DB)         │
│                                                              │
│ 3. receive-webhook                                           │
│    → Verificar se mensagem é de campanha                     │
│    → Se sim, usar o funil da campanha, não da instância     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Alterações Técnicas

### 1. Migração SQL - Adicionar campos na tabela campaigns

Adicionar campo `target_funnel_id` e `target_stage_id` para rastrear o funil destino:

```sql
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS target_funnel_id UUID REFERENCES funnels(id),
ADD COLUMN IF NOT EXISTS target_stage_id UUID REFERENCES funnel_stages(id);
```

### 2. Edge Function: start-campaign/index.ts

Extrair e salvar o funil da lista de broadcast:

```typescript
// Após carregar a campanha com lista (linha ~65)
let targetFunnelId: string | null = null;
let targetStageId: string | null = null;

if (campaign.list?.filter_criteria) {
  const fc = campaign.list.filter_criteria as { funnelId?: string; stageId?: string };
  targetFunnelId = fc.funnelId || null;
  targetStageId = fc.stageId || null;
  console.log(`Campaign using funnel from list: ${targetFunnelId}, stage: ${targetStageId}`);
}

// Atualizar campaign status (linha ~347) - adicionar target_funnel_id
.update({
  status: 'sending',
  ...
  target_funnel_id: targetFunnelId,
  target_stage_id: targetStageId,
})
```

### 3. Edge Function: receive-webhook/index.ts

Modificar a lógica de criação de deal para verificar se há campanha ativa:

```typescript
// Linha ~1039 - Após criar/atualizar conversa
// Determinar qual funil usar para o deal
let funnelIdForDeal: string | null = null;
let stageIdForDeal: string | null = null;

// Verificar se mensagem é de campanha (isFromMe = true para campanhas)
if (isFromMe) {
  // Buscar campanha ativa para este contato
  const { data: campaignMessage } = await supabase
    .from('campaign_messages')
    .select('campaign_id, campaigns!inner(target_funnel_id, target_stage_id)')
    .eq('contact_id', contact.id)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (campaignMessage?.campaigns?.target_funnel_id) {
    funnelIdForDeal = campaignMessage.campaigns.target_funnel_id;
    stageIdForDeal = campaignMessage.campaigns.target_stage_id;
    console.log(`[CAMPAIGN-FUNNEL] Using campaign funnel: ${funnelIdForDeal}`);
  }
}

// Fallback para funil da instância se não vier de campanha
if (!funnelIdForDeal && defaultFunnelId && !isFromMe) {
  funnelIdForDeal = defaultFunnelId;
}

// Criar deal no funil correto
if (funnelIdForDeal && conversation) {
  await createDealFromNewConversation(
    supabase, 
    userId, 
    funnelIdForDeal, 
    contact.id, 
    conversation.id, 
    contact.name || phone,
    stageIdForDeal // Novo parâmetro para estágio específico
  );
}
```

### 4. Atualizar função createDealFromNewConversation

Aceitar estágio específico como parâmetro:

```typescript
async function createDealFromNewConversation(
  supabase: any, 
  userId: string, 
  funnelId: string, 
  contactId: string, 
  conversationId: string, 
  contactName: string,
  targetStageId?: string | null  // Novo parâmetro
) {
  // Se targetStageId for fornecido, usar diretamente
  // Senão, buscar primeiro estágio do funil (comportamento atual)
  let stageId = targetStageId;
  
  if (!stageId) {
    const { data: firstStage } = await supabase
      .from('funnel_stages')
      .select('id')
      .eq('funnel_id', funnelId)
      .order('display_order', { ascending: true })
      .limit(1)
      .single();
    stageId = firstStage?.id;
  }
  // ... resto da função
}
```

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Disparo com lista de funil A | Deal criado no funil da instância (B) | Deal criado no funil A |
| Disparo com lista sem funil | Deal criado no funil da instância | Deal criado no funil da instância (sem mudança) |
| Resposta do cliente (incoming) | Deal criado no funil da instância | Deal criado no funil da instância (sem mudança) |

## Arquivos a Modificar

1. **Migração SQL**: Adicionar `target_funnel_id` e `target_stage_id` na tabela `campaigns`
2. **Edge Function**: `supabase/functions/start-campaign/index.ts` - Extrair e salvar funil da lista
3. **Edge Function**: `supabase/functions/receive-webhook/index.ts` - Usar funil da campanha para deals

## Observações Importantes

- A mudança é retrocompatível: campanhas existentes sem `target_funnel_id` continuarão usando o funil da instância
- O estágio específico (`target_stage_id`) é opcional mas permite mais controle sobre onde o lead entra no funil
- Mensagens de entrada (não de campanha) continuam usando o `default_funnel_id` da instância normalmente
