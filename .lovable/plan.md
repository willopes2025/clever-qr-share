
# Plano: Correção do Limite de 1000 na Busca de Contatos de Campanhas

## Problema Identificado

A campanha "BH Kayros" deveria disparar para **69 contatos** (todos com a tag "Bh Kayros"), mas está disparando apenas para **14**.

**Causa-raiz:** O Supabase tem um **limite padrão de 1000 registros** por query. Como a query de contatos na edge function `start-campaign` não especifica `ORDER BY`, a ordem de retorno é indefinida. Resultado: apenas 14 dos 69 contatos com a tag estão sendo retornados no subset de 1000 registros.

**Evidência do banco:**
```text
Com LIMIT 1000 (ordem indefinida): 14 contatos com a tag
Sem limite: 69 contatos com a tag
```

## Solução Proposta

Modificar a edge function `start-campaign` para buscar **TODOS os contatos** do usuário, usando paginação quando necessário.

```text
┌─────────────────────────────────────────────────────────────┐
│ ANTES (bugado)                                              │
│                                                             │
│ Query: SELECT * FROM contacts WHERE user_id = X            │
│        AND opted_out = false                                │
│        -- Sem ORDER BY, sem LIMIT explícito                │
│        -- Supabase retorna até 1000 registros              │
│                                                             │
│ Resultado: 1000 contatos aleatórios (14 têm a tag)         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ DEPOIS (corrigido)                                          │
│                                                             │
│ Loop com paginação:                                         │
│   offset = 0, pageSize = 1000                               │
│   while (hasMore) {                                         │
│     Query: SELECT * FROM contacts                           │
│            WHERE user_id = X AND opted_out = false          │
│            ORDER BY created_at                              │
│            LIMIT 1000 OFFSET offset                         │
│     offset += 1000                                          │
│   }                                                         │
│                                                             │
│ Resultado: Todos os 2631 contatos → 69 com a tag           │
└─────────────────────────────────────────────────────────────┘
```

## Alterações Técnicas

### Arquivo: `supabase/functions/start-campaign/index.ts`

**Modificar a seção de busca de contatos (linhas 162-230):**

1. **Adicionar função de paginação** para buscar todos os contatos:

```typescript
// Função helper para paginar resultados
async function fetchAllContacts(
  supabase: SupabaseClient,
  userId: string,
  filters: { status?: string; optedOut?: boolean; asaasPaymentStatus?: string }
): Promise<Array<{ id: string; name: string | null; phone: string; email: string | null; custom_fields: Record<string, string> | null }>> {
  const pageSize = 1000;
  let offset = 0;
  let allContacts: any[] = [];
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('contacts')
      .select('id, name, phone, email, custom_fields')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (typeof filters.optedOut === 'boolean') {
      query = query.eq('opted_out', filters.optedOut);
    }
    if (filters.asaasPaymentStatus) {
      query = query.eq('asaas_payment_status', filters.asaasPaymentStatus);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      allContacts = allContacts.concat(data);
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allContacts;
}
```

2. **Substituir a query simples** pela função paginada:

```typescript
// Substituir linhas 171-191 por:
const filteredContacts = await fetchAllContacts(supabase, user.id, {
  status: filterCriteria.status,
  optedOut: filterCriteria.optedOut,
  asaasPaymentStatus: filterCriteria.asaasPaymentStatus
});

console.log(`Fetched ${filteredContacts.length} total contacts from database`);
```

3. **Também paginar a busca de tags** (linha 200-203):

```typescript
// Buscar todas as tags com paginação
let taggedContactIds: string[] = [];
let tagOffset = 0;
let hasMoreTags = true;

while (hasMoreTags) {
  const { data: tagBatch, error: tagsError } = await supabase
    .from('contact_tags')
    .select('contact_id')
    .in('tag_id', filterCriteria.tags)
    .range(tagOffset, tagOffset + 999);

  if (tagsError) throw new Error('Failed to fetch contact tags');
  
  if (tagBatch && tagBatch.length > 0) {
    taggedContactIds.push(...tagBatch.map(tc => tc.contact_id));
    tagOffset += 1000;
    hasMoreTags = tagBatch.length === 1000;
  } else {
    hasMoreTags = false;
  }
}

const taggedIds = new Set(taggedContactIds);
```

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Lista "BH Kayros" | 14 contatos | 69 contatos |
| Usuário com 2631 contatos | Limite de 1000 | Todos processados |
| Tags com muitos contatos | Limite de 1000 | Paginação completa |

## Arquivos a Modificar

1. **Modificar:** `supabase/functions/start-campaign/index.ts` - Adicionar paginação

## Teste Recomendado

Após a correção:
1. Reexecutar o disparo para a lista "BH Kayros"
2. Verificar que o log mostra "Found 69 contacts in list"
3. Confirmar que 69 mensagens foram criadas em `campaign_messages`
