

# Correção: Loop/Reinício (F5) na Página de Funis

## Problema Identificado

A página de Funis está entrando em loop e reiniciando porque existem funis com **mais de 1000 deals por etapa**, ultrapassando o limite padrão de registros do banco de dados.

### Dados do Problema

| Funil | Etapa | Quantidade de Deals |
|-------|-------|---------------------|
| Dr. Victor Linhalis | Abaixo - Assinado Causa Animal | **1.070 deals** |
| Dr. Victor Linhalis | Contato Gabinete | **604 deals** |
| Centro de Saúde Visual | (total) | **565 deals** |

### Causa Raiz

A query no arquivo `src/hooks/useFunnels.ts` (linhas 91-124) busca **TODOS** os deals de uma vez só usando uma consulta aninhada:

```typescript
const { data, error } = await supabase
  .from('funnels')
  .select(`
    *,
    stages:funnel_stages(
      *,
      deals:funnel_deals(   // ← SEM LIMITE! Tenta carregar TODOS
        *,
        contact:contacts(id, name, phone, email),
        close_reason:funnel_close_reasons(*)
      )
    )
  `)
```

Isso causa dois problemas:
1. **Limite de 1000 registros**: O banco retorna apenas os primeiros 1000 deals por estágio
2. **Sobrecarga de memória**: Carregar 1000+ deals de uma vez trava o navegador

---

## Solução Proposta

Implementar **paginação virtual** nos deals do Kanban/Lista, carregando deals por demanda ao invés de tudo de uma vez.

### Arquivos a Modificar

1. **`src/hooks/useFunnels.ts`**
2. **`src/components/funnels/FunnelKanbanView.tsx`** 
3. **`src/components/funnels/FunnelListView.tsx`**

---

## Implementação

### 1. Modificar a Query Principal (useFunnels.ts)

Limitar a quantidade de deals carregados inicialmente por estágio (exemplo: 50 deals por etapa).

**Mudança na query:**
```typescript
deals:funnel_deals(
  *,
  contact:contacts(id, name, phone, email),
  close_reason:funnel_close_reasons(*)
).limit(50)  // ← ADICIONAR LIMITE
```

### 2. Adicionar Contagem de Deals por Etapa

Criar uma query separada para buscar a **contagem total** de deals por etapa (não os dados completos), permitindo exibir badges como "1.070 deals" sem carregar todos.

```typescript
// Nova query para contagens
const { data: stageCounts } = await supabase
  .from('funnel_deals')
  .select('stage_id')
  .eq('funnel_id', funnelId);

// Agrupar contagens por etapa
const countByStage = stageCounts?.reduce((acc, deal) => {
  acc[deal.stage_id] = (acc[deal.stage_id] || 0) + 1;
  return acc;
}, {});
```

### 3. Implementar "Carregar Mais" no Kanban

Adicionar um botão "Carregar mais deals" no final de cada etapa quando houver mais deals disponíveis.

```tsx
// No FunnelKanbanView.tsx
{hasMoreDeals && (
  <Button 
    variant="ghost" 
    onClick={() => loadMoreDeals(stageId)}
  >
    Carregar mais ({remainingCount})
  </Button>
)}
```

### 4. Implementar Scroll Infinito na Lista

Na view de Lista, usar paginação com scroll infinito para carregar deals conforme o usuário rola a página.

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useFunnels.ts` | Adicionar `.limit(50)` na query de deals + criar função de paginação |
| `src/hooks/useFunnels.ts` | Adicionar query para contagem total por etapa |
| `src/components/funnels/FunnelKanbanView.tsx` | Exibir contagem real + botão "carregar mais" |
| `src/components/funnels/FunnelListView.tsx` | Implementar paginação com scroll infinito |

---

## Resultado Esperado

Após a correção:
- Página de Funis carregará instantaneamente (apenas 50 deals por etapa inicialmente)
- Contagem real de deals será exibida no header de cada etapa
- Usuário poderá carregar mais deals quando necessário
- Não haverá mais travamentos ou reloads automáticos
- Suporte a funis com milhares de deals

