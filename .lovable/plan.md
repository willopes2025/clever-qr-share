

# Reações a Mensagens no Inbox (WhatsApp Reactions)

## Contexto
Atualmente o sistema não tem suporte a reações (emoji reactions) em mensagens. Nem recebe reações do webhook, nem permite o usuário reagir. A Evolution API e a Meta API suportam reações nativamente.

## Plano

### 1. Criar tabela `message_reactions` (migração)
```sql
CREATE TABLE public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES inbox_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  reacted_by TEXT NOT NULL, -- 'contact' ou user_id
  whatsapp_reaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
- RLS usando `get_organization_member_ids` na conversation
- Habilitar realtime para atualizações instantâneas

### 2. Receber reações nos webhooks

**Evolution API (`receive-webhook/index.ts`)**:
- Tratar evento `messages.upsert` quando `message.reactionMessage` está presente
- Extrair `reactionMessage.key.id` (mensagem reagida) e `reactionMessage.text` (emoji)
- Inserir/atualizar na tabela `message_reactions`
- Emoji vazio = remoção da reação

**Meta API (`meta-whatsapp-webhook/index.ts`)**:
- Tratar tipo de mensagem `reaction` no payload
- Extrair `message.reaction.message_id` e `message.reaction.emoji`
- Mesma lógica de insert/delete

### 3. Enviar reações (nova edge function ou extensão do `send-inbox-message`)

- Adicionar action `reaction` no `send-inbox-message`
- Evolution API: `POST /message/sendReaction/{instance}` com `{ key, reaction: "👍" }`
- Meta API: enviar tipo `reaction` via Cloud API
- Inserir na tabela `message_reactions` com `reacted_by = user_id`

### 4. Frontend — Exibir reações no `MessageBubble`

- Buscar reações junto com mensagens no `useConversations` (join ou query separada)
- Renderizar abaixo do bubble: chips com emoji + contagem
- Escutar realtime na tabela `message_reactions` para atualizar em tempo real

### 5. Frontend — UI para reagir

- Ao passar o mouse/hover sobre uma mensagem, mostrar botão de emoji (😊)
- Ao clicar, abrir picker com emojis rápidos (👍❤️😂😮😢🙏) + opção de picker completo
- Ao selecionar, chamar `send-inbox-message` com action `reaction`
- Estilo visual similar ao WhatsApp Web (popup flutuante sobre a mensagem)

### Arquivos impactados
- **Nova migração SQL**: tabela `message_reactions` + RLS + realtime
- `supabase/functions/receive-webhook/index.ts` — tratar `reactionMessage`
- `supabase/functions/meta-whatsapp-webhook/index.ts` — tratar reaction
- `supabase/functions/send-inbox-message/index.ts` — enviar reação via API
- `src/components/inbox/MessageBubble.tsx` — exibir reações + botão de reagir
- `src/hooks/useConversations.ts` — incluir reações na query de mensagens

