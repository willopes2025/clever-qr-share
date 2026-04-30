## Diagnóstico

Investiguei o problema reportado pelo João Luis (`joaoluis@merceariasaudavel.com.br`) e confirmei pelo banco de dados:

**As tags NÃO estão sendo apagadas.** Todas as tags da organização dele continuam intactas:
- Brigadeiro, Canela de Ceilão, Colaborador, Entregador, Garrafas, paozinho, Whey — todas presentes.
- As atribuições (`conversation_tag_assignments`) também estão intactas no banco.

**Porém, identifiquei 2 causas reais para a percepção de "tags sumindo":**

### Causa 1 — Toggle acidental no seletor (UX confusa)
No popover de tags (a tela da imagem que ele enviou), clicar numa tag que **já está atribuída** (com check verde) **REMOVE** a tag. O usuário acha que está apenas "selecionando de novo" ou "confirmando", mas na verdade está desmarcando. Isso explica perfeitamente o sintoma "anexei nova → antiga sumiu" — ele clicou na antiga sem querer.

Evidência: das ~60 conversas com tags do João, apenas **1 conversa** tem mais de uma tag atribuída. Estatisticamente improvável a menos que tags estejam sendo removidas a cada nova adição.

### Causa 2 — Falta de confirmação ao remover
Não existe nenhuma confirmação ao clicar para remover uma tag (nem no popover, nem nos badges).

## Plano de Correção

### 1. Separar visualmente "Atribuídas" de "Disponíveis" no popover
No `src/components/inbox/TagSelector.tsx`, dividir a lista em duas seções:
- **"Tags atribuídas"** (no topo): com botão X explícito para remover (em vez de o item inteiro ser clicável para toggle).
- **"Adicionar tag"** (abaixo): apenas tags ainda não atribuídas, clique adiciona.

Isso elimina o toggle acidental e deixa claro o que cada clique faz.

### 2. Confirmação ao remover tag
Ao clicar no X de uma tag atribuída, exibir um pequeno confirm inline (AlertDialog) "Remover tag X desta conversa?".

### 3. Mostrar contador de tags atribuídas no header do popover
Texto "5 tags atribuídas" para que o usuário perceba imediatamente se uma sumiu após uma ação.

### 4. Toast de feedback explícito
Adicionar `toast.success("Tag X adicionada")` e `toast.info("Tag X removida")` nos handlers `assignTag` e `removeTag` para que o usuário veja claramente o que aconteceu.

### 5. Limpar tag duplicada "paozinho"
O João tem 2 tags "paozinho" criadas (uma azul, uma rosa) e a organização tem mais 1 (azul também). Adicionar uma constraint única (nome+organização) iria quebrar dados existentes — em vez disso, apenas avisar visualmente quando a tag a ser criada já existe (case-insensitive) com botão "usar a existente".

## Arquivos afetados

- `src/components/inbox/TagSelector.tsx` — refatorar popover (atribuídas vs disponíveis), adicionar confirmação, toasts e detecção de duplicata.
- `src/components/inbox/lead-panel/LeadPanelTagsSection.tsx` — ajuste pequeno: badges com botão X visível ao hover (paridade com o popover).
- `src/hooks/useConversationTags.ts` — toasts em `assignTag`/`removeTag`.

## Notas técnicas

Não há triggers no banco apagando tags. Não há realtime subscription em `conversation_tag_assignments`. RLS está correta (organização compartilhada via `get_organization_member_ids`). O bug é puramente de UX no componente `TagSelector`.