

## Diagnóstico: Resposta via Meta Criando Novo Lead

### Problema Identificado

Na Edge Function `meta-whatsapp-webhook`, quando uma mensagem chega (inbound), o sistema busca a conversa existente do contato usando `.single()` (linha 382-387):

```typescript
let { data: conversation } = await supabase
  .from('conversations')
  .select('*')
  .eq('user_id', userId)
  .eq('contact_id', contact.id)
  .single();  // ← PROBLEMA AQUI
```

**O que acontece:**
1. Muitos contatos possuem **2 ou mais conversas** (ex: uma via Evolution API e outra via Meta, ou duplicatas criadas pelo próprio bug)
2. `.single()` retorna **erro** quando encontra mais de 1 resultado → `conversation = null`
3. O sistema pensa que não existe conversa → **cria uma nova conversa** 
4. Por ser uma "nova conversa", o bloco de auto-criação de lead executa → **cria um novo lead duplicado**

Confirmado: existem múltiplos contatos no banco com 2+ conversas, alimentando esse ciclo.

### Plano de Correção

**Arquivo**: `supabase/functions/meta-whatsapp-webhook/index.ts`

1. **Corrigir a busca de conversa** — Substituir `.single()` por uma busca que prioriza a conversa Meta existente e aceita múltiplos resultados:

```typescript
// Prioridade 1: conversa Meta com o mesmo phone_number_id
let { data: conversation } = await supabase
  .from('conversations')
  .select('*')
  .eq('user_id', userId)
  .eq('contact_id', contact.id)
  .eq('meta_phone_number_id', webhookPhoneNumberId)
  .order('last_message_at', { ascending: false })
  .limit(1)
  .maybeSingle();

// Prioridade 2: qualquer conversa do contato
if (!conversation) {
  const { data: anyConversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('contact_id', contact.id)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  conversation = anyConversation;
  
  // Se encontrou conversa mas sem meta_phone_number_id, atualizar
  if (conversation && !conversation.meta_phone_number_id) {
    await supabase.from('conversations')
      .update({ meta_phone_number_id: webhookPhoneNumberId })
      .eq('id', conversation.id);
  }
}
```

2. **Evitar leads duplicados** — No bloco de auto-criação de lead (linha 439-445), remover a restrição de funil na verificação de deal existente para evitar duplicatas em qualquer funil:

```typescript
// Verificar se já existe QUALQUER deal ativo para este contato
const { data: existingDeal } = await supabase
  .from('funnel_deals')
  .select('id')
  .eq('contact_id', contact.id)
  .limit(1)
  .maybeSingle();
```

### Resultado Esperado

- Mensagens Meta usarão a conversa existente do contato (priorizando a conversa Meta quando disponível)
- Não serão criadas conversas duplicadas
- Não serão criados leads duplicados quando uma conversa já existe para o contato

