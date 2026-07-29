## Causa

No `src/components/inbox/MessageView.tsx` o seletor de remetente é escolhido por um `if` baseado no provedor da conversa:

- `isMetaConversation = conversation.provider === 'meta'` (linha 103)
- Se for `meta`, renderiza o seletor combinado com os grupos **API Oficial** (números Meta) + **WhatsApp Lite** (instâncias Evolution) — desktop linha ~1235 e mobile linha ~1650.
- Se **não** for `meta` (conversas criadas pela Evolution/Baileys, como a do LabClear Financeiro da imagem), cai no `else`, que lista **apenas** `connectedInstances` (James, BVC Oficial, Centro de Saúde).

Ou seja: não é permissão nem falta de números — os números Meta existem e são carregados (`useMetaNumbersMap`), mas o seletor "somente Evolution" nunca os exibe. Por isso alguns leads mostram e outros não.

## Solução

Unificar o seletor: uma única lista com Meta + Evolution, independente do `provider` da conversa.

### Mudanças em `src/components/inbox/MessageView.tsx`

1. Substituir o par `isMetaConversation` / `metaUsingEvoInstance` por um único estado `usingMetaSender` (booleano), inicializado como `true` quando a conversa tem `meta_phone_number_id` e não tem `instance_id` escolhido, e `false` caso contrário. Mantém o comportamento atual para conversas Meta.
2. Remover o `if (isMetaConversation) ... else ...` nos dois pontos (desktop ~1235-1373 e mobile ~1650-1751), deixando apenas o seletor combinado com os grupos "API Oficial" e "WhatsApp Lite".
3. `onValueChange` continua igual: `meta:<phone_number_id>` grava `meta_phone_number_id` e `provider: 'meta'`; `evo:<id>` grava `instance_id` e mantém/ajusta o provider para a instância escolhida — assim a conversa passa a responder pelo canal escolhido.
4. Atualizar os derivados de envio para usar o novo estado:
   - `useMetaSender = usingMetaSender`
   - `effectiveInstanceId`, `hasValidSender` e os `disabled` dos botões (linhas 408-412, 521, 604, 757, 1784, 1831, 1883) passam a depender só de `usingMetaSender`.
5. O efeito de auto-seleção pelo último inbound (linhas ~261-301) passa a alternar `usingMetaSender` conforme a origem da última mensagem recebida, sem depender do provider da conversa.
6. O badge "via <número>" no cabeçalho (linhas 1160-1167) passa a exibir o remetente atual em qualquer conversa.

Nada muda no backend: `send-inbox-message` já aceita envio cruzado (Meta ↔ Evolution) conforme ajuste anterior.

## Resultado

Em qualquer lead do inbox o dropdown mostrará "API Oficial" (7685 / 6204, conforme permissão do usuário) e "WhatsApp Lite" (instâncias conectadas), permitindo trocar o canal a qualquer momento.
