# Plano: Corrigir variável `{{primeiro_nome}}` + envio de áudio no chatbot

## Problemas identificados

### 1. Variável `{{primeiro_nome}}` não funciona
A função `substituteVars` em `supabase/functions/execute-chatbot-flow/index.ts` (linhas 283-293) só suporta `{{nome}}`, `{{name}}`, `{{telefone}}`, `{{phone}}`, `{{email}}`. Não há nenhum tratamento para extrair o **primeiro nome** do contato.

### 2. Áudio não é enviado (segunda mensagem do fluxo)
Na linha **482-498**, todo template com mídia usa o endpoint genérico `sendMedia`, inclusive áudios `.ogg`. A Evolution API exige o endpoint específico **`sendWhatsAppAudio`** para notas de voz. Por isso a mensagem fica salva como `sent` no banco mas com `whatsapp_message_id = NULL` (falha silenciosa).

Além disso, o código **não valida `response.ok`** — qualquer erro do provedor é ignorado e a mensagem é marcada como enviada mesmo quando falha.

### 3. Sem fallback para Meta API em mídias
Quando o número de origem é Meta (não Evolution), templates com mídia simplesmente são pulados — não há código para enviar mídia via Meta Cloud API dentro do fluxo de chatbot.

---

## Correções a implementar

### A) `supabase/functions/execute-chatbot-flow/index.ts`

**1. `substituteVars` (linhas 283-293)** — adicionar suporte a primeiro nome:
```ts
const fullName = (contact?.name || '').trim();
const firstName = fullName.split(/\s+/)[0] || '';
// adicionar substituições:
.replace(/\{\{primeiro_nome\}\}/gi, firstName)
.replace(/\{\{primeiroNome\}\}/gi, firstName)
.replace(/\{\{first_name\}\}/gi, firstName)
.replace(/\{\{firstName\}\}/gi, firstName)
```

**2. Bloco de envio de mídia em template (linhas 478-506)** — refatorar:
- Detectar se `tpl.media_type === 'audio'` → usar `${evolutionApiUrl}/message/sendWhatsAppAudio/${instanceName}` com payload `{ number, audio: media_url }`.
- Para `image | video | document` → manter `sendMedia` com `mediatype` correto.
- **Validar `response.ok`** e capturar `result.key.id`. Se falhar, marcar mensagem como `failed` e gravar `error_message` em `inbox_messages` (alinhado a `mem://tech/inbox/detailed-error-reporting`).
- **Enviar texto antes da mídia** (não como caption) com 2s de delay, conforme `mem://features/campaigns/envio-midia-templates`.

**3. Fallback Meta API para mídia em templates** — quando `instanceName` não existe mas `metaPhoneNumberId + metaAccessToken` existem:
- Para áudio: enviar via `${META_API_URL}/${metaPhoneNumberId}/messages` com `type: 'audio', audio: { link: media_url }`.
- Para imagem/vídeo/documento: usar tipo correspondente com `link` e `caption`.
- Validar resposta e persistir `whatsapp_message_id` ou `error_message`.

### B) `src/components/chatbot-builder/nodes/ChatbotNodeConfig.tsx` (ou arquivo de sugestões de variáveis)

- Adicionar `{{primeiro_nome}}` à lista de variáveis sugeridas exibidas no editor de mensagens do chatbot, junto às já existentes (`{{nome}}`, `{{telefone}}`, `{{email}}`).

### C) Memória (`mem://tech/inbox/voice-message-format-compatibility`)

- Reforçar que o roteamento de áudio dentro do chatbot também segue a regra `.ogg + sendWhatsAppAudio`.

---

## Arquivos afetados
- `supabase/functions/execute-chatbot-flow/index.ts` (correção principal)
- `src/components/chatbot-builder/nodes/ChatbotNodeConfig.tsx` (UI de variáveis)
- Atualização de memória sobre roteamento de áudio no chatbot

## Validação pós-deploy
1. Verificar logs da função `execute-chatbot-flow` no próximo disparo da campanha "FGTS / CLT" (ou re-teste com Wil Lopes 5527999400707).
2. Confirmar que o áudio chega ao destinatário (segunda mensagem do "Primeiro Disparo").
3. Confirmar que `{{primeiro_nome}}` é substituído pelo primeiro nome em mensagens do chatbot.
