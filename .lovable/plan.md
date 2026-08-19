# Falha de autenticação Gestão Parts

## Diagnóstico

O erro `{"detail":"Usuário ou senha incorreto"}` vem do próprio ERP, não do WideZap.

Testei a chamada de autenticação diretamente contra `https://api.gestaoparts.com.br/token` com as credenciais gravadas na integração (usuário `rrmartinswidezapws`) e o retorno foi **HTTP 401 – "Usuário ou senha incorreto"**. O formato do envio está correto (OAuth2 password, `grant_type=password`, form-urlencoded), igual ao que a função `gestao-parts-api` usa.

Ou seja: a senha armazenada não é mais válida no ERP (foi trocada, expirou ou o usuário de webservice foi desativado). Nenhuma alteração de código resolve isso — é preciso a credencial correta.

## O que fazer

1. Confirmar com o suporte da Gestão Parts / com o cliente qual é o usuário e a senha atuais do webservice (e se o usuário `rrmartinswidezapws` continua ativo).
2. Atualizar em **Configurações > Integrações > Gestão Parts** (usuário e senha) e clicar em "Testar conexão".

Se preferir, me passe as credenciais novas que eu gravo e valido a conexão.

## Melhorias que farei junto (opcionais)

- **Mensagem de erro mais clara**: hoje aparece o JSON cru do ERP. Passaria a mostrar "Credenciais da Gestão Parts inválidas — atualize usuário e senha em Configurações > Integrações", tanto na página quanto na seção do lead.
- **Registro do erro na integração**: gravar a falha em `integrations.sync_error` e sinalizar na tela de Integrações que a conexão está com problema, em vez de aparecer como conectada.
- **Sem tentativas repetidas**: ao receber 401 no `/token`, não repetir a chamada (hoje só há retry para 401 nas rotas de dados, mas vale limpar o cache de token na falha).

## Detalhes técnicos

- Arquivo: `supabase/functions/gestao-parts-api/index.ts` (função `getToken`, linhas ~145-210) — tratar 401 do `/token` como erro de credencial, com código próprio (`invalid_credentials`) e mensagem em português.
- Frontend: `src/hooks/useGestaoParts.ts` e `src/pages/GestaoParts.tsx` / `src/components/funnels/GestaoPartsDealSection.tsx` — exibir a mensagem amigável e um atalho para Configurações > Integrações.
- Nenhuma mudança de banco necessária.
