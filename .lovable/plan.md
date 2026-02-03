
# Plano: Corrigir Envio de Mensagens para Contatos LID

## Problema Identificado

Os leads com erro mostram telefones no formato `LID_197186377756911`. Estes são contatos vindos de **Click-to-WhatsApp Ads**, onde o WhatsApp não fornece o número real, apenas um **Label ID (LID)**.

### Erro nos Logs

```
Evolution API response: {"status":400,"error":"Bad Request","response":{"message":[{"jid":"197186377756911@s.whatsapp.net","exists":false,"number":"197186377756911"}]}}
```

A Evolution API está tentando verificar se `197186377756911` é um número de telefone válido no WhatsApp, e obviamente falha porque LIDs não são números reais.

### Causa Raiz

No arquivo `send-inbox-message/index.ts`, linha 144-145:

```typescript
const sendPayload = isLidMessage 
  ? { number: remoteJid.replace('@lid', ''), options: { presence: 'composing' }, text: content }
  : { number: phone, text: content };
```

O código está removendo o sufixo `@lid`, enviando apenas o ID numérico (`197186377756911`).

### Código Correto (do ai-campaign-agent)

```typescript
// Em ai-campaign-agent/index.ts, linhas 1890-1895:
if (rawPhone.startsWith('LID_')) {
  isLidContact = true;
  const labelId = rawPhone.replace('LID_', '');
  phone = `${labelId}@lid`;  // ← MANTÉM o @lid!
}
```

A Evolution API requer que contatos LID sejam enviados com o formato `{labelId}@lid` completo.

## Solução

Modificar `send-inbox-message/index.ts` para manter o formato `@lid`:

```typescript
// ANTES (bugado):
const sendPayload = isLidMessage 
  ? { number: remoteJid.replace('@lid', ''), options: { presence: 'composing' }, text: content }
  : { number: phone, text: content };

// DEPOIS (correto):
const sendPayload = isLidMessage 
  ? { number: remoteJid, options: { presence: 'composing' }, text: content }
  : { number: phone, text: content };
```

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/send-inbox-message/index.ts` | Manter `@lid` no payload para contatos LID |

## Fluxo Após Correção

```text
1. Usuário envia mensagem para contato LID
2. Sistema detecta phone = "LID_197186377756911"
3. Formata remoteJid = "197186377756911@lid"
4. Payload enviado = { number: "197186377756911@lid", text: "..." }
5. Evolution API reconhece formato LID e envia corretamente ✅
```

## Nota Importante

Contatos com LID puro (sem número real armazenado) são uma limitação do WhatsApp para proteger privacidade de usuários que clicam em anúncios. Não há como "recuperar" o número real desses contatos - só é possível responder usando o LID enquanto a sessão estiver ativa no WhatsApp Business.

