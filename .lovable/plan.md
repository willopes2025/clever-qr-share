# Manter conta inativa realmente inativa

## O que está acontecendo (confirmado no banco)

- Às 08:15 o admin marcou a assinatura do usuário `matheussuave002@gmail.com` como **inativa** (histórico registrado em `subscription_history`).
- Às 08:26/08:27 o usuário fez login; a verificação de assinatura rodou e **regravou a assinatura como `active` / plano free**.
- Por isso ele entrou normalmente e os formulários voltaram a funcionar: a checagem `is_account_active` estava lendo `active`.

Causa: a verificação de assinatura só respeita a marcação manual quando o status é `active`. Qualquer outro status (inativo, expirado, atrasado) é tratado como "sem assinatura" e sobrescrito por um registro free ativo.

## O que muda para o usuário

- Marcar alguém como inativo passa a valer de verdade: o status não é mais reescrito no próximo login.
- Ao entrar, a conta inativa vê uma tela de conta suspensa em vez do sistema, e os formulários continuam bloqueados.
- Reativando pelo painel, tudo volta imediatamente.

## Detalhes técnicos

1. **`supabase/functions/check-subscription`**
   - Se `manual_override = true`, respeitar o status gravado **qualquer que seja ele** (não só `active`). Para status fora de (`active`, `trialing`), retornar `subscribed: false`, plano bloqueado, sem gravar nada.
   - Nos caminhos de "cliente Stripe não encontrado" e de sincronização Stripe, **não** fazer upsert de `status: "active"` quando o registro existente tiver `manual_override = true` e status não ativo — preserva a decisão do admin.
   - Mesmo tratamento na função interna usada para membros de organização.

2. **`src/contexts/SubscriptionContext.tsx`**
   - Expor um `isActive` derivado do status retornado.

3. **Bloqueio de acesso (`src/components/ProtectedRoute.tsx`)**
   - Quando a conta estiver inativa, exibir tela "Conta suspensa — regularize para continuar" com botão de sair, em vez das rotas internas. Rotas públicas (login, formulários públicos, unsubscribe) não são afetadas.

4. **Reaplicar o status do usuário de teste**
   - Depois do ajuste, marcar novamente `matheussuave002@gmail.com` como inativo, já que o valor foi sobrescrito.

Nenhuma mudança de schema é necessária — `is_account_active` já funciona corretamente assim que o status parar de ser sobrescrito.
