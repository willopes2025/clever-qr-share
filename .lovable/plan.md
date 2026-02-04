
# Plano: Botao de Editar em Campanhas Executadas e Verificacao de Regras de Exclusao

## Resumo das Solicitacoes

1. **Adicionar botao de editar** na etapa "disparo" para campanhas que ja foram executadas (completed, cancelled, failed)
2. **Verificar se as regras de exclusao de leads** estao funcionando corretamente

---

## Parte 1: Botao de Editar para Campanhas Executadas

### Problema Atual

O botao de editar so aparece quando `canEdit = true`, que e definido como:

```typescript
const canEdit = campaign.status === 'draft' || campaign.status === 'scheduled';
```

Isso significa que campanhas com status `completed`, `cancelled`, ou `failed` nao podem ser editadas.

### Solucao

Expandir a condicao `canEdit` para incluir campanhas que ja foram executadas:

```text
Antes:
   canEdit = status === 'draft' || status === 'scheduled'

Depois:
   canEdit = status === 'draft' || status === 'scheduled' || 
             status === 'completed' || status === 'cancelled' || status === 'failed'
```

### Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/campaigns/CampaignCard.tsx` | Atualizar logica de `canEdit` |

### Codigo Proposto

```typescript
// Linha 57 - CampaignCard.tsx
const canEdit = campaign.status !== 'sending'; // Permite editar em qualquer status exceto "sending"
```

### Observacao de Seguranca

Ao editar uma campanha ja executada, o usuario podera:
- Mudar nome, template, lista
- Ajustar configuracoes de envio
- Reconfigurar regras de exclusao

Para iniciar novamente, o usuario usara o botao "Retomar" que ja existe.

---

## Parte 2: Verificacao das Regras de Exclusao de Leads

### Analise do Codigo Atual

A logica de exclusao de leads esta implementada em `supabase/functions/start-campaign/index.ts` (linhas 444-500):

```text
Fluxo de Exclusao:
1. Verifica se skip_already_sent esta ativado (padrao: true)
2. Busca campanhas relevantes baseado no skip_mode:
   - same_campaign: Apenas esta campanha
   - same_template: Campanhas com mesmo template
   - same_list: Campanhas com mesma lista
   - any_campaign: Qualquer campanha
3. Busca contatos que receberam mensagens (sent/delivered) no periodo configurado
4. Remove esses contatos da lista de envio
```

### Verificacao de Problemas Potenciais

#### Problema 1: Falta de Filtro por user_id

Na query `any_campaign`, nao ha filtro por `user_id`, podendo incluir campanhas de outros usuarios (se RLS nao proteger):

```typescript
// Linha 478-487
let alreadySentQuery = supabase
  .from('campaign_messages')
  .select('contact_id')
  .in('status', ['sent', 'delivered'])
  .gte('sent_at', periodStartISO);

// Para any_campaign, nao filtra por campaign_id
if (skipMode !== 'any_campaign' && campaignIdsToCheck.length > 0) {
  alreadySentQuery = alreadySentQuery.in('campaign_id', campaignIdsToCheck);
}
```

**Impacto**: Se RLS estiver configurado corretamente na tabela `campaign_messages`, isso nao e problema. Mas se nao, pode haver comportamento inesperado.

#### Problema 2: Limite de Query Supabase

A query de `campaign_messages` pode retornar mais de 1000 registros, mas nao ha paginacao:

```typescript
const { data: alreadySent } = await alreadySentQuery;
// Limite padrao do Supabase: 1000 registros
```

**Impacto**: Se houver mais de 1000 contatos ja enviados, alguns podem nao ser filtrados.

### Correcoes Necessarias

| Problema | Correcao |
|----------|----------|
| Limite de 1000 registros | Adicionar paginacao na query de exclusao |
| Clareza no any_campaign | Adicionar filtro por user_id via campaign_id |

### Codigo Corrigido para start-campaign

```typescript
// Adicionar paginacao na busca de contatos ja enviados
let allAlreadySentIds: string[] = [];
let offset = 0;
const pageSize = 1000;
let hasMore = true;

while (hasMore) {
  let alreadySentQuery = supabase
    .from('campaign_messages')
    .select('contact_id')
    .in('status', ['sent', 'delivered'])
    .gte('sent_at', periodStartISO)
    .range(offset, offset + pageSize - 1);

  if (skipMode !== 'any_campaign' && campaignIdsToCheck.length > 0) {
    alreadySentQuery = alreadySentQuery.in('campaign_id', campaignIdsToCheck);
  } else if (skipMode === 'any_campaign') {
    // Para any_campaign, buscar todas as campanhas do usuario primeiro
    const { data: userCampaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('user_id', user.id);
    
    if (userCampaigns && userCampaigns.length > 0) {
      alreadySentQuery = alreadySentQuery.in('campaign_id', userCampaigns.map(c => c.id));
    }
  }

  const { data: batch } = await alreadySentQuery;

  if (batch && batch.length > 0) {
    allAlreadySentIds.push(...batch.map(m => m.contact_id));
    offset += pageSize;
    hasMore = batch.length === pageSize;
  } else {
    hasMore = false;
  }
}

const alreadySentIds = new Set(allAlreadySentIds);
```

### Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/start-campaign/index.ts` | Adicionar paginacao na exclusao |

---

## Resumo das Alteracoes

| Arquivo | Alteracao | Impacto |
|---------|-----------|---------|
| `src/components/campaigns/CampaignCard.tsx` | Botao editar em campanhas executadas | UX melhorada |
| `supabase/functions/start-campaign/index.ts` | Paginacao na query de exclusao | Correcao de bug |

## Fluxo Atualizado

```text
Campanha Executada (completed/cancelled/failed)
     |
     v
[Editar] --> CampaignFormDialog --> Alterar configuracoes
     |
     v
[Retomar/Iniciar] --> Reavaliar exclusoes --> Enviar para contatos restantes
```

## Resultado Esperado

1. Usuario pode clicar em "Editar" em campanhas ja executadas
2. Alterar template, lista, configuracoes de exclusao
3. Ao retomar, as novas regras de exclusao serao aplicadas
4. Exclusao funciona corretamente mesmo com mais de 1000 contatos ja enviados
