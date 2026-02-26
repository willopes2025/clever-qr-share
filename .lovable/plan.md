
# Correção: Mídia duplicada no Inbox

## Problema Identificado

Quando uma mídia (foto, vídeo, documento) é enviada pelo Inbox, ela aparece **duas vezes** na conversa. Isso acontece por uma **condição de corrida** (race condition):

1. O sistema cria a mensagem no banco **sem** o ID do WhatsApp
2. Envia a mídia pela Evolution API
3. A Evolution API ecoa a mensagem de volta via webhook
4. O webhook chega **antes** do sistema salvar o ID do WhatsApp na mensagem original
5. Como o webhook não encontra mensagem com aquele ID, ele cria uma **segunda** mensagem

## Solução

Corrigir a deduplicação no webhook (`receive-webhook`) para que, ao receber uma mensagem **outbound** (fromMe), ele verifique se já existe uma mensagem recente do mesmo tipo na mesma conversa, evitando duplicatas.

### Mudanças

**1. `supabase/functions/receive-webhook/index.ts`**

Antes de inserir uma mensagem outbound (fromMe), adicionar uma verificação extra: buscar mensagens outbound recentes (ultimos 60 segundos) na mesma conversa com o mesmo `message_type` e `media_url` similar, ou com status `sending`/`sent` sem `whatsapp_message_id`. Se encontrar, apenas atualizar o `whatsapp_message_id` da mensagem existente ao invés de criar uma nova.

```text
Fluxo corrigido:
1. Webhook recebe mensagem outbound (fromMe=true)
2. Verifica por whatsapp_message_id (dedup existente)
3. SE nao encontrou E eh outbound:
   - Busca mensagem recente na conversa com mesmo tipo, sem whatsapp_message_id
   - Se encontrou: atualiza o whatsapp_message_id e status -> skip insert
   - Se nao encontrou: insere normalmente
```

**2. `supabase/functions/send-inbox-media/index.ts`** (ajuste menor)

Nenhuma mudança estrutural necessaria -- o fluxo ja salva o `whatsapp_message_id` apos envio. A correcao principal fica no webhook.

## Detalhes Tecnicos

No `receive-webhook/index.ts`, apos a verificacao existente por `whatsapp_message_id` (linha ~1140), adicionar para mensagens `fromMe`:

```typescript
// Extra dedup for outbound messages (race condition with send-inbox-media/send-inbox-message)
if (isFromMe && !existingMessage) {
  const recentCutoff = new Date(Date.now() - 60000).toISOString();
  const { data: pendingMsg } = await supabase
    .from('inbox_messages')
    .select('id')
    .eq('conversation_id', conversation.id)
    .eq('direction', 'outbound')
    .eq('message_type', messageType)
    .is('whatsapp_message_id', null)
    .gte('sent_at', recentCutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (pendingMsg) {
    // Update existing message with whatsapp_message_id instead of creating duplicate
    await supabase
      .from('inbox_messages')
      .update({ whatsapp_message_id: key.id, status: 'sent' })
      .eq('id', pendingMsg.id);
    console.log(`[DEDUP] Matched outbound media to pending message ${pendingMsg.id}`);
    continue; // Skip insert
  }
}
```

Isso resolve a duplicacao sem afetar mensagens inbound ou outros fluxos.
