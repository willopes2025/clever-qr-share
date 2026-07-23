
# Exibir respostas de formulário Meta Ads no Inbox

O painel "Resposta ao formulário" que aparece no WhatsApp Business Web (print enviado) vem de dois lugares possíveis — precisamos tratar ambos para que os dados (Nome, Email, Telefone e demais campos) apareçam na conversa do Inbox do Widezap:

1. **WhatsApp Flows / Instant Forms** — o lead abre o anúncio, o form é preenchido dentro do WhatsApp e a resposta chega no webhook Meta como uma mensagem `type: "interactive"` com `interactive.type = "nfm_reply"` contendo `response_json` (JSON com os campos preenchidos). Hoje o `meta-whatsapp-webhook` só lê `button_reply`/`list_reply`, então o conteúdo cai no fallback `[Interativo]` e o JSON é descartado.
2. **Lead Ads clássicos (Facebook/Instagram Lead Forms)** — não chegam pelo webhook do WhatsApp; chegam pelo webhook de Page com o campo `leadgen`. Precisa assinar o campo `leadgen` na Page e buscar o lead completo em `/{lead_id}?fields=field_data,created_time,ad_id,form_id` usando o page access token.

## O que vamos construir

### 1. Captura no webhook Meta WhatsApp (Flows / nfm_reply)
Arquivo: `supabase/functions/meta-whatsapp-webhook/index.ts` (case `'interactive'`).
- Detectar `message.interactive?.type === 'nfm_reply'`.
- Fazer `JSON.parse(message.interactive.nfm_reply.response_json)` — ele traz `flow_token` + os campos (`screen_0_Nome_0`, `screen_0_Email_1`, etc.).
- Normalizar em um objeto `{ label, value }[]` (mapeando os nomes técnicos para rótulos legíveis quando possível).
- Persistir na mensagem do inbox:
  - `message_type = 'form_response'`
  - `content` = resumo textual ("Resposta ao formulário: Nome — …, Email — …") para busca/preview
  - `metadata.form_response = { title, fields: [{label,value}], flow_token, name_token }`
- Se vier `email` ou telefone alternativo, popular `contacts.email` e `contacts.custom_fields` (respeitando a regra "1 Contact por phone").

### 2. Captura de Lead Ads clássicos (leadgen)
Nova edge function: `receive-meta-leadgen-webhook` (pública, sem JWT) — separada porque a assinatura é no objeto `page`, campo `leadgen`, distinta do webhook WhatsApp/Messenger.
- Verify token igual ao dos outros webhooks Meta.
- Ao receber `leadgen`: pegar `leadgen_id`, `page_id`, `form_id`, `ad_id`.
- Resolver a Page em `meta_messenger_accounts` (já temos `page_access_token`).
- Buscar `GET /{leadgen_id}?fields=field_data,created_time,ad_id,form_id,campaign_id` com o page token.
- Normalizar `field_data` → `[{name,value}]`, extrair `phone_number`/`email`/`full_name`.
- Criar/mesclar Contact pelo telefone (via `normalizePhone`) e Deal no funil padrão da organização, com `tracking = { source:'meta_lead_ads', form_id, ad_id, campaign_id, ctwa_clid:null }`.
- Se já existe conversa (contato tem WhatsApp), inserir uma mensagem `message_type='form_response'` com os campos, para aparecer no Inbox exatamente como no print.
- Assinar `leadgen` automaticamente em `connect-meta-messenger` (adicionar `leadgen` na lista `subscribed_fields` já existente para páginas).

### 3. UI no Inbox
Novo componente: `src/components/inbox/FormResponseMessage.tsx`.
- Renderizado quando `message_type === 'form_response'`.
- Card com título "Resposta ao formulário" + lista `label / value` (visual similar ao painel lateral do WhatsApp do print).
- Integrado em `MessageBubble.tsx` (onde já existem os handlers de `location`, `contact`, etc.).

### 4. Painel lateral do lead
Em `LeadPanel` (aba de tracking/atividade), adicionar bloco "Formulários preenchidos" listando todas as `form_response` da conversa/contato, com data e origem (Flow do WhatsApp ou Lead Ad).

## Detalhes técnicos

- Migração: adicionar `'form_response'` como valor válido em `inbox_messages.message_type` (se houver CHECK/enum). Nenhuma coluna nova — usar `metadata jsonb`.
- Assinatura da Page: `connect-meta-messenger` já faz POST em `/subscribed_apps?subscribed_fields=messages,messaging_postbacks,...` — acrescentar `leadgen` na lista.
- Segurança: `receive-meta-leadgen-webhook` valida `x-hub-signature-256` com `META_WHATSAPP_APP_SECRET` (mesma app), mesmo padrão do `receive-meta-messenger-webhook`.
- Deduplicação: usar `leadgen_id` como chave idempotente em `metadata.form_response.external_id` para não duplicar quando a Meta reenviar.
- Sem alterações em `receive-webhook` (Evolution) — este fluxo é exclusivo Meta.

## Pontos que preciso confirmar antes de codar

1. Os formulários que você quer que apareçam vêm de **anúncios Click-to-WhatsApp com formulário instantâneo** (usuário preenche dentro do WhatsApp) ou de **Lead Ads tradicionais do Facebook/Instagram** (o form abre no Facebook, sem WhatsApp)? — determinam se implemento só o item 1, só o item 2, ou os dois.
2. Quando chegar um Lead Ad tradicional sem WhatsApp associado, devo criar o Deal no **funil padrão da organização** ou usar um funil específico configurável em Configurações → Integrações Meta?
