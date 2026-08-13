# Desativar formulários de contas inativas

Quando a conta de um administrador deixa de estar ativa (inadimplente / marcada como inativa), todos os formulários dele devem parar de funcionar automaticamente — e voltar sozinhos quando a conta for reativada.

## O que muda para o usuário

- Formulário público de uma conta inativa deixa de abrir: exibe "Formulário indisponível no momento" em vez do formulário.
- Envios (submits) são recusados, mesmo que alguém tenha a página aberta ou use o link curto.
- Na tela de Formulários do painel, aparece um aviso de que os formulários estão desativados por conta inativa, e o botão Publicar fica bloqueado.
- Nada é despublicado de verdade: ao reativar a conta, tudo volta ao estado anterior sem precisar republicar.

## Como a "conta inativa" é determinada

A conta é considerada inativa quando qualquer uma destas condições ocorre para o dono do formulário (ou para o administrador dono da organização a que ele pertence):

- assinatura com status diferente de ativo/trial (hoje existem os estados `inactive` e `expired`);
- membro de equipe com status `inactive`.

## Detalhes técnicos

1. **Migração** — criar função `public.is_account_active(_user_id uuid)` (SECURITY DEFINER, STABLE):
   - resolve o dono efetivo: se o usuário pertence a uma organização, usa o `owner_id` da organização; senão o próprio usuário;
   - retorna `false` se `team_members.status = 'inactive'` para o usuário, ou se a assinatura do dono efetivo tiver status fora de (`active`, `trialing`); retorna `true` quando não há registro de assinatura (contas legadas continuam funcionando).

2. **`supabase/functions/public-form`** — depois de buscar o formulário por slug, chamar `is_account_active(form.user_id)`; se falso, responder com a página/JSON de indisponível (mesmo caminho do 404 atual, com mensagem própria).

3. **`supabase/functions/form-preview`** — mesma verificação, para o preview/OG.

4. **`supabase/functions/submit-form`** — após carregar o formulário, se `is_account_active(form.user_id)` for falso, retornar 403 com `{ error: "Formulário indisponível" }`.

5. **Frontend (`src/pages/Forms.tsx` + `src/pages/FormBuilder.tsx`)** — consultar a mesma função via RPC para o usuário logado; quando inativo, exibir banner de aviso e desabilitar o botão Publicar.

Nenhum dado de formulário é alterado — o bloqueio é apenas em tempo de execução, portanto totalmente reversível.
