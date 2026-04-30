## Diagnóstico

Investiguei a base e confirmei: **as tags estão sendo carregadas corretamente** (RLS já permite ver todas as tags da organização). No print você vê **"ADICIONAR (9)"** e a sua organização realmente tem 9 tags disponíveis no banco:

1. Brigadeiro
2. Canela de Ceilão
3. Colaborador
4. Entregador
5. Garrafas
6. **Whey** ← não aparece no print
7. **paozinho** (azul) ← não aparece
8. **paozinho** (rosa, duplicada) ← não aparece
9. **paozinho** (azul, duplicada) ← não aparece

Há **dois problemas reais**:

### Problema 1: Scroll oculto
A lista usa `ScrollArea` com altura máxima `max-h-48`, mostrando ~5 tags. As outras 4 ficam "escondidas" abaixo, **sem indicador visual** de que há mais conteúdo para rolar. O usuário pensa que a lista acabou.

### Problema 2: Tags duplicadas legadas
Existem **3 tags chamadas "paozinho"** criadas antes da validação anti-duplicata. A deduplicação atual só impede **novas** duplicatas — não limpa as antigas. Isso polui a lista e confunde.

### Problema 3: Sem busca
Com 9+ tags, fica difícil encontrar rapidamente. Não há campo de busca/filtro.

## Plano de correção

### 1. `src/components/inbox/TagSelector.tsx`
- **Aumentar altura** do `ScrollArea` de `max-h-48` para `max-h-64` e adicionar borda/sombra sutil indicando rolagem quando há overflow.
- **Adicionar campo de busca** acima da lista "Adicionar" (filtra `availableTags` por `name` case-insensitive). Aparece só quando há mais de 5 tags.
- **Mesclar tags duplicadas visualmente**: agrupar por `name.toLowerCase()` na lista — se houver várias tags com o mesmo nome, mostrar apenas uma (a mais antiga) com um pequeno aviso "⚠ duplicada (3)" e botão "Mesclar" que reatribui todas as conversas para a tag mais antiga e apaga as duplicatas.
- Mostrar contador real e badge "+N" no rodapé se ainda houver tags fora da viewport visível.

### 2. Limpeza de duplicatas no banco (migration)
Criar migration que:
- Para cada nome duplicado dentro da mesma organização, escolhe a tag mais antiga como "canônica".
- Reatribui todas as `conversation_tag_assignments` das duplicatas para a canônica (com `ON CONFLICT DO NOTHING` para evitar violar o unique).
- Apaga as tags duplicadas restantes.
- Adiciona índice único `(user_id, lower(name))` ou melhor: `unique(organization_owner_id, lower(name))` via trigger, para impedir novas duplicatas no banco (não apenas no front).

Especificamente para sua org isso vai consolidar as 3 "paozinho" em uma só, restando **7 tags reais** + as 5 já visíveis = lista limpa.

### 3. (Opcional) `LeadPanelTagsSection`
Sem mudança — apenas o popover fica corrigido.

## Resultado esperado
- Você verá todas as tags disponíveis com scroll claro e um campo "Buscar tag…".
- Tags duplicadas serão consolidadas automaticamente uma vez.
- Não será mais possível criar duplicatas (validação no banco, não só na UI).

Posso seguir?
