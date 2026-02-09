

# Correção do Filtro "Sem Resposta" no Inbox

## Problema Raiz Identificado

O filtro "Sem resposta" depende do campo `last_message_direction` na tabela `conversations`. Quando o valor é `'inbound'`, significa que o cliente enviou a ultima mensagem e aguarda resposta. Quando e `'outbound'`, significa que o atendente ja respondeu.

O bug esta na **ordem de execucao** dentro da edge function `receive-webhook`. Existe uma condicao de corrida (race condition) que corrompe o valor de `last_message_direction`.

## Como o Bug Acontece

```text
Sequencia de eventos que causa o problema:

1. Cliente envia mensagem
   -> receive-webhook (messages.upsert)
   -> Atualiza conversa: last_message_direction = 'inbound'

2. Atendente responde pelo Inbox
   -> send-inbox-message
   -> Insere mensagem no banco com whatsapp_message_id
   -> Atualiza conversa: last_message_direction = 'outbound'

3. Cliente envia nova mensagem
   -> receive-webhook (messages.upsert)
   -> Atualiza conversa: last_message_direction = 'inbound'
   (Conversa aparece corretamente no filtro "Sem resposta")

4. *** PROBLEMA *** Webhook "send.message" do passo 2 chega ATRASADO
   -> receive-webhook (send.message -> handleMessagesUpsert)
   -> PRIMEIRO atualiza conversa: last_message_direction = 'outbound'  <-- BUG!
   -> DEPOIS verifica se mensagem ja existe -> "ja existe, pulando"
   -> MAS o dano ja foi feito: a direcao foi sobrescrita!

   Resultado: a conversa SOME do filtro "Sem resposta" mesmo
   tendo mensagem do cliente sem resposta.
```

O problema esta nas **linhas 1063-1090** vs **linhas 1124-1134** do `receive-webhook/index.ts`. A atualizacao da conversa (incluindo `last_message_direction`) acontece ANTES da verificacao de duplicatas. Entao, mesmo para mensagens duplicadas vindas do webhook `send.message`, a direcao da conversa e sobrescrita.

## Solucao

Mover a verificacao de duplicatas para ANTES de qualquer atualizacao na conversa. Assim, se a mensagem ja existe no banco, todo o processamento e pulado, incluindo a atualizacao incorreta de `last_message_direction`.

## Alteracao

### `supabase/functions/receive-webhook/index.ts`

Adicionar verificacao de duplicata logo apos encontrar a conversa (por volta da linha 942), ANTES do bloco que atualiza/cria a conversa:

```typescript
// ANTES do bloco if (!conversation) / else que cria/atualiza a conversa:

// Early dedup check - skip entirely if message was already processed
// This prevents send.message webhook echoes from overwriting
// last_message_direction on conversations
if (key.id && conversation) {
  const { data: existingMsg } = await supabase
    .from('inbox_messages')
    .select('id')
    .eq('whatsapp_message_id', key.id)
    .maybeSingle();

  if (existingMsg) {
    console.log(`[DEDUP] Message ${key.id} already exists, skipping entirely`);
    continue;
  }
}
```

Manter tambem a verificacao existente nas linhas 1124-1134 como fallback de seguranca (para o caso de novas conversas onde `conversation` era null no momento da verificacao antecipada).

### Arquivo a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/receive-webhook/index.ts` | Adicionar verificacao de duplicata antecipada antes do bloco de atualizacao da conversa |

### Impacto

- Corrige o filtro "Sem resposta" que perde conversas incorretamente
- Reduz processamento desnecessario de webhooks duplicados (evita queries e updates extras)
- Nenhuma mudanca no frontend -- o filtro em `ConversationList.tsx` ja funciona corretamente
- O campo `last_message_direction` no banco ja esta sendo populado pelas edge functions; o problema e exclusivamente na sobrescrita indevida

