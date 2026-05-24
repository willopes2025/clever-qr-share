## Problema

Na tela **Inbox**, quando o navegador está em zoom 100% (real, sem zoom out), os elementos do **header do chat** (avatar/nome do contato + botões "Marcar como lida", "IA Ativa", seletor de número, "Acionar IA", pausar IA) se sobrepõem porque a soma das larguras fixas das 3 colunas (lista de conversas + chat + painel do lead) + barra lateral principal estoura o espaço útil em telas onde a viewport efetiva fica perto de 1280–1536 px.

Os labels de texto dos botões aparecem em breakpoints muito agressivos (`xl` e `2xl`), o que faz com que apareçam exatamente na faixa em que ainda não há folga, empurrando o título do contato e gerando overlap visual.

## Mudanças

### 1. `src/pages/Inbox.tsx` — colunas mais enxutas em telas médias
Reduzir as larguras fixas das colunas laterais para liberar espaço ao chat:

```text
listWidth:  2xl=304, xl=280, default=260   (era 320 / 296 / 272)
rightWidth: 2xl=360, xl=320, default=296   (era 384 / 340 / 312)
```

Também elevar o ponto em que o painel direito recolhe automaticamente: passar de `< 1280` para `< 1440`, evitando que ele apareça aberto justamente na faixa apertada.

### 2. `src/components/inbox/MessageView.tsx` — header mais tolerante
- Adicionar `gap-2` consistente e `flex-wrap` controlado **apenas no grupo de ações** (lado direito do header) para que, se faltar espaço, os botões quebrem em vez de sobrepor o nome.
- Elevar os breakpoints dos labels para não tentarem aparecer em telas apertadas:
  - "Marcar como lida": `hidden 2xl:inline` → manter, mas o botão usa `size="icon"` quando não há label (largura fixa h-8 w-8) em vez de `h-8 gap-1.5`.
  - "IA Ativa" / "Aguardando" / "Pausada": `hidden xl:inline` → `hidden 2xl:inline`.
  - "Acionar IA": já é `2xl` — manter, mas botão vira `size="icon"` quando o label some.
- Reduzir o `SelectTrigger` de número de `w-[140px]` para `w-[120px] xl:w-[140px]`.
- Garantir `min-w-0` no wrapper esquerdo (já existe) e adicionar `truncate` no `<h3>` (já existe) — apenas reforçar `flex-1 min-w-0` no contêiner pai dos botões está NÃO setado: o lado direito mantém `shrink-0`, então a correção real vem do conjunto acima reduzindo a largura desse bloco.

### 3. Validação
- Abrir o Inbox no preview em viewport ~1366, ~1440, ~1536 e 1920 px e conferir que:
  - Nome do contato não é coberto pelos botões.
  - Botões do header não quebram em duas linhas (exceto opcionalmente em <1366).
  - Painel do lead à direita não corta campos.

## Escopo

Mudanças apenas em 2 arquivos de UI:

- `src/pages/Inbox.tsx`
- `src/components/inbox/MessageView.tsx`

Sem mexer em lógica de negócio, dados, backend ou outras páginas.
