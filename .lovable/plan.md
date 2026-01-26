
# Plano: Corrigir Dropdown de Etapas no Dialog de Importacao de Contatos

## Problema Identificado

Ao tentar importar contatos existentes (filtrados por tag) para um funil, o dropdown de selecao de etapas nao aparece ou fica invisivel. Isso impede o usuario de escolher em qual etapa os contatos serao adicionados.

## Causa Raiz

O problema esta relacionado ao uso de componentes Radix UI em camadas sobrepostas:

1. O `Dialog` (modal) usa um Portal com `z-50`
2. O `Select` dentro do Dialog tambem usa um Portal separado com `z-[60]`
3. Embora o z-index do Select seja maior, ha conflitos de stacking context entre Portals do Radix
4. O dropdown pode estar sendo renderizado fora da area visivel ou com transparencia incorreta

## Solucao

Corrigir o z-index e garantir que o `SelectContent` apareca corretamente sobre o Dialog.

### Alteracao 1: Aumentar z-index do SelectContent

**Arquivo:** `src/components/ui/select.tsx`

Aumentar o z-index de `z-[60]` para `z-[100]` para garantir que o dropdown sempre apareca sobre modais:

```typescript
// Linha 68-69
className={cn(
  "relative z-[100] max-h-[var(--radix-select-content-available-height)] min-w-[8rem] ...",
```

### Alteracao 2: Adicionar background explicito no SelectContent

Garantir que o dropdown tenha background solido mesmo em diferentes contextos:

```typescript
// Adicionar bg-popover explicitamente se necessario
"bg-popover border shadow-md"
```

### Alteracao 3: Verificar o componente ImportContactsToFunnelDialog

**Arquivo:** `src/components/funnels/ImportContactsToFunnelDialog.tsx`

O componente ja esta correto na linha 317-329, mas vamos garantir que:

1. O `SelectContent` tenha z-index suficiente
2. Adicionar uma verificacao para mostrar mensagem se nao houver etapas disponiveis:

```typescript
{funnel.stages?.filter(s => !s.is_final).length === 0 ? (
  <SelectItem value="" disabled>
    Nenhuma etapa disponivel
  </SelectItem>
) : (
  funnel.stages?.filter(s => !s.is_final).map(stage => (
    // ... renderizar etapas
  ))
)}
```

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/ui/select.tsx` | Aumentar z-index para `z-[100]` |
| `src/components/funnels/ImportContactsToFunnelDialog.tsx` | Adicionar fallback quando nao houver etapas |

## Teste Esperado

1. Acessar a pagina de Funis
2. Clicar em "Importar Contatos"
3. O dropdown de "Etapa inicial" deve aparecer com todas as etapas nao-finais do funil
4. Selecionar a tag desejada (ex: "coronel cel..")
5. Selecionar a etapa destino
6. Clicar em Importar

## Consideracoes Adicionais

- A correcao do z-index beneficiara todos os Selects usados dentro de Dialogs no sistema
- Nao afeta o comportamento de Selects fora de modais
- Compativel com a estrutura existente do Radix UI
