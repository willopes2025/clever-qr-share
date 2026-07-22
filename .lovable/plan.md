## Diagnóstico

O contato "Coloquei Deus acima de Tudo" (id `00f6b3e8…`) ficou com telefone `LID_1219888197746` porque veio de anúncio Click-to-WhatsApp e o Evolution devolveu apenas o `@lid`, sem o telefone real na primeira mensagem.

Investiguei o Evolution da instância **Soul Muscle** e confirmei:

- `POST /chat/findContacts/Soul Muscle` → devolve o registro do LID **sem** o campo `lid`/`remoteJid` mapeando para o número real. É por isso que tanto o `receive-webhook` quanto o cron `resolve-lid-contacts` (ambos usam `findContacts`) não conseguem resolver.
- `POST /chat/findMessages/Soul Muscle` com `where.key.remoteJid = "1219888197746@lid"` → devolve as mensagens com `key.remoteJidAlt = "559294418204@s.whatsapp.net"`. **Esse é o telefone real** do lead.

Além disso, esse contato específico nunca entrou em `lid_resolution_queue` (a fila está vazia para ele), então mesmo o modo `queue` do resolver nunca tentaria processá-lo — só o modo `all` o pegaria, e ainda assim falharia pelo motivo acima.

## O que fazer

### 1. Adicionar fallback `findMessages` no resolvedor de LID

Em `supabase/functions/resolve-lid-contacts/index.ts`, quando `fetchInstanceContacts` (que usa `findContacts`) **não** encontra o `labelId` do contato, fazer uma segunda chamada:

```
POST /chat/findMessages/{instance}
body: { where: { key: { remoteJid: "<labelId>@lid" } }, limit: 20 }
```

Percorrer os `records` e pegar o primeiro `key.remoteJidAlt` que termine com `@s.whatsapp.net`/`@c.us`. Normalizar com `normalizePhone` e usar como telefone real (segue o mesmo fluxo `processContact` já existente: merge se já existir contato com esse número, senão apenas atualiza `phone` e limpa `custom_fields.lid_unresolved`).

Cachear em memória por instância para não repetir chamadas na mesma execução.

### 2. Aplicar o mesmo fallback no `receive-webhook`

Em `supabase/functions/receive-webhook/index.ts` (bloco `[LID] ... Resolved real phone from cached map`, linhas ~680–740), se após consultar o cache do `findContacts` o telefone ainda não for válido, fazer a mesma chamada `findMessages` para o `labelId` atual **antes** de cair no `phone = LID_${labelId}`. Isso evita que novos contatos entrem no sistema já como `LID_`.

### 3. Backfill: enfileirar todos os LID_ existentes

Rodar uma migração única que insere todos os contatos ainda com `phone LIKE 'LID_%'` em `lid_resolution_queue` (com `attempts = 0`, `resolved_at = null`), para que o cron `resolve-lid-queue` (modo `queue`) os processe usando o novo fallback.

```sql
INSERT INTO lid_resolution_queue (contact_id, label_id, user_id, attempts)
SELECT id, COALESCE(label_id, substr(phone, 5)), user_id, 0
FROM contacts
WHERE phone LIKE 'LID_%'
ON CONFLICT (contact_id) DO UPDATE
SET attempts = 0, resolved_at = NULL, last_error = NULL;
```

### 4. Disparo manual imediato

Depois do deploy, invocar `resolve-lid-contacts` com `{ "mode": "queue" }` para reprocessar todos os LIDs pendentes de uma vez. O contato do print deve virar `559294418204` automaticamente (ou ser mergeado se já existir outro contato com esse número no mesmo user).

## Notas técnicas

- `findMessages` retorna `records` dentro de `messages` em algumas versões do Evolution; o código deve tolerar tanto `data.messages.records` quanto `data[]`.
- O merge de contatos duplicados já é tratado por `mergeContacts` — nenhum ajuste extra necessário.
- Nenhuma alteração de UI: o cabeçalho da conversa passa a mostrar o telefone real assim que o contato for atualizado, e o realtime do inbox reflete a mudança sem refresh manual.
