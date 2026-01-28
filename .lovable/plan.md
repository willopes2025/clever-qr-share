

# Plano: Implementar Envio Real de Mensagens nas Automações de Funil

## Problema Identificado

A automação "Boas Vindas" do cliente **merceariasaudavel.contato@gmail.com** está configurada corretamente, porém a ação `send_message` no código da Edge Function `process-funnel-automations` **não foi implementada** - ela apenas loga a mensagem mas não envia de fato.

O código atual:
```typescript
case 'send_message': {
  console.log(`[FUNNEL-AUTOMATIONS] Would send message: ${message}...`);
  // TODO: Integrate with send message function when instance is available
  results.push({ automationId: automation.id, success: true }); // Falso positivo!
}
```

---

## Solução Proposta

Implementar a integração real com o envio de mensagens utilizando a mesma lógica da função `send-inbox-message` que já funciona para envios manuais.

### Arquivo a Modificar
`supabase/functions/process-funnel-automations/index.ts`

---

## Implementação

### 1. Buscar Conversa e Instância do Deal

Expandir a query inicial para incluir a conversa e instância:

```typescript
const { data: deal, error: dealError } = await supabase
  .from('funnel_deals')
  .select(`
    *,
    contact:contacts(id, name, phone, email, label_id),
    stage:funnel_stages(id, name, is_final, final_type),
    funnel:funnels(id, name),
    conversation:conversations(id, instance_id)
  `)
  .eq('id', dealId)
  .single();
```

### 2. Implementar Envio Real na Ação `send_message`

Substituir o TODO por código funcional:

```typescript
case 'send_message': {
  let message = replaceVariables((actionConfig.message as string) || '');
  
  // Verificar se temos conversa e contato
  if (!deal.contact?.phone) {
    console.log(`[FUNNEL-AUTOMATIONS] Cannot send message - no contact phone`);
    results.push({ automationId: automation.id, success: false, error: 'Contact has no phone' });
    break;
  }

  // Tentar encontrar a conversa e instância
  let conversationId = deal.conversation_id || deal.conversation?.id;
  let instanceId = deal.conversation?.instance_id;
  
  // Se não tem conversa no deal, buscar pela mais recente do contato
  if (!conversationId || !instanceId) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, instance_id')
      .eq('contact_id', deal.contact_id)
      .eq('user_id', deal.user_id)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (conv) {
      conversationId = conv.id;
      instanceId = conv.instance_id;
    }
  }
  
  // Se ainda não tem instância, usar a instância padrão do usuário
  if (!instanceId) {
    const { data: defaultInstance } = await supabase
      .from('whatsapp_instances')
      .select('id')
      .eq('user_id', deal.user_id)
      .eq('status', 'connected')
      .limit(1)
      .maybeSingle();
    
    instanceId = defaultInstance?.id;
  }
  
  if (!instanceId) {
    console.log(`[FUNNEL-AUTOMATIONS] Cannot send message - no connected WhatsApp instance`);
    results.push({ automationId: automation.id, success: false, error: 'No connected WhatsApp instance' });
    break;
  }

  // Buscar dados da instância
  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('instance_name, evolution_instance_name, status')
    .eq('id', instanceId)
    .single();
  
  if (!instance || instance.status !== 'connected') {
    console.log(`[FUNNEL-AUTOMATIONS] Instance not connected`);
    results.push({ automationId: automation.id, success: false, error: 'Instance not connected' });
    break;
  }

  // Formatar telefone
  let phone = deal.contact.phone.replace(/\D/g, '');
  const isLabelIdContact = deal.contact.phone.startsWith('LID_') || deal.contact.label_id;
  
  let remoteJid: string;
  if (isLabelIdContact) {
    remoteJid = `${deal.contact.label_id || phone}@lid`;
  } else {
    if (!phone.startsWith('55')) phone = '55' + phone;
    remoteJid = `${phone}@s.whatsapp.net`;
  }

  // Enviar via Evolution API
  const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
  const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;
  const evolutionName = instance.evolution_instance_name || instance.instance_name;
  
  const sendPayload = remoteJid.endsWith('@lid')
    ? { number: remoteJid.replace('@lid', ''), options: { presence: 'composing' }, text: message }
    : { number: phone, text: message };
  
  console.log(`[FUNNEL-AUTOMATIONS] Sending message to ${phone} via ${evolutionName}`);
  
  const response = await fetch(
    `${evolutionApiUrl}/message/sendText/${evolutionName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify(sendPayload)
    }
  );

  const result = await response.json();
  
  if (response.ok && result.key) {
    // Criar registro da mensagem se tiver conversa
    if (conversationId) {
      await supabase.from('inbox_messages').insert({
        conversation_id: conversationId,
        user_id: deal.user_id,
        direction: 'outbound',
        content: message,
        message_type: 'text',
        status: 'sent',
        sent_at: new Date().toISOString(),
        whatsapp_message_id: result.key.id
      });
      
      await supabase.from('conversations').update({
        last_message_at: new Date().toISOString(),
        last_message_preview: message.substring(0, 100)
      }).eq('id', conversationId);
    }
    
    console.log(`[FUNNEL-AUTOMATIONS] Message sent successfully: ${result.key.id}`);
    results.push({ automationId: automation.id, success: true });
  } else {
    console.error(`[FUNNEL-AUTOMATIONS] Failed to send message:`, result);
    results.push({ automationId: automation.id, success: false, error: result.message || 'Send failed' });
  }
  break;
}
```

### 3. Implementar Também `send_template` (Similar)

Aplicar a mesma lógica para a ação `send_template` usando a API de templates da Evolution.

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/process-funnel-automations/index.ts` | Expandir query para incluir conversation + Implementar envio real via Evolution API |

---

## Resultado Esperado

Após a correção:
- Automações com ação `send_message` enviarão mensagens reais pelo WhatsApp
- Mensagens serão registradas no histórico de conversas
- Logs mostrarão "Message sent successfully" em vez de "Would send message"
- A automação "Boas Vindas" do cliente Mercearia Saudável funcionará corretamente

---

## Considerações Técnicas

1. **Fallback de Instância**: Se o deal não tiver conversa associada, usamos a instância padrão conectada do usuário
2. **Label ID (LID)**: Suporte a contatos de Click-to-WhatsApp Ads que usam identificadores especiais
3. **Registro de Mensagem**: A mensagem enviada é salva no histórico da conversa para manter rastreabilidade

