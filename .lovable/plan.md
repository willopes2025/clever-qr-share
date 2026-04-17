

## Diagnóstico aprofundado

**Evidências do backend (logs auth, últimos 90 min):**
- Apenas **1 login real** em `auth.users.last_sign_in_at` em 2h (`studiogalacha.adm` 12:16). O "Login" aparente nos logs é **token refresh** (`grant_type=refresh_token`) de sessões antigas — não um login novo com senha.
- **Não há nenhum `POST /token?grant_type=password` chegando ao backend** vindo dos usuários afetados. Isso significa que a requisição de login está sendo **abortada/encaminhada errado no cliente**, não rejeitada pelo Supabase.
- Auth, edge functions e DB estão saudáveis.

**Causa raiz mais provável (no código):**

Existe uma **cadeia de logout em loop** disparada pelo `SubscriptionContext`. Quando um usuário entra (mesmo no domínio próprio), o fluxo é:

1. `signIn` ok → `AuthContext` seta sessão.
2. `Login.tsx` redireciona para `/instances`.
3. `SubscriptionContext` chama `check-subscription` edge function.
4. Se a função retorna **qualquer 401 OU qualquer string contendo "auth", "session", "jwt"** (regex em `SubscriptionContext.tsx:87`), tenta refresh; se refresh também falha por motivo qualquer não-rede → **`supabase.auth.signOut()` força logout global**.
5. `ProtectedRoute` detecta `!user` → manda de volta para `/login`.
6. Usuário vê "loop infinito".

Isso explica por que **alguns usuários conseguem (sessão antiga via cookie/refresh) e outros não** (login novo cai no signOut forçado por `check-subscription`).

**Causas adicionais que agravam:**
- `Login.tsx` redireciona com `replace: true` no `useEffect` mesmo durante o handshake — qualquer flicker em `user` causa navegação.
- `ResetPassword.tsx` redireciona pra `/login` se a sessão demora a hidratar (mobile costuma ser >800ms).
- `signIn` faz `setLoading(true)` mas só desliga em caso de erro — o sucesso depende do `onAuthStateChange` rodar antes do redirect.

## Plano de correção

### 1. Parar o `signOut()` automático do `SubscriptionContext`
Trocar a regra atual (qualquer erro com palavra "auth" → logout) por:
- Só fazer logout quando o erro for **especificamente** `status === 401` **E** o refresh real falhar com erro do tipo `invalid_grant`/`refresh_token_not_found`.
- Em qualquer outra falha (erro de rede, 500, edge function offline, RLS), **manter usuário logado** e apenas exibir um aviso silencioso.
- Adicionar `console.warn` detalhado pra investigar futuros casos sem deslogar.

### 2. Tornar `Login.tsx` resiliente ao handshake
- Aguardar tanto `!authLoading` **quanto** `user` antes do `navigate`, e usar `setTimeout(0)` pra evitar redirect durante render.
- Após `signIn` bem-sucedido, fazer fallback explícito: chamar `getSession()` e só então navegar, em vez de depender só do `useEffect`.

### 3. Estender retry no `ResetPassword.tsx`
- Aumentar timeout de 800 ms para ~3 s e tentar 3 vezes antes de declarar link inválido (mobile/Safari demora).

### 4. Endurecer mensagens
- Mostrar mensagem real quando "Failed to fetch" acontecer no login, sugerindo trocar de rede/extensões.

### 5. Validar
- Após deploy, testar login com 2 contas diferentes em `zap.wideic.com` (desktop + mobile).
- Conferir nos logs se aparecem `POST /token grant_type=password status:200` para os e-mails testados.

## Arquivos afetados
- `src/contexts/SubscriptionContext.tsx` — remover signOut automático.
- `src/pages/Login.tsx` — redirecionamento robusto.
- `src/pages/ResetPassword.tsx` — retries mais longos.
- `src/contexts/AuthContext.tsx` — garantir `setLoading(false)` após signIn bem-sucedido (não esperar só o evento).

## Risco
Baixo. Todas as mudanças são conservadoras (param de deslogar onde não devem). Não tocam em RLS, edge functions, schema ou config de auth.

<lov-actions>
<lov-suggestion message="Aprovado. Aplique as correções do plano (parar signOut automático no SubscriptionContext, tornar o Login.tsx resiliente ao handshake e estender retries no ResetPassword) e me avise quando estiver no ar pra eu testar.">Aplicar correções</lov-suggestion>
<lov-suggestion message="Antes de mexer no código, me mostre exatamente quais usuários tentaram logar nos últimos 60 minutos e quais erros apareceram, pra confirmar 100% o diagnóstico.">Aprofundar diagnóstico antes</lov-suggestion>
<lov-suggestion message="Aplique só a correção mais crítica: parar o signOut() automático do SubscriptionContext. Deixe os outros ajustes pra depois.">Só a correção crítica</lov-suggestion>
</lov-actions>

