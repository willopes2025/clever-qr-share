# Presença de usuários e indicador de "digitando" na inbox

Objetivo: quando dois ou mais atendentes da mesma organização abrem a mesma conversa, mostrar no topo da conversa quem mais está vendo, e mostrar acima do campo de mensagem quando outro atendente está digitando.

Usaremos **Supabase Realtime Presence + Broadcast** por canal de conversa. Sem mudanças de banco — presença é em memória do Realtime.

## Arquitetura

- Canal por conversa: `conversation-presence:<conversationId>`.
- Cada cliente aberto faz `track({ user_id, full_name, avatar_url, joined_at })`.
- Evento `broadcast` tipo `typing` é emitido com `{ user_id, is_typing }` enquanto o atendente digita (debounce 1.5s para "parou de digitar").
- Filtramos o próprio `user_id` para nunca mostrar a si mesmo.

## Novos arquivos

1. `src/hooks/useConversationPresence.ts`
   - Recebe `conversationId`.
   - Lê usuário atual + perfil (`profiles.full_name`, `avatar_url`).
   - Faz `supabase.channel(...).on('presence', ...).on('broadcast', { event: 'typing' }, ...).subscribe()` e `track()` no SUBSCRIBED.
   - Retorna `{ others: PresenceUser[], typingUsers: PresenceUser[], notifyTyping: () => void }`.
   - `notifyTyping()` envia broadcast `is_typing:true` e agenda um `is_typing:false` após 1.5s sem novas chamadas.
   - Cleanup: untrack + removeChannel ao trocar de conversa/desmontar.

2. `src/components/inbox/PresenceAvatars.tsx`
   - Stack de até 3 avatares pequenos com tooltip "Fulano está vendo este lead".
   - +N para extras.

3. `src/components/inbox/UserTypingIndicator.tsx`
   - Avatar pequeno + "Fulano está digitando…" com animação de pontinhos (reaproveita o estilo do `TypingIndicator` atual).
   - Quando 2+ usuários: "Fulano e Beltrano estão digitando…".

## Edições

- `src/components/inbox/MessageView.tsx`
  - Chamar `useConversationPresence(conversation.id)`.
  - No header da conversa (perto do nome do contato): renderizar `<PresenceAvatars users={others} />`.
  - Acima do input de mensagem (mesma região onde já existe o `TypingIndicator` do contato, mas separado): renderizar `<UserTypingIndicator users={typingUsers} />` quando houver.
  - No `onChange` do textarea do composer, chamar `notifyTyping()`.

## Detalhes técnicos

- Reusa `supabase` de `@/integrations/supabase/client`.
- Para nome/avatar do usuário atual: buscar uma única vez de `profiles` (id = auth user). Cache em memória do hook.
- Throttle do `notifyTyping`: só envia broadcast se passou >1s desde o último envio "true"; sempre reagenda o timer de "false".
- O canal só assina enquanto a conversa estiver aberta, evitando flood de canais.
- Não altera DB, RLS, edge functions, nem o `TypingIndicator` existente (que continua representando o contato externo digitando no WhatsApp).

## Fora de escopo

- Indicação na lista de conversas, no kanban e em outras telas (conforme respostas do usuário).
- Persistência histórica de presença.
