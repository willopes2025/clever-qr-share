

## Plano: Tela de Comparação Side-by-Side na Unificação de Conversas

### Visão Geral

Adicionar uma **segunda etapa** ao diálogo de unificação. Após selecionar a conversa duplicada e clicar em "Próximo", o usuário verá os dois contatos lado a lado e poderá escolher, campo a campo, quais dados manter no contato final.

### Fluxo do Usuário

```text
Etapa 1: Selecionar conversa duplicada (tela atual)
   ↓ Botão "Próximo"
Etapa 2: Comparação side-by-side dos campos
   - Coluna esquerda: Contato atual (conversa principal)
   - Coluna direita: Contato da conversa selecionada
   - Cada campo (nome, email, telefone, campos personalizados)
     tem um radio/checkbox para escolher qual valor manter
   ↓ Botão "Unificar"
Execução: Merge com os valores selecionados aplicados ao contato principal
```

### Detalhes Técnicos

**1. Refatorar `MergeConversationsDialog`** com estado de etapa (`step: 'select' | 'compare'`):
- Etapa 1 permanece como está (lista de duplicatas)
- Ao selecionar e clicar "Próximo", busca dados completos dos dois contatos (incluindo `custom_fields`)

**2. Novo componente `MergeFieldComparison`**:
- Renderiza os campos nativos (nome, email, telefone, notas) e todos os campos personalizados em linhas
- Cada linha mostra o valor do contato A (esquerda) e contato B (direita)
- O usuário clica no valor que quer manter (highlight visual)
- Campos onde apenas um contato tem valor são pré-selecionados automaticamente
- Campos com valores iguais são marcados como "iguais" e pré-selecionados

**3. Atualizar `mergeConversations` no hook `useConversationActions`**:
- Aceitar um parâmetro opcional `contactUpdates` com os campos escolhidos
- Antes de deletar a conversa duplicada, aplicar `UPDATE` no contato principal com os valores selecionados
- Mesclar `custom_fields` do contato secundário (valores selecionados) no contato principal via `jsonb` merge

**4. Largura do dialog**:
- Expandir para `sm:max-w-3xl` na etapa de comparação para acomodar as duas colunas

### Arquivos Modificados

- `src/components/inbox/MergeConversationsDialog.tsx` — adicionar etapa 2 com comparação
- `src/components/inbox/MergeFieldComparison.tsx` — novo componente de comparação side-by-side
- `src/hooks/useConversationActions.ts` — aceitar e aplicar `contactUpdates` no merge

