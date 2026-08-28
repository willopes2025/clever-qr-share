# Inbox: marcar como lida ao abrir e apagar mensagem para todos

Duas correções pedidas pelo Werllon (Martins).

## 1. Conversa não fica marcada como lida

Hoje a conversa só perde o "não lida" quando o usuário clica no botão "Marcar como lida" ou quando envia uma resposta. Abrir a conversa e ler as mensagens não zera o contador — por isso tudo continua aparecendo como não lido (e some da aba "Sem dono" só depois da resposta).

Mudança:
- Ao abrir uma conversa no Inbox (desktop e mobile), ela é marcada como lida automaticamente assim que as mensagens são exibidas.
- O contador da lista, o badge do menu lateral e a aba "Sem dono" atualizam na hora, sem precisar recarregar a página.
- O botão manual "Marcar como lida" continua existindo (útil para marcar sem abrir).

## 2. Apagar mensagem para todos no WhatsApp

Hoje não existe nenhuma ação de apagar mensagem nas conversas de cliente.

Mudança:
- No menu de cada mensagem enviada pela equipe, nova ação "Apagar para todos".
- A mensagem é apagada de fato na conversa do cliente no WhatsApp e, no Inbox, passa a aparecer como "Mensagem apagada" (mantendo o histórico de auditoria).
- Confirmação antes de apagar.
- Disponível apenas para mensagens enviadas por número conectado via Evolution API e dentro da janela permitida pelo WhatsApp. Para números oficiais Meta e para mensagens recebidas do cliente, a opção não aparece (o WhatsApp não permite) — nesse caso oferecemos apenas "ocultar no sistema", se você quiser.

## 3. "Para esse cliente não chega msg"

Sem o número do contato não dá para confirmar a causa. Assim que você passar o telefone (ou o nome exato do cliente), eu verifico os registros de envio daquela conversa e trato como item separado.

## Detalhes técnicos

**Marcar como lida**
- `src/pages/Inbox.tsx`: disparar `markAsRead` num `useEffect` ao trocar `selectedConversation` quando `unread_count > 0` (com guarda para não repetir).
- `src/hooks/useConversations.ts`: no `onSuccess` do `markAsRead`, além de `['conversations']`, invalidar `['unread-count']` e aplicar update otimista no cache para refletir imediatamente na lista virtualizada de `ConversationList.tsx`.

**Apagar para todos**
- Migração: coluna `deleted_at timestamptz` (e `deleted_by uuid`) em `inbox_messages`.
- Nova ação `delete_for_everyone` em `send-inbox-message` (ou função dedicada) chamando `POST {EVOLUTION_URL}/chat/deleteMessageForEveryone/{evolution_instance_name}` com `{ id: whatsapp_message_id, remoteJid, fromMe: true, participant }`; em caso de sucesso grava `deleted_at`.
- Requer `whatsapp_message_id` preenchido e `sent_via_instance_id` não nulo; sem isso o item de menu fica desabilitado com tooltip explicando.
- UI: item no menu de contexto da mensagem em `MessageView.tsx` + `AlertDialog` de confirmação; bolha renderiza estado "Mensagem apagada" em itálico quando `deleted_at` estiver preenchido.
