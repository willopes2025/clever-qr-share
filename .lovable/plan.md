
# Plano: Correção do Bug de Persistência do Campo "Etapa" nas Listas de Transmissão

## Resumo do Problema

O usuário relatou que ao criar/editar uma lista de transmissão dinâmica:
1. Selecionou o funil "Seven BH" com uma etapa específica
2. Salvou a lista
3. Ao reabrir para editar, a etapa voltou para "Todas as etapas"
4. O disparo foi realizado para leads do funil errado

## Causa-Raiz Identificada

**Condição de corrida entre dois `useEffect` no componente `BroadcastListFormDialog.tsx`:**

```text
┌─────────────────────────────────────────────────────────────────┐
│ useEffect #1 (linha 81-116)                                     │
│ - Dispara quando: list ou open mudam                            │
│ - Ação: Carrega dados da lista, incluindo:                      │
│   • setSelectedFunnelId(list.filter_criteria?.funnelId)         │
│   • setSelectedStageId(list.filter_criteria?.stageId)           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ useEffect #2 (linha 118-121) - O PROBLEMA                       │
│ - Dispara quando: selectedFunnelId muda                         │
│ - Ação: setSelectedStageId("all") ← SOBRESCREVE O VALOR!        │
└─────────────────────────────────────────────────────────────────┘
```

**Sequência do bug:**
1. Usuário abre formulário para editar lista existente
2. `useEffect #1` carrega `funnelId` e `stageId` corretamente
3. Como `selectedFunnelId` mudou (de `""` para o ID do funil), `useEffect #2` é disparado
4. `useEffect #2` reseta `selectedStageId` para `"all"`, apagando o valor que acabou de ser carregado
5. Usuário salva (sem perceber que o stageId foi perdido)
6. O disparo ocorre para todas as etapas do funil

## Solução

Adicionar uma flag de controle (`isLoadingFromList`) para evitar que o reset do estágio ocorra durante o carregamento inicial da lista.

## Alterações Técnicas

### Arquivo: `src/components/broadcasts/BroadcastListFormDialog.tsx`

**1. Adicionar novo estado de controle (após linha 62):**
```typescript
const [isLoadingFromList, setIsLoadingFromList] = useState(false);
```

**2. Modificar o useEffect de carregamento (linhas 81-116):**
```typescript
useEffect(() => {
  if (list) {
    setIsLoadingFromList(true); // ← Flag para bloquear reset
    setName(list.name);
    setDescription(list.description || "");
    setType(list.type);
    setSelectedTags(list.filter_criteria?.tags || []);
    setStatus(list.filter_criteria?.status || "all");
    setExcludeOptedOut(list.filter_criteria?.optedOut === false);
    setAsaasPaymentStatus(list.filter_criteria?.asaasPaymentStatus || "all");
    setSource(list.filter_criteria?.source || 'contacts');
    setSelectedFunnelId(list.filter_criteria?.funnelId || "");
    setSelectedStageId(list.filter_criteria?.stageId || "all");
    
    // Restaurar filtros de campos dinâmicos
    const existingFilters = list.filter_criteria?.customFields || {};
    const filtersArray = Object.entries(existingFilters).map(([fieldKey, filter]) => ({
      id: crypto.randomUUID(),
      fieldKey,
      operator: filter.operator,
      value: filter.value,
    }));
    setCustomFieldFilters(filtersArray);
    
    // Liberar flag após o ciclo de render
    setTimeout(() => setIsLoadingFromList(false), 0);
  } else {
    // ... reset values para nova lista (mantido igual)
  }
}, [list, open]);
```

**3. Modificar o useEffect de reset do estágio (linhas 118-121):**
```typescript
// Reset estágio quando o funil muda (apenas para seleção manual)
useEffect(() => {
  if (!isLoadingFromList) {
    setSelectedStageId("all");
  }
}, [selectedFunnelId, isLoadingFromList]);
```

## Resultado Esperado

- **Editar lista existente:** O estágio salvo será exibido corretamente
- **Criar nova lista:** O reset funcionará normalmente ao trocar de funil
- **Trocar funil manualmente:** O reset para "Todas as etapas" funcionará corretamente

## Teste Recomendado

Após a correção, validar os seguintes cenários:
1. Criar nova lista dinâmica com funil + etapa específica → Salvar → Reabrir → Verificar que etapa está correta
2. Editar lista existente → Trocar o funil → Verificar que etapa resetou para "Todas"
3. Realizar disparo usando a lista corrigida → Verificar que os leads corretos foram selecionados
