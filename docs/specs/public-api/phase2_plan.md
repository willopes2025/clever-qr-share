# Plano de Implementação — Fase 2 (Painel de Gerenciamento de API Keys + Auditoria)

> **Autor**: Arquiteto sênior WideZap · **Data**: 2026-08-20
> **Base**: `docs/specs/public-api/project_spec.md` §8 (Fora de escopo) + §9 (Próximos passos)
> **Projeto de homologação**: `yxhjwpoaloqcnocpiyui.supabase.co`
> **Estilo**: mesmo molde da Fase 1 — decisões justificadas, alinhadas ao schema real, com riscos e rollback.

---

## 0. Contexto e o que a Fase 1 entregou

A Fase 1 implementou:
- **Public API** (`public-api/index.ts`): CRUD completo de contatos e leads com autenticação por API key, rate limit 5 req/s, envelopes de sucesso/erro padronizados.
- **Emissão/revogação de keys** (`admin-create-api-key/index.ts`): POST (criar), PATCH (revogar), GET (listar) — protegidos por JWT.
- **Schema de dados** (`api_keys`, `api_rate_limit`): RLS sem policies (service-role only), `key_hash` SHA-256, `key_prefix` para diagnóstico.
- **Smoke tests**: 19 cenários validados no ambiente de homologação.

**O que falta para a Fase 2:**
O spec §8.1 define: *"UI do painel para criar/revogar/renomear API keys"* como item fora de escopo. §9 lista: *"Painel de gerenciamento de API keys (UI) + auditoria de uso (last_used_at, logs)"* como próximo passo.

**A Fase 2 entrega:** a interface visual dentro do painel WideZap para que o usuário gerencie suas API keys sem precisar usar curl ou edge functions diretamente.

---

## 1. Mapa de arquivos (entregáveis)

```
src/hooks/useApiKeys.ts                                    # Hook: list, create, revoke keys
src/components/settings/ApiKeysSettings.tsx                # Componente principal (tab de settings)
src/components/settings/CreateApiKeyDialog.tsx             # Dialog de criação (mostra key 1x)
src/components/settings/RevokeApiKeyDialog.tsx             # Dialog de confirmação de revogação
src/components/settings/ApiKeyDisplayDialog.tsx            # Modal pós-criação com key completa
src/pages/Settings.tsx                                     # Atualizar: adicionar tab "API Keys"
supabase/functions/admin-create-api-key/index.ts           # Atualizar: adicionar GET id + DELETE + PATCH name
supabase/functions/_shared/public-api.ts                   # Adicionar: helper de audit log
docs/specs/public-api/phase2_plan.md                       # Este arquivo
```

---

## 2. Decisões de design

### 2.1 Onde fica a UI?

A tab de configurações existente (`/settings`) já tem 12 tabs. O padrão é:
- Cada tab = componente separado em `src/components/settings/`
- Visibilidade filtrada por `useOrganization().checkPermission('manage_settings')`
- `adminOnly: true` = só o dono admin da conta vê

**Decisão:** nova tab `api-keys` com `adminOnly: true` e `permission: 'manage_settings'`. O ícone será `Key` do Lucide. A tab fica entre "API" e "Dados" na lista.

**Justificativa:** gerenciar API keys é operação sensível — só o admin deve ter acesso. Segue o padrão de "Integrations" e "Data" que são adminOnly.

### 2.2 Fluxo de criação de key

O fluxo de criação de uma API key tem uma particularidade: **a key só pode ser vista uma vez** (não existe endpoint para recuperá-la depois). Isso exige um UX especial:

1. Usuário clica "Criar API Key"
2. Dialog abre com campo `name` (obrigatório) + `expires_at` (opcional)
3. Usuário confirma → POST para `admin-create-api-key`
4. Resposta retorna a key completa em texto puro
5. **Modal de exibição** abre com a key, botão "Copiar", aviso "Guarde esta chave"
6. Usuário fecha o modal → key nunca mais é mostrada (só prefixo)

**Decisão:** usar dois dialogs separados (criação + exibição) em vez de um só, para garantir que o usuário veja a key antes de fechar.

### 2.3 Fluxo de revogação

Revogar uma key é irreversível. O fluxo:

1. Usuário clica "Revogar" na row da key
2. Dialog de confirmação: "Tem certeza? Esta ação é irreversível."
3. PATCH para `admin-create-api-key` com `key_id`
4. Toast de sucesso + refetch da lista

### 2.4 Auditoria de uso

O schema `api_keys` já tem `last_used_at`. Para auditoria mais granular, preciso:

**Opção A (adotada):** usar `last_used_at` existente + exibir na UI "Último uso: há 2 horas". Sem tabela de logs por enquanto — o spec §9 menciona logs como melhoria futura.

**Opção B (futuro):** criar tabela `api_key_usage_logs` com `key_id, endpoint, ip, status, timestamp`. Fora desta fase.

### 2.5 Extensões do backend

O `admin-create-api-key` atual só tem GET (listar), POST (criar), PATCH (revogar). Para a UI completa, preciso adicionar:

