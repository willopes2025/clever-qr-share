
# Plano: Corrigir Disparo para Listas Baseadas em Funil

## Problema Identificado

A campanha "CSV" está configurada para disparar apenas para os **86 contatos** da etapa "Qualificação" do funil "Centro de Saúde Visual", mas está enviando para **2762 contatos** (todos os contatos do usuário).

### Causa Raiz

A Edge Function `start-campaign` **não implementa** a lógica de busca por funil quando a lista dinâmica tem `source: 'funnel'`. O código:

1. Extrai `funnelId` e `stageId` do `filter_criteria` (linha 140-147) ✅
2. **MAS** na hora de buscar contatos (linha 175+), ignora esses campos e busca diretamente da tabela `contacts` ❌

O frontend (`useBroadcastLists.ts`) trata corretamente essa lógica, mas a Edge Function não replica esse comportamento.

### Dados Confirmados

| Métrica | Valor |
|---------|-------|
| Contatos na etapa do funil | 86 |
| Total de contatos do usuário | 2762 |
| Lista configurada | `source: 'funnel'`, `funnelId: Centro Saúde Visual`, `stageId: Qualificação` |

## Solução

Adicionar lógica na Edge Function `start-campaign` para tratar listas dinâmicas com fonte "funnel":

```typescript
} else if (campaign.list?.type === 'dynamic') {
  const filterCriteria = campaign.list.filter_criteria as {
    source?: 'contacts' | 'funnel';
    funnelId?: string;
    stageId?: string;
    status?: string;
    optedOut?: boolean;
    tags?: string[];
    // ...
  } || {};

  // NOVA LÓGICA: Se fonte é funil, buscar via funnel_deals
  if (filterCriteria.source === 'funnel' && filterCriteria.funnelId) {
    console.log(`Fetching contacts from funnel: ${filterCriteria.funnelId}, stage: ${filterCriteria.stageId || 'all'}`);
    
    let query = supabase
      .from('funnel_deals')
      .select('contact_id, contacts!inner(id, name, phone, email, custom_fields, opted_out)')
      .eq('funnel_id', filterCriteria.funnelId);
    
    // Filtrar por etapa específica se definida
    if (filterCriteria.stageId && filterCriteria.stageId !== 'all') {
      query = query.eq('stage_id', filterCriteria.stageId);
    }
    
    // Aplicar filtro de opted_out
    if (filterCriteria.optedOut === false) {
      query = query.eq('contacts.opted_out', false);
    }
    
    const { data: funnelContacts, error } = await query;
    
    // Remover duplicatas (mesmo contato pode ter múltiplos deals)
    const uniqueContacts = new Map();
    for (const fc of funnelContacts || []) {
      const contact = fc.contacts;
      if (contact && contact.phone && !uniqueContacts.has(contact.id)) {
        uniqueContacts.set(contact.id, {
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          custom_fields: contact.custom_fields
        });
      }
    }
    contacts = Array.from(uniqueContacts.values());
    
    console.log(`Found ${contacts.length} unique contacts from funnel`);
  } else {
    // Lógica existente para listas baseadas em contatos
    // ... código atual ...
  }
}
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/start-campaign/index.ts` | Adicionar branch para `source === 'funnel'` antes da lógica de contatos |

## Fluxo Após Correção

```text
1. Usuário inicia campanha com lista "te3wt"
2. start-campaign recebe filter_criteria:
   { source: 'funnel', funnelId: '33b9...', stageId: 'b6e1...' }
3. Edge Function detecta source === 'funnel'
4. Busca contatos via funnel_deals com filtro de stage_id
5. Retorna apenas 86 contatos da etapa "Qualificação"
6. Campanha dispara corretamente para os 86 contatos
```

## Alterações Técnicas Detalhadas

Na função `start-campaign`, substituir a seção de listas dinâmicas (linhas 175-284) por uma versão que:

1. Primeiro verifica se `source === 'funnel'`
2. Se sim, busca via `funnel_deals` com join em `contacts`
3. Se não, mantém a lógica atual de buscar diretamente de `contacts`

Também aplicar filtros de tags e customFields quando a fonte é funil, similar ao que já existe no frontend.
