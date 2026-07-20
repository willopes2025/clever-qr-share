
# Suporte a Múltiplos Provedores de E-mail

Hoje só o Gmail (OAuth Google) pode ser conectado. Vou adicionar dois novos caminhos que cobrem 95% dos casos:

1. **Microsoft / Outlook / Office 365** via OAuth (Microsoft Graph API)
2. **IMAP/SMTP genérico** (Outlook, Yahoo, iCloud, Zoho, domínios próprios, cPanel, etc.) via usuário + senha de app

Todos aparecem lado a lado como "contas conectadas", com envio, recebimento e sincronização.

---

## 1. Banco de dados (`email_channels`)

Adicionar colunas para suportar IMAP/SMTP (o `provider` já existe):

- `imap_host`, `imap_port`, `imap_secure` (bool)
- `smtp_host`, `smtp_port`, `smtp_secure` (bool)
- `auth_username`, `auth_password_encrypted` (usa `vault` do Supabase)
- `last_uid` (para sincronização incremental IMAP)

Providers válidos: `gmail`, `microsoft`, `imap`.

## 2. Microsoft OAuth (Outlook / Office 365 / Hotmail)

Nova edge function `email-oauth-start-microsoft` e reuso do callback (unificado).

- Escopos: `Mail.ReadWrite Mail.Send offline_access User.Read`
- Endpoint auth: `login.microsoftonline.com/common/oauth2/v2.0/authorize`
- Redirect: `email-oauth-callback` (detecta provider pelo `state`)
- Secrets novos: `MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET`
- Refresh token no shared helper (novo `_shared/microsoft.ts`)

Sync via Microsoft Graph: `GET /me/mailFolders/inbox/messages` + `/sentitems/messages`. Envio: `POST /me/sendMail`.

## 3. IMAP/SMTP genérico

Nova edge function `email-connect-imap` que aceita:
```
{ email, password, imap_host, imap_port, smtp_host, smtp_port, display_name }
```

- Testa login IMAP e SMTP antes de salvar
- Salva senha criptografada via `vault.create_secret`
- Presets pré-carregados na UI para: Outlook (`outlook.office365.com`/`smtp.office365.com`), Yahoo, iCloud, Zoho, UOL, Locaweb, HostGator

Bibliotecas Deno:
- IMAP: `npm:imapflow`
- SMTP: `npm:nodemailer` (envio) ou `denomailer`

Novas edge functions:
- `email-sync` estendida — despacha para Gmail/Microsoft/IMAP conforme `provider`
- `email-send` estendida — mesma lógica

## 4. Frontend

Substituir o `ConnectCard` atual (só Gmail) por um seletor:

```
┌── Conectar conta de e-mail ──┐
│  [Google/Gmail]              │
│  [Microsoft/Outlook]         │
│  [Outro (IMAP/SMTP)]         │
└──────────────────────────────┘
```

- Google e Microsoft: fluxo popup OAuth (igual ao atual)
- IMAP: abre `Dialog` com campos (e-mail, senha, host, portas) + botões de preset

O botão "Adicionar conta" no rodapé abre o mesmo seletor.

Sem mudança no viewer de threads — a estrutura de `email_threads`/`email_messages` é agnóstica ao provider.

## 5. Detalhes técnicos

- Migração criando as novas colunas + índices em `provider`
- `provider_message_id` continua único por canal
- Ao sincronizar IMAP, usar `UID SEARCH SINCE` para incrementar via `last_uid`
- Senhas IMAP: gravar em `vault.secrets` e guardar apenas o `secret_id` em `email_channels`
- Erros de auth marcam `status='error'` e `last_error` (padrão já existente)

## 6. Ordem de entrega

1. Migração de banco
2. Edge functions Microsoft (start + integração no callback + sync + send)
3. Edge functions IMAP (connect + sync + send)
4. Refatorar `email-sync`/`email-send` para roteamento por provider
5. UI: seletor de provedor + diálogo IMAP + presets
6. Secrets Microsoft (pedir via `add_secret` ao chegar nessa etapa)

## Perguntas antes de começar

- Você já tem um **app registrado no Microsoft Entra/Azure** (para OAuth Outlook)? Se não, posso implementar só IMAP primeiro (que já cobre Outlook via `outlook.office365.com` com senha de app) e o OAuth Microsoft fica opcional.