| Método | Path | Body | Descrição |
|---|---|---|---|
| PATCH | `/admin-create-api-key` | `{ key_id, name }` | Renomear key (renomear) |
| DELETE | `/admin-create-api-key` | `{ key_id }` | Deletar key permanentemente (hard delete) |

**Justificativa:** a UI precisa de renomear e deletar. O DELETE é hard delete porque a key já foi revogada — não precisa de soft delete. O PATCH de renomear é útil quando o usuário quer mudar o nome descritivo.

### 2.6 Schema de dados (sem alteração)

As tabelas `api_keys` e `api_rate_limit` já existem com as colunas necessárias:

```
api_keys:
  id, user_id, organization_id, name, key_hash, key_prefix,
  created_at, last_used_at, expires_at, revoked_at
```

Não preciso de migration nova — a Fase 0 já criou tudo.

---

## 3. Detalhamento por arquivo

### 3.1 `src/hooks/useApiKeys.ts` — Hook de dados

```typescript
// Tipos
interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

interface CreateApiKeyResponse {
  key: string;          // plaintext (só 1x)
  prefix: string;
  id: string;
  name: string;
  created_at: string;
  expires_at: string | null;
}

// Hook principal
function useApiKeys() {
  // useQuery para listar keys
  // useMutation para criar (retorna CreateApiKeyResponse)
  // useMutation para revogar
  // useMutation para renomear
  // useMutation para deletar
  // refetchAfterCreate, refetchAfterRevoke, etc.
}
```

**TanStack Query config:**
- `queryKey: ['api-keys']`
- `staleTime: 30_000` (30s — keys não mudam frequentemente)
- `gcTime: 5 * 60_000`
- Todas as mutations fazem `queryClient.invalidateQueries(['api-keys'])` no `onSuccess`

**Comunicação com edge function:**
```typescript
const { data, error } = await supabase.functions.invoke('admin-create-api-key', {
  body: { name, expires_at }  // POST
});
// ou
const { data, error } = await supabase.functions.invoke('admin-create-api-key', {
  body: { key_id }            // PATCH (revoke)
});
```

### 3.2 `src/components/settings/ApiKeysSettings.tsx` — Componente principal

Estrutura da UI (shadcn/ui Card + Table):

```
┌─────────────────────────────────────────────────┐
│  API Keys                                       │
│  Gerencie suas chaves de acesso à API pública.  │
│  [Criar API Key]                                │
├─────────────────────────────────────────────────┤
│  Nome          │ Criada      │ Último uso │ Ações │
│  my-integration│ 19/08 20:19 │ há 2h      │ •••   │
│  teste-prod    │ 19/08 18:30 │ nunca      │ •••   │
│  revogada      │ 18/08 15:00 │ —          │ Revogada │
└─────────────────────────────────────────────────┘
```

**Componentes shadcn/ui usados:**
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
- `Button` (variant destructive para revogar)
- `Badge` (verde=ativa, vermelha=revogada, amarela=expirada)
- `DropdownMenu` (ações: renomear, copiar prefixo, revogar, deletar)
- `Table`, `TableBody`, `TableRow`, `TableCell` (ou `DataTable` se existir)
- `AlertDialog` (confirmação de revogação/deleção)
- `toast` do `sonner` (feedback de sucesso/erro)

**Linha temporal de estados da key:**
- **Ativa**: `revoked_at = null` AND (`expires_at = null` OR `expires_at > now()`)
- **Expirada**: `revoked_at = null` AND `expires_at <= now()`
- **Revogada**: `revoked_at IS NOT NULL`
- **Deletada**: linha removida (hard delete)

### 3.3 `src/components/settings/CreateApiKeyDialog.tsx`

Dialog com formulário:
- Campo `name` (obrigatório, máx 100 chars)
- Campo `expires_at` (opcional, date picker, sem data = sem expiração)
- Botão "Criar" (disabled enquanto name estiver vazio)
- Loading state durante a mutation
- On success → fecha este dialog → abre `ApiKeyDisplayDialog` com a key

### 3.4 `src/components/settings/ApiKeyDisplayDialog.tsx`

Modal pós-criação:
- Alerta amarelo: "Guarde esta chave. Ela não poderá ser recuperada."
- Campo readonly com a key completa (selecionável)
- Botão "Copiar" (usa `navigator.clipboard.writeText`)
- Botão "Fechar" (só fecha — key não é mostrada de novo)

### 3.5 `src/components/settings/RevokeApiKeyDialog.tsx`

AlertDialog de confirmação:
- Título: "Revogar API Key?"
- Descrição: "A key '{name}' será revogada permanentemente. Integrações que usam esta key perderão acesso."
- Botão "Cancelar" + "Revogar" (variant destructive)
- Toast de sucesso + refetch

### 3.6 Atualização em `src/pages/Settings.tsx`

Adicionar ao array `allTabs`:

```typescript
{
  value: "api-keys",
  label: "API Keys",
  icon: Key,          // do lucide-react
  permission: "manage_settings" as PermissionKey,
  adminOnly: true,
  component: ApiKeysSettings,
},
```

