## Objetivo
Eliminar contatos identificados por `LID_xxxxx` na plataforma: converter os 732 existentes em telefone real (formato `55DDDNNNNNNNN`) e garantir que novos leads vindos de "Click-to-WhatsApp Ads" entrem já com o número correto.

## Situação atual
- 732 contatos com `phone` no formato `LID_<label_id>` (todos têm `label_id` preenchido).
- O webhook `receive-webhook` já tenta extrair o número real do `remoteJidAlt`/`participant`. Quando não consegue, salva como `LID_…` como fallback temporário e tenta promover para telefone real nas mensagens seguintes (linhas 1019-1040 do `index.ts`).
- O problema é que muitos contatos vindos de anúncios nunca trazem o `remoteJidAlt`, então ficam presos no LID para sempre.

---

## Etapa 1 — Backfill dos 732 contatos existentes

Criar nova edge function `resolve-lid-contacts` (admin-only) que:

1. Carrega todos os contatos com `phone LIKE 'LID_%'` agrupados por `user_id` (dono da instância).
2. Para cada instância Evolution ativa do dono, chama `POST {EVOLUTION_API_URL}/chat/findContacts/{instance}` para obter o cadastro completo. A resposta da Evolution traz, para cada contato salvo no aparelho, tanto o JID real (`@s.whatsapp.net`) quanto o `lid` correspondente — é a única forma confiável de mapear LID ↔ telefone.
3. Monta um índice `label_id → telefone real` e atualiza cada contato:
   - Normaliza o telefone (`55` + DDD + número, regras de `normalizePhone`).
   - Se já existir outro contato com aquele telefone real na mesma organização, faz **merge**: move `conversations`, `inbox_messages`, `funnel_deals`, `conversation_tasks`, `contact_activity_log`, `contact_tags` para o contato existente e apaga o duplicado LID.
   - Se não existir, apenas atualiza `phone` (mantém `label_id` para auditoria).
4. Para LIDs que a Evolution não souber resolver (contato nunca trocou mensagem confirmada com a instância), tenta fallback: ler `remoteJidAlt` da última mensagem armazenada via Evolution (`/chat/findMessages/{instance}` com `where.key.remoteJid = '<lid>@lid'`). Os que continuarem sem telefone ficam marcados em `custom_fields.lid_unresolved = true` para revisão manual.
5. Gera um relatório em JSON com: total resolvidos, total merged, total não-resolvidos.

A função é disparada pela página de admin com um botão "Resolver contatos LID" (admin do sistema apenas, via `has_role(uid,'admin')`).

## Etapa 2 — Prevenir novos `LID_` no `receive-webhook`

Alterações em `supabase/functions/receive-webhook/index.ts` no bloco que hoje cai em `useLidAsIdentifier = true` (linhas 663-685):

1. **Antes de criar `LID_xxx`**, chamar de forma síncrona `POST /chat/findContacts/{instance}` filtrando por `lid` (Evolution v2 aceita `where: { lid: '<labelId>@lid' }`). Se vier `remoteJid` real → usar como telefone normal.
2. Fallback secundário: `GET /chat/whatsappNumbers/{instance}` informando o LID, que retorna o JID resolvido em algumas versões.
3. Se ambos falharem, manter a lógica atual (cria `LID_<labelId>`), porém também enfileira um job (insert em nova tabela `lid_resolution_queue` com `label_id`, `instance_id`, `attempts`) para o cron rodar a Etapa 1 sobre ele a cada 30 min, até resolver ou atingir 10 tentativas.
4. Quando uma mensagem futura chegar trazendo `remoteJidAlt` real para um contato `LID_…`, manter o upgrade já existente (linha 1022) — sem mudança.

## Etapa 3 — Agendamento periódico

- Criar cron `pg_cron` que invoca `resolve-lid-contacts` (modo "fila apenas") a cada 30 min para varrer a tabela `lid_resolution_queue` recém-criada. Sem necessidade de admin manual após a primeira execução em massa.

---

## Detalhes técnicos
- **Nova tabela** `lid_resolution_queue` em `public` com `id`, `contact_id`, `label_id`, `instance_id`, `user_id`, `attempts`, `last_attempt_at`, `resolved_at`, `created_at`. RLS: leitura/gravação apenas para `service_role`; admins podem ler via `has_role(uid,'admin')`. GRANTs padrão para `service_role`.
- **Merge** de contatos no Etapa 1 reaproveita o padrão do hook `useMergeDeals` no client — porém aqui é server-side, dentro da edge function, em transação por contato (`update` em ordem fixa para evitar violar FK `conversations.contact_id`).
- **Normalização** usa a mesma `normalizePhone` já definida no webhook (extraída para `supabase/functions/_shared/phone.ts` para ser reusada).
- **Evolution endpoint** `POST /chat/findContacts/{instance}`: enviado `{ where: {} }` retorna lista completa; usamos paginação se a instância tiver muitos contatos.
- Sem mudanças em UI além do botão admin "Resolver contatos LID" em `src/pages/Admin.tsx` com toast de progresso e contador final.

## Entregáveis
1. Migration: tabela `lid_resolution_queue` + GRANTs + RLS + cron.
2. `supabase/functions/_shared/phone.ts` (extração da `normalizePhone`).
3. `supabase/functions/resolve-lid-contacts/index.ts` (backfill + processamento de fila).
4. Patch em `supabase/functions/receive-webhook/index.ts` (resolução síncrona + enfileiramento).
5. Botão admin em `src/pages/Admin.tsx`.

## Riscos
- A Evolution só conhece o LID se o número já estiver no cadastro do aparelho. Para contatos vindos apenas de anúncio sem nunca terem virado contato salvo, o telefone só aparece quando o usuário responder; nesses casos o upgrade automático já existente (Etapa 2 item 4) resolverá quando o `remoteJidAlt` chegar.
- Merge apaga o contato LID — todos os históricos são preservados ao serem reapontados para o contato real antes da exclusão.
