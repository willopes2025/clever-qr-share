# Gestão Parts: pendências do plano original

## O que já está pronto
- Aba Orçamentos com busca por ID / vendedor + período, tabela, modal de detalhes e busca local.
- Envio manual com pré-visualização editável e aprovação antes de disparar.
- Idempotência por (empresa, número) em `gestao_parts_orcamento_envios`.
- Job automático a cada 15 minutos, desligado por padrão, com corte por data de ativação.
- Coluna "Vendedor" na aba Pedidos e no detalhe.
- Aba "Vendedores" (de-para vendedor do ERP ↔ usuário do sistema) com importação do ERP.
- Regra de banco da carteira (`wallet_only` + acesso a conversas já considera o responsável).

## Pendências

### 1. Interruptor "Ver apenas a própria carteira" na tela de Equipe
A regra já existe no banco, mas não há nenhum lugar na interface para ligar/desligar por membro — hoje só dá para mudar direto no banco. Falta o interruptor na tela de Equipe, visível apenas para dono/administrador, com aviso claro de que o usuário passará a ver somente as conversas atribuídas a ele.

### 2. Roteamento automático de novos contatos pelo ERP
Quando chega mensagem de um número desconhecido, nada consulta o ERP hoje. Falta:
- Rotina que consulta o cliente pelo telefone no ERP, lê o vendedor do pedido/orçamento em aberto e atribui a conversa ao usuário vinculado.
- Chamada dessa rotina, em segundo plano, nos recebimentos de mensagem (WhatsApp Evolution e Meta), sem atrasar nem bloquear a entrada da mensagem.
- Sem correspondência: a conversa segue para a fila geral normalmente.

### 3. Ajustes de carteira no Inbox
- Contadores de não lidas e busca precisam ser conferidos com um usuário em modo carteira (a regra de banco cobre, mas falta validação real).
- Ao atribuir uma conversa a outro vendedor, garantir que ela some da lista do anterior sem quebrar a tela aberta.

### 4. Automações do funil "Pedidos Condicionais"
As 8 automações de etapa foram desativadas para evitar disparos indevidos durante a sincronização. Falta decidir e reativar de forma segura (mensagens só para movimentações novas, nunca retroativas).

## Detalhes técnicos
- **Item 1**: `src/components/settings/TeamSettings.tsx` — `Switch` gravando `team_members.wallet_only`; oculto para dono/admin (a função `member_is_wallet_only` já isenta esses papéis).
- **Item 2**: nova edge function `gestao-parts-route-lead` usando `_shared/gestaoPartsErp.ts` (`GET /erpssplus/pessoas/{telefone}` + feed v3 filtrando tipos em aberto), lendo o de-para em `gestao_parts_vendedores` e gravando `conversations.assigned_to`. Invocada com `EdgeRuntime.waitUntil` nos webhooks `evolution-webhook` e `meta-whatsapp-webhook` apenas quando a conversa é criada sem responsável.
- **Item 3**: validação com navegador autenticado; revisão de `get_inbox_unread_count` para respeitar `member_is_wallet_only`.
- **Item 4**: reativar `funnel_automations` do funil condicional mantendo a flag `silent` na sincronização em massa.

## Ordem sugerida
1 → 2 → 3 → 4.
