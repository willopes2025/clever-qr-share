

## Problema Identificado

Quando uma campanha Meta envia uma mensagem, ela persiste a conversa buscando por `contact_id + user_id`. Porém, quando o cliente responde via WhatsApp, o webhook da Meta recebe o telefone no formato internacional (ex: `5573996710XX`) e busca o contato por `phone = contactPhone` com correspondência exata.

Se o telefone salvo no contato estiver em formato diferente (ex: `73996710XX`, `(73) 99671-0XX`, ou `+5573996710XX`), o webhook **não encontra o contato existente**, cria um novo contato e uma nova conversa — resultando na mensagem de resposta aparecendo em uma conversa separada.

Além disso, a campanha cria conversas sem definir o campo `meta_phone_number_id`, o que pode causar problemas adicionais de roteamento.

## Plano de Correção

### 1. Normalizar busca de telefone no webhook Meta
**Arquivo:** `supabase/functions/meta-whatsapp-webhook/index.ts`

- Ao receber uma mensagem, o telefone vem no formato `55XXXXXXXXXXX` (sem `+`)
- Antes de buscar o contato, normalizar o telefone removendo caracteres especiais
- Implementar busca flexível: tentar match exato primeiro, depois tentar variações (com/sem código de país `55`, com/sem `+`)
- Usar busca SQL com `LIKE` ou múltiplas condições para cobrir formatos diferentes

### 2. Normalizar telefone ao criar contatos na campanha
**Arquivo:** `supabase/functions/send-campaign-messages/index.ts`

- Garantir que o telefone do contato seja salvo no mesmo formato que a Meta usa (`55XXXXXXXXXXX`) quando criado via campanha
- Ao persistir conversa na campanha, definir `meta_phone_number_id` na conversa criada

### 3. Adicionar `meta_phone_number_id` nas conversas de campanha
**Arquivo:** `supabase/functions/send-campaign-messages/index.ts`

- Ao criar nova conversa durante o envio de campanha Meta, incluir o `meta_phone_number_id` do número remetente
- Isso garante que respostas sejam corretamente associadas

## Detalhes Técnicos

No webhook (`meta-whatsapp-webhook/index.ts`), a busca atual é:
```typescript
// Busca EXATA - falha se formato diferir
.eq('phone', contactPhone)
```

Será alterada para busca normalizada:
```typescript
// Normalizar phone: remover +, espaços, traços, parênteses
// Tentar match com variações: 
//   contactPhone (ex: 5573996710XX)
//   sem código país (ex: 73996710XX)  
//   com + (ex: +5573996710XX)
```

No envio de campanha (`send-campaign-messages/index.ts`), ao criar conversa:
```typescript
// ANTES: sem meta_phone_number_id
.insert({ contact_id, user_id, status: 'open', provider: 'meta' })

// DEPOIS: com meta_phone_number_id
.insert({ contact_id, user_id, status: 'open', provider: 'meta', meta_phone_number_id: phoneNumberId })
```

