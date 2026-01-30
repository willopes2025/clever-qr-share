
# Correção do Loop ao Clicar em Automações na Etapa de Funil

## Problema Identificado

Ao clicar no botão de "automações" dentro de uma etapa de funil, o sistema entra em loop e reinicia. O usuário é redirecionado para a página de login.

## Análise Técnica

Após investigação detalhada do código, identifiquei potenciais causas do problema:

1. **`AutomationFormDialog` - useEffect com dependências problemáticas**
   - O useEffect na linha 182-201 tem dependências que podem causar re-renderizações infinitas
   - As dependências incluem `funnelId` e `defaultStageId` que são passados como props
   - Quando o dialog abre, ele seta múltiplos estados que podem disparar re-renderizações cascata

2. **`FunnelAutomationsView` - Hook useFunnels sendo chamado**
   - O componente usa `useFunnels()` que carrega todas as automações
   - Se houver um problema com os dados das automações (ex: campo inválido), pode causar erro de renderização

3. **ErrorBoundary recarregando a página**
   - Quando ocorre um erro não tratado, o ErrorBoundary é acionado
   - Se o usuário clicar em "Tentar novamente", pode causar o loop
   - O redirecionamento para `/login` sugere que o erro está invalidando a sessão

## Solução Proposta

### 1. Corrigir o useEffect do AutomationFormDialog

Adicionar verificações para evitar atualizações desnecessárias de estado:

```typescript
useEffect(() => {
  if (!open) return; // Early return se dialog fechado
  
  if (automation) {
    // Só atualiza se os valores forem diferentes
    if (name !== automation.name) setName(automation.name);
    if (selectedFunnelId !== automation.funnel_id) setSelectedFunnelId(automation.funnel_id);
    // ... etc
  } else {
    // Reset para novo
    setName('');
    setSelectedFunnelId(funnelId || '');
    setStageId(defaultStageId || '');
    // ...
  }
}, [open]); // Remover dependências que causam loop
```

### 2. Adicionar try-catch em componentes críticos

Envolver a renderização do `FunnelAutomationsView` com tratamento de erro:

```typescript
// FunnelAutomationsView.tsx - Adicionar estado de erro local
const [localError, setLocalError] = useState<Error | null>(null);

// Renderização segura
if (localError) {
  return (
    <div className="p-4 text-center text-destructive">
      <p>Erro ao carregar automações</p>
      <Button onClick={() => setLocalError(null)}>Tentar novamente</Button>
    </div>
  );
}
```

### 3. Verificar dados antes de renderizar

No `AutomationCard`, adicionar verificação de dados válidos:

```typescript
if (!automation || !automation.id) {
  return null; // Não renderiza cards inválidos
}
```

### 4. Simplificar dependências do useEffect

O principal problema está no useEffect do `AutomationFormDialog` que tem dependências que mudam frequentemente:

```typescript
// ANTES (problemático)
useEffect(() => {
  // lógica
}, [open, automation, funnelId, defaultStageId]);

// DEPOIS (corrigido)
useEffect(() => {
  if (!open) return;
  // lógica de reset apenas quando abre
}, [open]); // Reduzir dependências
```

## Arquivos a Modificar

1. **`src/components/funnels/AutomationFormDialog.tsx`**
   - Corrigir useEffect para evitar loop de dependências
   - Adicionar verificações de segurança

2. **`src/components/funnels/automations/FunnelAutomationsView.tsx`**
   - Adicionar tratamento de erro local
   - Verificar dados antes de renderizar

3. **`src/components/funnels/automations/AutomationCard.tsx`**
   - Adicionar verificação de automation válida

## Mudanças Detalhadas

### AutomationFormDialog.tsx

- Usar `useRef` para rastrear valores anteriores e evitar re-sets desnecessários
- Simplificar dependências do useEffect para apenas `[open]`
- Adicionar memoização dos valores que não mudam

### FunnelAutomationsView.tsx

- Adicionar try-catch na renderização de automações
- Verificar se `funnel.stages` existe antes de mapear
- Adicionar loading state mais robusto

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Clique em "Automações" na etapa | Loop infinito / Crash | Dialog abre corretamente |
| Dialog de automação abre | Re-renderizações constantes | Renderização única |
| Erro em automação específica | Crash da página inteira | Erro isolado, componente individual |
