

## Modificação: Marcar como Lido apenas por ação do usuário

### Problema Atual
Ao clicar em uma conversa no Inbox, o sistema automaticamente marca como lida (`unread_count = 0`). Isso acontece na função `handleSelectConversation` em `src/pages/Inbox.tsx` (linha 95-97).

### Solução Proposta
Remover a marcação automática ao abrir a conversa e adicionar duas formas de marcar como lida:

1. **Botão "Marcar como lida"** — visível no cabeçalho do chat quando a conversa tem mensagens não lidas
2. **Ao responder** — quando o usuário envia uma mensagem, a conversa é automaticamente marcada como lida

### Arquivos a Alterar

**1. `src/pages/Inbox.tsx`**
- Remover a chamada `markAsRead.mutate()` de dentro de `handleSelectConversation`

**2. `src/components/inbox/ChatHeader.tsx` (ou componente equivalente do cabeçalho do chat)**
- Adicionar um botão "Marcar como lida" que aparece condicionalmente quando `unread_count > 0`
- Ao clicar, chama `markAsRead.mutate(conversationId)`

**3. Hook/componente de envio de mensagem**
- Após enviar uma mensagem com sucesso, chamar `markAsRead` para zerar o `unread_count` da conversa atual

### Detalhes Técnicos
- A mutation `markAsRead` já existe em `useConversations.ts` — só precisa ser chamada nos novos pontos
- O badge de não lidas na lista de conversas continuará funcionando normalmente
- A opção "Marcar como não lida" no menu de contexto permanece inalterada

