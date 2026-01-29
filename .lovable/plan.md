
# Adicionar Filtros Avançados na Criação de Listas de Transmissão

## Objetivo

Expandir o formulário de criação/edição de listas de transmissão dinâmicas para incluir novos filtros:
- **Fonte de dados**: Contatos ou Funil (deals)
- **Funil específico**: Qual funil filtrar
- **Etapa do funil**: Filtrar por estágio específico
- **Tags**: Já existente, manter
- **Campos dinâmicos**: Filtrar por valores de custom_fields

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useBroadcastLists.ts` | Expandir `FilterCriteria` com novos campos |
| `src/components/broadcasts/BroadcastListFormDialog.tsx` | Adicionar novos campos de filtro na UI |
| `src/pages/BroadcastLists.tsx` | Passar funis e campos dinâmicos para o dialog |

---

## Detalhes Técnicos

### 1. Expandir Interface FilterCriteria

```typescript
// src/hooks/useBroadcastLists.ts
export interface FilterCriteria {
  // Campos existentes
  tags?: string[];
  status?: string;
  optedOut?: boolean;
  asaasPaymentStatus?: 'overdue' | 'pending' | 'current';
  
  // Novos campos
  source?: 'contacts' | 'funnel'; // Fonte de dados
  funnelId?: string;              // Funil selecionado
  stageId?: string;               // Etapa específica (ou "all" para todas)
  customFields?: Record<string, {
    operator: 'equals' | 'contains' | 'not_empty' | 'empty';
    value?: string;
  }>;
}
```

### 2. Atualizar Lógica de Contagem e Busca

No hook `useBroadcastLists`, atualizar as queries para:
- Se `source === 'funnel'`: buscar contatos via `funnel_deals` com join
- Se `source === 'contacts'` (padrão): manter lógica atual
- Aplicar filtros de `funnelId` e `stageId` quando selecionados
- Filtrar por `custom_fields` usando operadores JSONB

### 3. Atualizar UI do Formulário

Adicionar no `BroadcastListFormDialog.tsx`:

```text
+------------------------------------------+
| Critérios de Filtro                      |
+------------------------------------------+
| Fonte de Dados:                          |
|   [O] Contatos (todos os contatos)       |
|   [O] Funil (contatos em deals)          |
+------------------------------------------+
| Se Funil selecionado:                    |
|   Funil: [Select: Lista de funis]        |
|   Etapa: [Select: Todas / Etapa X / Y]   |
+------------------------------------------+
| Tags: [Badges clicáveis]                 |
+------------------------------------------+
| Campos Personalizados:                   |
|   + Adicionar filtro de campo            |
|   [Campo: X] [Operador: =] [Valor: Y]    |
+------------------------------------------+
```

### 4. Lógica de Query no Backend

Para buscar contatos do funil:

```typescript
// Quando source === 'funnel'
let query = supabase
  .from('funnel_deals')
  .select('contact_id, contacts!inner(*)')
  .eq('funnel_id', criteria.funnelId);

if (criteria.stageId && criteria.stageId !== 'all') {
  query = query.eq('stage_id', criteria.stageId);
}

// Depois aplicar filtros de tags e custom_fields nos contatos
```

Para filtrar por campos dinâmicos (JSONB):

```typescript
// Exemplo para campo com operador 'equals'
if (criteria.customFields) {
  Object.entries(criteria.customFields).forEach(([fieldKey, filter]) => {
    if (filter.operator === 'equals' && filter.value) {
      query = query.eq(`custom_fields->>${fieldKey}`, filter.value);
    } else if (filter.operator === 'not_empty') {
      query = query.not(`custom_fields->>${fieldKey}`, 'is', null);
    }
  });
}
```

---

## Componentes Novos

### CustomFieldFilterRow

Componente para adicionar/remover filtros de campos dinâmicos:

```text
[Select: Campo] [Select: Operador] [Input: Valor] [X Remover]

Operadores disponíveis:
- Igual a
- Contém
- Não está vazio
- Está vazio
```

---

## Fluxo de Uso

1. Usuário clica "Nova Lista" e seleciona "Dinâmica"
2. Escolhe a fonte: "Contatos" ou "Funil"
3. Se funil: seleciona qual funil e opcionalmente uma etapa
4. Adiciona tags (opcional)
5. Adiciona filtros de campos dinâmicos (opcional)
6. O sistema calcula automaticamente quantos contatos serão incluídos
7. Ao salvar, os critérios são armazenados em `filter_criteria`

---

## Resultado Esperado

- Listas dinâmicas podem ser criadas baseadas em posição no funil
- Usuários podem segmentar por etapa específica (ex: "Proposta Enviada")
- Campos dinâmicos permitem filtros granulares (ex: "Cidade = São Paulo")
- A contagem de contatos é exibida em tempo real conforme os filtros mudam
