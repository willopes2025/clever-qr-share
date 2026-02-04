
# Correção: Erro "Bad Request" na Exclusão por Tag

## Problema Identificado

O usuário **Matheus Suavel** tentou iniciar uma campanha com:
- **2 instâncias** de disparo selecionadas
- **1437 contatos** na lista (funil)
- **Critério de exclusão:** Tag "Recebeu Ouvidoria"

**Erro:** `Tag exclusion fetch error: { message: "Bad Request" }`

**Causa raiz:** O operador `.in('contact_id', contactIds)` do Supabase tem limite de ~1000 itens. Com 1437 contatos, a query falha.

---

## Solução

Mudar a abordagem: em vez de buscar "quais destes 1437 contatos têm a tag", buscar **todos os contatos com a tag** e depois filtrar localmente.

### Lógica Atual (Problemática)

```text
SELECT contact_id FROM contact_tags 
WHERE tag_id = 'xxx' 
AND contact_id IN (1437 IDs) ← ESTOURA O LIMITE!
```

### Nova Lógica (Correta)

```text
SELECT contact_id FROM contact_tags 
WHERE tag_id = 'xxx'                ← Busca todos com a tag (paginado)

// Depois filtra localmente
contacts.filter(c => !taggedIds.has(c.id))
```

---

## Arquivo a Modificar

**`supabase/functions/start-campaign/index.ts`**

Remover o `.in('contact_id', contactIds)` da query e fazer a interseção no código:

```typescript
// Antes (linha ~467-472)
const { data: tagBatch } = await supabase
  .from('contact_tags')
  .select('contact_id')
  .eq('tag_id', campaign.skip_tag_id)
  .in('contact_id', contactIds)  // ← REMOVER ISSO
  .range(tagOffset, tagOffset + pageSize - 1);

// Depois
const { data: tagBatch } = await supabase
  .from('contact_tags')
  .select('contact_id')
  .eq('tag_id', campaign.skip_tag_id)
  .range(tagOffset, tagOffset + pageSize - 1);
```

A filtragem já acontece na linha 489 (`filter(c => !taggedIds.has(c.id))`), então só precisamos remover o `.in()` da query.

---

## Resultado Esperado

1. Edge function busca todos os contatos que têm a tag (paginado)
2. Faz a interseção em memória com os contatos da lista
3. Remove os que têm a tag do disparo
4. Campanha inicia normalmente
