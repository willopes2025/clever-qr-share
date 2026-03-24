

# Plano: Trocar abas do painel por Select dropdown

## Situação Atual
As abas ("J&J", "Dados Importantes") são botões horizontais que ocupam espaço e não escalam bem quando há muitas abas.

## Proposta
Substituir os botões por um **Select dropdown** (igual ao seletor de etapa do funil logo acima), com o ícone de configurações (⚙) ao lado. O visual ficará consistente com o seletor de funil.

## Mudança

### `src/components/inbox/lead-panel/LeadPanelTabs.tsx`
- Remover os botões horizontais
- Usar o componente `Select` + `SelectTrigger` + `SelectContent` + `SelectItem`
- Mostrar o nome da aba ativa no trigger
- Manter o botão ⚙ de configurações ao lado do Select
- Manter a lógica de seleção automática da primeira aba

O layout ficará: `[🎯 Select da aba ativa ▼] [⚙]` — mesmo padrão visual do seletor de etapa do funil.

