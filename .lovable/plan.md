

# Filtrar campos por aba ativa no painel do lead

## Problema

As abas (ex: "Principal", "Dados Importantes") permitem configurar quais campos devem aparecer em cada uma via `field_keys`. Porém, o `LeadFieldsSection` e `ContactFieldsSection` **ignoram a aba ativa** e sempre mostram **todos os campos**, independentemente da aba selecionada.

## Solução

Passar o `activeTab` (ID da aba selecionada) para os componentes de campos, e filtrar os campos exibidos com base no `field_keys` da aba ativa.

### Mudanças

| Arquivo | O que muda |
|---------|------------|
| `RightSidePanel.tsx` | Passar `activeTabId` para `LeadFieldsSection` e `ContactFieldsSection` |
| `LeadFieldsSection.tsx` | Receber `activeTabId`, buscar o `field_keys` da aba, filtrar `leadFieldDefinitions` para mostrar apenas os campos configurados na aba |
| `ContactFieldsSection.tsx` | Mesmo padrão: receber `activeTabId` e filtrar `contactFieldDefinitions` pelos `field_keys` da aba |

### Lógica de filtragem

```
const activeTab = tabs?.find(t => t.id === activeTabId);
const tabFieldKeys = activeTab?.field_keys || [];

// Se a aba tem field_keys configurados, mostrar apenas esses campos
// Se field_keys está vazio, mostrar todos (comportamento atual, compatível com abas sem config)
const fieldsToShow = tabFieldKeys.length > 0
  ? definitions.filter(f => tabFieldKeys.includes(f.field_key))
  : definitions;
```

Isso mantém compatibilidade: abas sem campos configurados continuam mostrando tudo, e abas com campos específicos mostram apenas os selecionados, na ordem definida.