Posicionar entre "api" (índice 10) e "data" (índice 11).

### 3.7 Atualização em `supabase/functions/admin-create-api-key/index.ts`

Adicionar handlers:

**PATCH para renomear:**
```typescript
// body: { key_id, name }
// UPDATE api_keys SET name = $1 WHERE id = $2 AND user_id = $3 AND revoked_at IS NULL
```

**DELETE para hard delete:**
```typescript
// body: { key_id }
// DELETE FROM api_keys WHERE id = $1 AND user_id = $2
// (só permite deletar keys já revogadas)
```

**Validação:** só permite deletar keys que já foram revogadas (`revoked_at IS NOT NULL`). Keys ativas devem ser revogadas primeiro (segurança — evita deletar acidentalmente uma key em uso).

### 3.8 Atualização em `supabase/config.toml`

Nenhuma alteração necessária — `admin-create-api-key` já tem `verify_jwt = true`.

---

## 4. Fluxo de dados completo

### 4.1 Listagem de keys

```
User → Settings → Tab "API Keys"
  → useApiKeys().keys (useQuery)
    → supabase.functions.invoke('admin-create-api-key') [GET]
      → admin-create-api-key: requireUser(req) → select from api_keys WHERE user_id = userId
        → Return { data: [...] }
```

### 4.2 Criação de key

```
User → "Criar API Key" → CreateApiKeyDialog
  → useApiKeys().createKey.mutate({ name, expires_at })
    → supabase.functions.invoke('admin-create-api-key', { body: { name, expires_at } })
      → admin-create-api-key: requireUser → generateKey → sha256 → insert into api_keys
        → Return { key, prefix, id, name, created_at, expires_at }
  → on success → open ApiKeyDisplayDialog with key
  → queryClient.invalidateQueries(['api-keys'])
```

### 4.3 Revogação de key

```
User → "..." dropdown → "Revogar" → RevokeApiKeyDialog
  → useApiKeys().revokeKey.mutate({ key_id })
    → supabase.functions.invoke('admin-create-api-key', { body: { key_id } })
      → admin-create-api-key: requireUser → UPDATE api_keys SET revoked_at = now()
        → Return { success: true }
  → on success → toast.success → queryClient.invalidateQueries(['api-keys'])
```

### 4.4 Renomeação de key

```
User → "..." dropdown → "Renomear" → inline edit ou dialog
  → useApiKeys().renameKey.mutate({ key_id, name })
    → supabase.functions.invoke('admin-create-api-key', { body: { key_id, name } })
      → admin-create-api-key: requireUser → UPDATE api_keys SET name = $1
        → Return { success: true }
  → on success → queryClient.invalidateQueries(['api-keys'])
```

---

## 5. Segurança

1. **Só admin vê a tab**: `adminOnly: true` + `permission: 'manage_settings'`
2. **JWT obrigatório**: `verify_jwt = true` em `admin-create-api-key` (já implementado)
3. **Keys só vistas 1x**: a key completa não é armazenada — só o hash. O frontend mostra uma vez e nunca mais.
4. **Revogação irreversível**: não há "desrevogar". Hard delete só de keys já revogadas.
5. **Rate limit da public API não afeta a UI**: a UI usa o JWT (endpoint admin), não a API key (endpoint público).
6. **Audit trail mínimo**: `last_used_at` atualizado a cada uso da public API (já implementado no `_shared/public-api.ts`).

---

## 6. Ordem de execução

1. **Backend**: atualizar `admin-create-api-key/index.ts` (adicionar PATCH rename + DELETE)
2. **Backend**: deploy da function atualizada
3. **Frontend**: criar `useApiKeys.ts`
4. **Frontend**: criar `CreateApiKeyDialog.tsx`
5. **Frontend**: criar `ApiKeyDisplayDialog.tsx`
6. **Frontend**: criar `RevokeApiKeyDialog.tsx`
7. **Frontend**: criar `ApiKeysSettings.tsx` (componente principal)
8. **Frontend**: atualizar `Settings.tsx` (adicionar tab)
9. **Teste**: smoke test via UI + curl
10. **Lint/Build**: `npm run lint` + `npm run build`

---

## 7. Riscos e pendências

- 🟢 **Schema**: não precisa de migration nova — `api_keys` já tem todas as colunas.
- 🟢 **Backend**: o `admin-create-api-key` já tem GET/POST/PATCH. Só falta DELETE e PATCH rename.
- 🟡 **UX**: o modal de exibição pós-criação é crítico — se o usuário fechar sem copiar, perde a key. Pode-se considerar "auto-copiar" ao abrir o modal.
- 🟡 **Língua**: a UI deve ser em português (padrão do projeto). Labels, toasts, descriptions em PT-BR.
- 🔴 **Build**: o projeto tem ~600 erros ESLint pré-existentes de `any`. Não aumentar a contagem.
- 🔴 **Sem `any`**: usar tipos do `Database` gerado em `src/integrations/supabase/types.ts`.

---

**Próximo passo:** aprovar este plano e iniciar pela etapa 1 (backend: PATCH rename + DELETE em `admin-create-api-key`).
