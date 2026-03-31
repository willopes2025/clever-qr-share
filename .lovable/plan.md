

## Templates regulares em conversas Meta (janela de 24h)

### Problema
Quando uma conversa é do tipo **Meta** (`provider = 'meta'`), os templates regulares (não-Meta) não funcionam porque:
1. No `handleSlashSelect`, o código valida `selectedInstanceId` (Evolution API) em vez de verificar se é uma conversa Meta
2. Ao enviar o texto do template, usa `selectedInstanceId` em vez de `selectedMetaNumberId`
3. Templates com mídia também usam `selectedInstanceId` para envio

Na prática, o usuário em uma conversa Meta não consegue usar templates regulares dentro da janela de 24h.

### Solução
Ajustar o `MessageView.tsx` para que templates regulares em conversas Meta enviem via Meta API (texto simples dentro da janela de 24h):

**Arquivo: `src/components/inbox/MessageView.tsx`**

1. **`handleSlashSelect`** — Ajustar a validação de instância para aceitar `selectedMetaNumberId` quando `isMetaConversation` é true
2. **Envio de texto do template** — Usar `selectedMetaNumberId` como `instanceId` quando a conversa é Meta (o `send-inbox-message` já roteia corretamente baseado no `provider` da conversa)
3. **Envio de mídia do template** — Mesma lógica: usar `selectedMetaNumberId` para conversas Meta

### Detalhes técnicos

No `handleSlashSelect`:
- Trocar a validação `if (!selectedInstanceId)` por uma verificação que aceite Meta OU Evolution
- Nos `sendMessage.mutateAsync` e `handleSendMedia`, passar o `instanceId` correto baseado em `isMetaConversation`

O backend (`send-inbox-message`) **já suporta** envio de texto regular via Meta API — a decisão é feita pelo `provider` da conversa. Então basta o frontend passar o `instanceId` correto (que para Meta é o `phoneNumberId`).

