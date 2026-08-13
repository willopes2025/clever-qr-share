# Acesso "Entrar como usuário" (impersonação) sem senha

Objetivo: permitir que o dono do sistema entre na conta de qualquer usuário para dar suporte, sem pedir/alterar a senha dele.

## Como vai funcionar

1. Na tela de Admin (lista de usuários), cada linha ganha a ação **"Entrar como este usuário"**.
2. Ao confirmar, o sistema gera um acesso temporário para aquele usuário e troca a sessão do navegador — sem senha e sem enviar e-mail.
3. Uma **faixa fixa no topo** aparece: "Você está acessando como fulano@email.com — Sair da simulação".
4. Ao clicar em "Sair da simulação", a sessão original do administrador é restaurada e ele volta para /admin.
5. Todo início e fim de simulação fica **registrado em log de auditoria** (quem acessou, qual conta, quando).

## Segurança

- Somente o dono do sistema pode usar (verificação no servidor, não no navegador).
- Bloqueio de impersonar outro dono do sistema.
- A senha do usuário nunca é lida nem alterada.
- Registro de auditoria obrigatório em todas as entradas.

## Detalhes técnicos

- Nova Edge Function `admin-impersonate-user`:
  - valida o JWT do chamador com `auth.getUser()` e confirma `is_system_owner(auth.uid())`;
  - usa service role + `auth.admin.generateLink({ type: 'magiclink', email })` para obter `hashed_token` (não envia e-mail);
  - grava linha em `impersonation_log`;
  - retorna o `token_hash` para o frontend.
- Frontend:
  - guarda a sessão atual (access/refresh token) em `sessionStorage` antes de trocar;
  - chama `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })` para assumir a sessão do alvo;
  - `ImpersonationBanner` global (renderizado no `AppLayout`) lê o `sessionStorage` e oferece "Sair da simulação" via `supabase.auth.setSession(sessão original)`.
- Migração: tabela `impersonation_log` (actor_user_id, target_user_id, started_at, ended_at), com GRANTs e RLS restrita ao dono do sistema; função `is_system_owner` já existe.
- Nenhuma alteração em fluxo de login normal dos usuários.
