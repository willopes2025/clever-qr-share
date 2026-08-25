# Correção: impedir disparos durante sincronização do Gestão Parts

## Situação confirmada

- As 8 automações de mensagem do funil **Pedidos Condicionais** estão ativas.
- A carga executada hoje atualizou o status de **144 registros** e acionou o motor de automações ao mover os cards.
- Os logs mostram várias tentativas bloqueadas por limite de execução. A quantidade exata de mensagens efetivamente enviadas ainda precisa ser apurada pelos registros de envio; mensagens já entregues no WhatsApp não podem ser desfeitas.

## Correção imediata

1. Desativar as 8 automações de mensagem desse funil para impedir novos disparos.
2. Alterar webhook, sincronização manual e rotina periódica para trabalharem em **modo silencioso por padrão**: criar/mover cards e salvar status sem chamar o motor de mensagens.
3. Manter mensagens automáticas como uma opção separada, explicitamente ativada pelo usuário somente depois de revisar textos, etapas e remetente.

## Segurança para cargas e reprocessamentos

- Toda carga inicial, retroativa ou reprocessamento será sempre silenciosa.
- Uma mensagem só poderá ser disparada por uma mudança nova recebida depois da ativação, nunca pela simples importação do estado atual.
- Registrar a origem da transição (`webhook`, `sincronização periódica`, `carga manual`) e se ela foi silenciosa, evitando duplicidade.

## Auditoria

- Levantar nos registros quais tentativas do fluxo ocorreram, quantas falharam e quantas tiveram confirmação de envio/entrega.
- Não apagar o histórico do Inbox nem mascarar mensagens que possam ter chegado aos clientes.
- Entregar a lista final dos envios identificados para conferência.

## Validação

- Executar uma sincronização controlada e confirmar que os cards mudam de etapa sem criar mensagem no Inbox nem chamar o provedor de WhatsApp.
- Confirmar que webhook e rotina periódica continuam atualizando os status sem disparos.
