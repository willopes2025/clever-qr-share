Hoje o link copiado no Inbox é do tipo:

```text
https://.../form/<slug>/contact_id=<uuid>/conversation_id=<uuid>
```

Fica gigante porque carrega dois UUIDs. Vamos encurtar e, no mesmo movimento, transformar em link "de afiliado" com rastreio de quem enviou.

## 1. Encurtador nativo (estilo short.io)

Nova tabela `form_short_links` guarda um código curto (8 caracteres, ex.: `k9Xa2P7q`) mapeando para o formulário + parâmetros originais:

- `code` (unique, 8 chars) — o que aparece na URL
- `form_id`, `slug`
- `static_params` (jsonb) — contact_id / conversation_id / quaisquer outros
- `shared_by_user_id` — quem gerou o link (o "líder")
- `organization_id`
- `click_count`, `last_click_at` (para métricas simples)
- `created_at`

Rota nova: `/f/:code` (React Router).
`ShortLinkRedirect.tsx` consulta a tabela, incrementa `click_count` e navega para a URL completa do formulário já com `?shared_by=<user_id>` embutido.

Link final passa de ~120 caracteres para algo como:

```text
https://zap.wideic.com/f/k9Xa2P7q
```

## 2. Rastreio de quem enviou (afiliado)

- Coluna nova em `form_submissions`: `shared_by_user_id uuid` (FK para `auth.users`).
- Coluna nova em `contacts`: `first_shared_by_user_id uuid` — preenchida só na primeira vez, para não sobrescrever quando o mesmo lead voltar por outro link.
- A edge function `submit-form` (ou equivalente) lê o `shared_by` vindo da URL/short link e grava nas duas colunas.
- Cada submissão passa a ter, junto com os dados, o nome do líder que compartilhou o link — visível na listagem de submissões e disponível para relatórios/CRM.

## 3. UI do botão no Inbox

`src/components/inbox/FormLinkButton.tsx`:

- Ao selecionar o formulário, chama edge function `create-form-short-link` passando `{ form_id, contact_id, conversation_id }`.
- Edge function reaproveita um short link existente com os mesmos parâmetros (evita duplicar códigos) ou cria um novo.
- Insere/copia sempre o link curto (`/f/<code>`), não o longo.
- Fallback: se a criação falhar, cai no formato antigo para não travar o envio.

## 4. Onde ver o rastreio

- Tabela de submissões do formulário passa a mostrar coluna "Compartilhado por" (nome vindo de `profiles`).
- No card do contato/deal, mostrar "Origem: link enviado por <Nome>" quando `first_shared_by_user_id` estiver preenchido.

## Detalhes técnicos

Arquivos:

- `supabase/migrations/*_form_short_links.sql` — cria `form_short_links`, GRANTs, RLS (SELECT público por `code`; INSERT/UPDATE restritos ao dono/organização), adiciona colunas `shared_by_user_id` em `form_submissions` e `first_shared_by_user_id` em `contacts`.
- `supabase/functions/create-form-short-link/index.ts` — POST autenticado, gera código único (nanoid-like, 8 chars alfanuméricos, retry em colisão), persiste e retorna `{ code, url }`.
- `supabase/functions/resolve-form-short-link/index.ts` (ou fazer a leitura direto do client via `anon` SELECT por `code`) — retorna `form_slug` + `static_params` + `shared_by_user_id`; incrementa `click_count`.
- `supabase/functions/public-form/index.ts` e `submit-form` — passar `shared_by` do query string para dentro do HTML do form (hidden field) e gravar na submissão.
- `src/pages/ShortLinkRedirect.tsx` — nova página em `/f/:code` que resolve e faz `window.location.replace` para `/form/<slug>/...` com parâmetros já embutidos.
- `src/App.tsx` — registrar rota `/f/:code`.
- `src/components/inbox/FormLinkButton.tsx` — trocar `generateFormLink` por chamada assíncrona ao endpoint de short link.
- `src/components/forms/submissions/*` — nova coluna "Compartilhado por" (join com `profiles`).

Códigos curtos usam alfabeto `[A-Za-z0-9]` (62^8 ≈ 218 trilhões de combinações) — colisão praticamente nula.

Nenhum serviço externo (short.io etc.) é necessário; tudo roda no Lovable Cloud usando o domínio publicado (`zap.wideic.com`), então o link continua com sua marca.
