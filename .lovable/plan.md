## Objetivo

Adicionar um canal de **E-mail** ao Widezap, no mesmo nível do WhatsApp: cada organização conecta a caixa compartilhada da empresa (Gmail, Outlook 365 ou IMAP/SMTP), o Inbox sincroniza recebidos e enviados, e a plataforma passa a enviar e-mails por template — manualmente, por automação de funil, por campanha, por chatbot e por webhook externo.

## Escopo confirmado com você

- Provedores: Gmail (OAuth), Outlook/M365 (OAuth) e IMAP/SMTP genérico.
- Conexão: **1 caixa compartilhada por organização** (não por atendente).
- Inbox: aba própria só de E-mail (separada do WhatsApp).
- Gatilhos: automações de funil, campanhas em massa, chatbots e webhooks/API externa.

## Como vai funcionar (visão do usuário)

1. Em **Configurações → Canais de E-mail**, o admin clica em "Conectar Gmail" (ou Outlook) e faz OAuth com a conta compartilhada da empresa (ex.: `contato@empresa.com`). Para outros provedores, preenche host IMAP + SMTP + credencial.
2. A partir daí, o Inbox ganha uma aba **E-mail** ao lado das instâncias de WhatsApp, com lista de conversas por contato, leitor de mensagem e composer com anexos.
3. Em **Templates**, é possível criar templates de e-mail (assunto + corpo HTML rico + variáveis do lead/contato) separados dos templates de WhatsApp.
4. Nas **Automações de Funil**, aparece uma nova ação "Enviar e-mail" com seletor de template e caixa de origem.
5. Nas **Campanhas**, um switch escolhe o canal (WhatsApp ou E-mail); o envio em lote passa a suportar e-mail.
6. No **Chatbot Builder**, novo tipo de nó "Enviar e-mail".
7. Nos **Webhooks / API externa**, novo endpoint documentado para disparar template de e-mail.

## Fases de entrega

Recomendo entregar em 4 fases para o app subir estável — cada fase é utilizável sozinha:

### Fase 1 — Conexão + Inbox (Gmail primeiro)
- Tabela `email_channels` por organização (provider, credenciais, from address, display name, status).
- Fluxo OAuth Gmail com credenciais próprias do Widezap (um único OAuth app registrado no Google Cloud, tokens de cada org guardados na tabela).
- Sync inicial das últimas N mensagens + sync incremental via Gmail History API a cada 1 min (cron pg_cron).
- Tabelas `email_threads`, `email_messages`, `email_attachments` (arquivos no Supabase Storage).
- Aba E-mail no Inbox (lista de threads, leitor, composer básico com responder/encaminhar).
- Vínculo automático da thread ao `contacts` pelo endereço de e-mail (cria contato se não existir).

### Fase 2 — Outlook + IMAP/SMTP
- OAuth Microsoft Graph com o mesmo padrão da Fase 1.
- IMAP/SMTP: formulário com host/porta/usuário/senha, credenciais criptografadas via Vault.
- Sync IMAP por polling (cron 2 min).
- Envio via SMTP para IMAP; via Graph API para Outlook.

### Fase 3 — Templates + envio manual e por automação
- Tabela `email_templates` (assunto, HTML, variáveis, org_id) + página de gerenciamento com editor rich text (usa a lib TipTap já no projeto ou react-email).
- Preview com dados fake e renderização real com variáveis do contato/deal.
- Edge function unificada `send-email` (resolve channel + template + destinatário + variáveis, envia pelo provider correto, grava mensagem enviada na thread).
- Nova ação nas automações de funil: "Enviar e-mail" (template + canal de origem).

### Fase 4 — Campanhas, Chatbot e Webhooks
- Campanhas: coluna `channel` em `campaigns`, seletor no wizard, dispatcher em batch por cron (reaproveita o padrão atual de campanha WhatsApp, com throttle específico para e-mail).
- Chatbot Builder: novo tipo de nó `send_email`.
- Endpoint `POST /functions/v1/api-send-email` protegido por API key da organização.
- Rastreio opcional de abertura (pixel) e clique (link rewrite), desligado por padrão.

## Detalhes técnicos

### Novas tabelas (com RLS por organização, seguindo padrão atual do projeto)

```text
email_channels
  id, organization_id, provider (gmail|outlook|imap), from_address, display_name,
  oauth_access_token, oauth_refresh_token, oauth_expires_at,
  imap_host, imap_port, imap_user, imap_pass_encrypted,
  smtp_host, smtp_port, smtp_user, smtp_pass_encrypted,
  history_id, last_sync_at, status, is_active

email_threads
  id, organization_id, channel_id, contact_id, subject,
  provider_thread_id, last_message_at, unread_count, is_archived

email_messages
  id, thread_id, direction (in|out), from_addr, to_addrs[], cc_addrs[], bcc_addrs[],
  subject, body_html, body_text, provider_message_id, in_reply_to,
  sent_at, received_at, is_read, sent_by_user_id

email_attachments
  id, message_id, filename, mime_type, size, storage_path

email_templates
  id, organization_id, name, subject, body_html, variables[], created_by
```

Todas com `GRANT` para `authenticated`/`service_role` no mesmo migration e políticas RLS usando `get_organization_member_ids` (padrão do projeto).

### Novas Edge Functions

- `email-oauth-start` / `email-oauth-callback` (Gmail e Outlook)
- `email-sync` (cron a cada 1 min — puxa histórico Gmail/Outlook, poll IMAP)
- `email-webhook-gmail` (Pub/Sub push, quando ligarmos)
- `send-email` (chamada por UI, automação, campanha, chatbot, webhook)
- `api-send-email` (endpoint público autenticado por API key)

### Segredos que serão necessários

- `GMAIL_OAUTH_CLIENT_ID` / `GMAIL_OAUTH_CLIENT_SECRET` (você registra 1 OAuth app no Google Cloud)
- `MICROSOFT_OAUTH_CLIENT_ID` / `MICROSOFT_OAUTH_CLIENT_SECRET` (registrar no Entra ID)
- `EMAIL_CREDS_ENCRYPTION_KEY` (para criptografar senhas SMTP/IMAP no banco)

Vou pedir esses segredos quando cada fase começar, não agora.

### Fora do escopo desta feature

- Não altera o sistema de e-mails transacionais/auth existente (`send-transactional-email`, `auth-email-hook`) — aquele é do próprio Widezap para os usuários da plataforma; este é canal de comunicação com os leads dos clientes.
- Marketing/newsletter em massa continua fora — campanhas serão transacionais/1:1 disparadas por evento, respeitando volumes razoáveis.

## Pergunta antes de começar

Quer que eu **entregue tudo em sequência** (fases 1 → 4) ou prefere que eu **comece só pela Fase 1** (Gmail + Inbox) para você validar o fluxo antes de expandir? Confirme também se posso iniciar já pela Fase 1 com este plano.
