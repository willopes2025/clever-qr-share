# Carteira de clientes (Martins) — corrigir o que hoje não se aplica

## Diagnóstico atual (verificado)

- 190 conversas da organização Martins: **185 sem dono**, 5 atribuídas.
- A regra da carteira libera toda conversa com dono vazio para qualquer vendedor `wallet_only`. Como quase tudo está sem dono, o isolamento praticamente não acontece.
- Não existe nenhuma rotina que defina o dono automaticamente: só o botão "Assumir" e o envio de orçamento (que está desligado, em modo teste, com 1 envio registrado em 26/08).
- Os 7 vendedores do ERP já estão vinculados a usuários do sistema, mas esse vínculo não é usado para definir o dono da conversa.
- O SLA de 30 minutos comerciais roda a cada 5 minutos e devolve conversas para "Sem dono", reduzindo ainda mais a base com dono.

Conclusão: a carteira está implementada, mas fica inerte porque ninguém vira dono do lead.

## O que será feito (modelo híbrido)

1. **Dono pelo vendedor do ERP (prioridade)**
   Quando o snapshot do Gestão Parts identificar o vendedor do cliente e esse vendedor tiver usuário vinculado, a conversa passa a ser atribuída a ele automaticamente — na criação da conversa e na sincronização de dados do lead. Só atribui se a conversa estiver sem dono (nunca rouba lead de outro vendedor).

2. **Quem responde, assume (fallback)**
   Ao enviar a primeira mensagem de saída em uma conversa sem dono, o remetente vira o responsável automaticamente. Sem clique extra.

3. **Sem dono continua aberto a todos**
   A aba "Sem dono" e a visibilidade de conversas sem responsável permanecem como estão hoje: qualquer vendedor pode ver e assumir.

4. **SLA de 30 minutos comerciais continua ativo**
   Conversa com última mensagem do cliente e sem resposta em 30 minutos comerciais volta para "Sem dono", inclusive quando o dono veio do vendedor do ERP. Registro no histórico do contato mantido.

5. **Orçamentos permanecem desligados**
   Nenhuma alteração no envio automático de orçamentos; segue em modo manual/teste.

## Detalhes técnicos

- `supabase/functions/send-inbox-message`: após confirmar o envio, `update conversations set assigned_to = <usuário remetente> where id = ... and assigned_to is null`. Só para organizações com Gestão Parts ativo, para não mudar comportamento de outros clientes.
- `gestao-parts-sync-leads` e `gestao-parts-api` (`lead_sync`): mapear `codvendedor` do snapshot → `gestao_parts_vendedores.user_id` → atribuir conversa do contato quando `assigned_to is null`.
- Registro em `contact_activity_log` (`auto_assign`) informando a origem da atribuição (ERP ou resposta).
- Sem mudança de schema e sem mudança nas políticas de acesso: a função `can_access_conversation_channel` já trata a carteira corretamente.

## Validação

- Conferir, após o deploy, quantas conversas passaram a ter dono e se um vendedor `wallet_only` deixa de enxergar conversas atribuídas a outro.
- Conferir no histórico do contato os registros de atribuição automática e de devolução por SLA.
