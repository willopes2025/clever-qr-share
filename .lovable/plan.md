

## Plano: Botão "Disparar agora" no card de automação

### O que será feito
Adicionar um botão de execução imediata (ícone Play ▶) nos hover actions do `AutomationCard`. Ao clicar, a automação será executada em todos os deals da etapa/funil usando a mesma Edge Function `process-existing-deals-automation` que já existe.

### Alterações

**1. `AutomationCard.tsx`**
- Adicionar nova prop `onRunNow: (automation: FunnelAutomation) => void`
- Adicionar ícone `Play` nos imports do lucide-react
- Adicionar estado local `isRunning` para feedback visual (spinner)
- Inserir novo botão com tooltip "Disparar agora" nos hover actions, entre o botão de Copiar e o de Ativar/Desativar
- O botão mostra um spinner enquanto executa

**2. `StageAutomationsColumn.tsx`**
- Receber nova prop `onRunAutomation` e repassá-la ao `AutomationCard`

**3. `GlobalAutomationsColumn.tsx`**
- Receber nova prop `onRunAutomation` e repassá-la ao `AutomationCard`

**4. Componente pai (Automatize view)**
- Implementar o handler `handleRunAutomation` que invoca `process-existing-deals-automation` com o `automationId`, exibindo toast de sucesso/erro com contagem de deals processados (mesma lógica que já existe em `AutomationsDialog.tsx`)

### Fluxo do usuário
1. Hover no card da automação na aba Automatize
2. Clica no botão ▶ (Play)
3. Botão vira spinner durante processamento
4. Toast informa: "Automação executada em X deals (Y ok, Z erros)"

