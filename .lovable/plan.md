## Problema

Com 2 usuários diferentes na mesma conversa, nem os avatares de presença no topo, nem o indicador "está digitando" acima do input aparecem. O código de renderização e o hook `useConversationPresence` existem e estão integrados em `MessageView.tsx` (linhas 88, 535, 1079-1083, 1553-1555), então o problema é no fluxo do canal Realtime (subscribe/presence/broadcast), não na UI.

## Causa provável

O canal `supabase.channel('conversation-presence:<id>')` está sendo criado mas:
- `subscribe()` pode não estar atingindo `SUBSCRIBED` (sem logs hoje, não dá pra confirmar).
- `channel.send(...)` em `notifyTyping` dispara antes do canal estar `SUBSCRIBED`, e a mensagem é descartada silenciosamente.
- `presence sync` pode estar disparando antes do outro usuário rastrear (`track`), sem novo sync depois.

Hoje o hook não tem nenhum `console.log` nem trata `presence join/leave` (só `sync`), o que torna difícil diagnosticar e fragiliza a detecção de novos participantes.

## Mudanças

### 1. `src/hooks/useConversationPresence.ts`

- Adicionar logs temporários com prefixo `[presence]`:
  - Status do `subscribe` (`SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`).
  - Erro no `track()` (se `Promise` rejeitar).
  - Cada `presence sync/join/leave` com a lista resultante.
  - Cada `broadcast typing` recebido e enviado.
- Tratar também os eventos `presence join` e `presence leave` (não só `sync`) para atualizar `others` imediatamente quando outro usuário entra.
- Marcar um `isSubscribedRef` que vira `true` só após `SUBSCRIBED`. `notifyTyping` só envia se `isSubscribedRef.current === true`; caso contrário, ignora (sem enfileirar — typing é efêmero).
- Garantir que o `track()` só roda depois de `SUBSCRIBED` (já é o caso) e logar se `track` retornar erro.

### 2. Nenhuma mudança em UI

`PresenceAvatars`, `UserTypingIndicator` e `MessageView` continuam iguais — a UI já está correta, o problema é no transporte.

### 3. Validação

Após o deploy, abrir a mesma conversa em 2 navegadores com usuários diferentes e checar o console:
- Esperado: ambos logam `[presence] SUBSCRIBED`, depois `[presence] sync` listando o outro user, e ao digitar, `[presence] broadcast typing sent` / `received`.
- Se algum desses faltar, o log dirá exatamente onde quebrou (subscribe, presence ou broadcast) e a correção definitiva vem em seguida (ex.: habilitar Realtime, ajustar config do canal, ou usar `presence join` em vez de só `sync`).

Os logs são temporários e serão removidos assim que a causa for confirmada e corrigida.

## Fora de escopo

- Mudar UI dos avatares/indicador.
- Mexer em RLS, edge functions ou banco.
- Persistir presença/digitação no banco.
