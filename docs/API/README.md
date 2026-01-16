# Documentação das APIs (Edge Functions)

## Visão Geral

As Edge Functions são funções serverless que executam no Supabase Edge Runtime (Deno).

**Base URL:** `https://<project-id>.supabase.co/functions/v1/`

## Autenticação

A maioria das funções requer autenticação via Bearer Token:

```typescript
const { data, error } = await supabase.functions.invoke('nome-funcao', {
  body: { /* payload */ }
});
```

O token é enviado automaticamente pelo cliente Supabase quando o usuário está logado.

---

## Índice por Categoria

### 📬 [Inbox / Mensagens](./inbox.md)
- `send-inbox-message` - Enviar mensagem de texto
- `send-inbox-media` - Enviar mídia (imagem, áudio, documento)
- `receive-webhook` - Receber mensagens (webhook)
- `receive-instagram-webhook` - Webhook do Instagram

### 📢 [Campanhas](./campaigns.md)
- `start-campaign` - Iniciar campanha
- `send-campaign-messages` - Processar envios
- `pause-campaign` - Pausar campanha
- `resume-campaign` - Retomar campanha

### 🤖 [IA / Chatbot](./ai.md)
- `inbox-ai-assistant` - Assistente de IA para inbox
- `chatbot-ai-condition` - Avaliação de condições
- `transcribe-audio` - Transcrição de áudio
- `analyze-conversation` - Análise de conversa

### 📱 [WhatsApp](./whatsapp.md)
- `connect-whatsapp` - Conectar instância
- `disconnect-whatsapp` - Desconectar instância
- `check-whatsapp-status` - Verificar status
- `get-whatsapp-qrcode` - Obter QR Code

### 💳 [Pagamentos](./payments.md)
- `stripe-webhook` - Webhook do Stripe
- `create-checkout-session` - Criar sessão de pagamento
- `asaas-webhook` - Webhook do Asaas
- `generate-asaas-payment` - Gerar cobrança Asaas

### 📅 [Calendário](./calendar.md)
- `calendly-webhook` - Webhook do Calendly
- `calendly-oauth-callback` - OAuth do Calendly
- `get-calendly-event-types` - Listar tipos de evento

### 🔊 [Voz / Telefonia](./voice.md)
- `initiate-outbound-call` - Iniciar chamada
- `elevenlabs-sip-webhook` - Webhook ElevenLabs

### 👤 [Usuários / Admin](./admin.md)
- `create-user` - Criar usuário
- `admin-update-user-password` - Atualizar senha

---

## Formato de Resposta Padrão

### Sucesso

```json
{
  "success": true,
  "data": {
    // dados retornados
  }
}
```

### Erro

```json
{
  "success": false,
  "error": "Mensagem de erro"
}
```

---

## Tratamento de Erros

```typescript
try {
  const { data, error } = await supabase.functions.invoke('funcao', {
    body: payload
  });
  
  if (error) {
    console.error('Erro na função:', error.message);
    return;
  }
  
  // Usar data
} catch (err) {
  console.error('Erro de rede:', err);
}
```

---

## Headers CORS

Todas as funções incluem headers CORS padrão:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

---

## Variáveis de Ambiente

As funções têm acesso às seguintes variáveis:

| Variável | Descrição |
|----------|-----------|
| `SUPABASE_URL` | URL do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço |
| `SUPABASE_ANON_KEY` | Chave anônima |

Secrets adicionais são configurados por função.
