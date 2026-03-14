

# Corrigir botão de configuração das abas cortado

## Problema

A barra de abas usa `flex` com `overflow-x-auto`, e o botão ⚙️ está dentro do mesmo container com `ml-auto`. Quando há muitas abas (ex: "Principal", "Dados Importantes", "James and Jesses"), o botão é empurrado para fora da área visível e o scroll horizontal não ajuda a acessá-lo facilmente.

## Solução

Separar o botão de configuração do container scrollável das abas. O layout será:

```text
┌─────────────────────────────────────┬────┐
│ [Principal] [Dados Imp.] [James...] │ ⚙️ │
│  ← scroll horizontal →             │fixo│
└─────────────────────────────────────┴────┘
```

### Mudança em `LeadPanelTabs.tsx`

- Criar um wrapper `flex` externo com o botão ⚙️ fixo à direita (`shrink-0`)
- Mover as abas para um `div` interno com `overflow-x-auto` e `flex-1`
- O botão fica sempre visível independente do número de abas

