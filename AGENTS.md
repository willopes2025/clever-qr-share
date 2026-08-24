# AGENTS.md — WideZap/WideIC (clever-qr-share)

SaaS de WhatsApp/CRM em produção. Gerado originalmente no Lovable, agora mantido localmente.

## Comandos essenciais

```sh
npm run dev        # Vite dev server (port 5173)
npm run build      # vite build — deve passar antes de commit
npm run lint       # eslint . — erros pré-existentes de `any` (594) não bloqueiam; não piorar
```

## Stack

- Frontend: Vite 5 + React 18 + TypeScript 5.8, Tailwind 3.4, shadcn/ui (Radix), TanStack Query 5, React Router 6
- Backend: ~164 Supabase Edge Functions (Deno, `supabase/functions/`)
- Banco: PostgreSQL via Supabase — 151 tabelas, RLS em 100%, 312 migrations (`supabase/migrations/`)
- Pagamentos: Stripe + Asaas. IA: OpenAI/Lovable, ElevenLabs. WhatsApp: Evolution API + Meta Cloud API

## Estrutura

```
src/pages/          47 rotas (todas lazy-loaded)
src/components/     ~30 pastas por domínio (inbox, campaigns, funnels, ai-agents, email, ...)
src/hooks/          ~130 hooks (dados via TanStack Query + supabase-js direto)
src/contexts/       AuthContext, SubscriptionContext, SidebarContext
src/config/         permissions.ts (~90 permissões)
supabase/functions/ Edge Functions (Deno)
supabase/migrations/ 312 arquivos .sql (YYYYMMDDHHMMSS_<uuid>.sql)
```

## Padrões de auth (crítico)

- Rota protegida = `<ProtectedRoute><PermissionGate permission="...">`
- Edge functions: usar `_shared/auth.ts` (`requireUser`/`createServiceClient`/`isAdmin`)
- **NUNCA** usar `SUPABASE_SERVICE_ROLE_KEY` + `user_id` do body sem validar via JWT (`getUser`)
- **NUNCA** escrever policy "Service role can ..." sem `TO service_role`

## Segurança (verificado na auditoria)

- `.env` está versionado no git (`.gitignore` não o cobre) — não editar sem avisar
- `bootstrap-superadmin/index.ts:8-9` — sem auth e senha hardcoded (`160521`); não expandir
- Webhooks abertos: `receive-webhook`, `asaas-webhook`, `elevenlabs-call-webhook`, `fusionpbx-events-webhook`
- Fallback perigoso: `if (!userId && body?.user_id)` em ai-orchestrate, sync-asaas-contacts, etc. — nunca reproduzir
- `useUserRole.ts:34-36` — usuário sem registro em `team_members` vira admin por default

## Banco de dados

- Multitenancy: `organizations` + `team_members`. Polices usam `auth.uid() = user_id`
- `contacts.phone` tem `UNIQUE (user_id, phone)`
- `funnel_deals.custom_fields` (JSONB) e `contacts.custom_fields` (JSONB) — editáveis via API pública
- **Não existe tabela `leads`** — Lead = `funnel_deals`
- Migrations: nunca editar as já aplicadas; criar nova com `YYYYMMDDHHMMSS_<uuid>.sql`
- 1 tabela fora do versionamento: `scraped_leads` (existe só em produção)

## Convenções

- Código em inglês, UI em PT-BR
- Componentes: PascalCase. Hooks: `use*`. Constantes: `UPPER_SNAKE_CASE`
- Hooks customizados em `src/hooks/`, dados via TanStack Query (`useQuery`/`useMutation`)
- Query keys inline (sem factory central); ~659 ocorrências
- `src/services/` só tem fetchs IBGE (não há camada de services genérica)
- `src/mobile/` é camada responsiva (não é app separado)
- Clientes white-label no core: `ssotica`, `gestao-parts`, `wil-assistant`

## Cuidados

- 51 arquivos > 500 linhas (ChatbotNodeConfig 1994, AutomationFormDialog 1911) — não ampliar, extrair
- `formatCurrency` reimplementado ~35×, `formatPhone` 7× — procurar em `src/lib/` antes de recriar
- 39 arquivos .tsx de componentes não importados em lugar nenhum (código morto)
- `src/data/municipios.ts` tem encoding corrompido (mojibake)
- Zero testes no repo — qualquer mudança é validada por `npm run build` + smoke manual
