# Orçamentos Gestão Parts: consulta, envio manual e job automático

## Objetivo
Permitir consultar orçamentos do ERP na tela Gestão Parts (por ID ou por vendedor + período), visualizar detalhes em modal e enviar o orçamento ao cliente por WhatsApp (Evolution API), manualmente ou por um job automático de 15 minutos — desligado por padrão e sem efeito retroativo.

## 1. Nova aba "Orçamentos"
- Filtros: campo "Nº/ID do orçamento" com botão Buscar; seleção de Vendedor (lista extraída dos orçamentos do período) + Data inicial e Data final; opcional empresa.
- Tabela no mesmo padrão de Pedidos: nº, data, cliente, telefone, vendedor, total, situação de envio (Enviado / Não enviado / Falhou) e busca local sobre os resultados (`ResultSearch`).
- Ao clicar na linha, abre o modal/sheet padrão com dados do cliente, itens, valores, condição de pagamento e histórico de envio.
- No modal: botão "Enviar orçamento" (disparo imediato). Se já enviado, mostra data/hora do envio e exige confirmação para reenviar.

## 2. Conteúdo da mensagem
Resumo em texto montado a partir do orçamento: número, data, itens (descrição × quantidade × valor), total, condição de pagamento e validade. Envio pela Evolution API usando a mesma lógica de escolha de instância das automações do funil, para o telefone do cliente normalizado (55 + DDD + número). A mensagem é registrada na conversa do Inbox do contato.

## 3. Job automático (15 minutos)
- Roda a cada 15 minutos via agendamento; consulta o feed de pedidos do ERP filtrando tipo ORCAMENTO no intervalo recente.
- Envia apenas orçamentos criados **após** o instante de ativação da funcionalidade (marco de corte gravado ao ligar a flag). Nada retroativo.
- **Desligado por padrão**: só passa a enviar depois que a chave de ativação for ligada manualmente na tela.
- Lote limitado por execução, trava de execução única, e parada automática em caso de falhas repetidas.

## 4. Idempotência
Controle exclusivamente no nosso banco (o ERP não recebe escrita):
- Tabela `gestao_parts_orcamento_envios` com chave única por (empresa, número do orçamento). Um registro só é criado se ainda não existir; o envio marca `sent_at`, canal, telefone e id da mensagem.
- O envio manual e o job usam o mesmo registro, então um orçamento nunca é enviado duas vezes, mesmo com reprocessamento, reinício do job ou clique duplo. Reenvio só acontece por ação explícita do usuário no modal.

## Detalhes técnicos
- Backend: nova ação `list_orcamentos` em `gestao-parts-api` (feed `/erpssplus/v3/pedido/feed` com `tipopedido: ['ORCAMENTO']`, filtros de data/empresa; busca por ID via `/erpssplus/pedido/requisicao`), filtro de vendedor aplicado sobre o retorno; ação `orcamento_detalhe` reutilizando o detalhe de pedido.
- Nova edge function `gestao-parts-orcamentos-send` (envio manual e em lote) e `gestao-parts-orcamentos-job` (varredura de 15 min), ambas reutilizando `_shared/gestaoPartsErp.ts` e o envio Evolution já usado nas automações.
- Migração: tabela `gestao_parts_orcamento_envios` (unique orçamento, status, tentativas, erro, timestamps) e tabela/linha de configuração com `auto_send_enabled` (default false), `activated_at`, `dry_run`, com GRANTs e RLS por organização.
- Agendamento pg_cron a cada 15 minutos chamando o job; o job sai imediatamente enquanto a flag estiver desligada.
- Frontend: `src/components/gestao-parts/OrcamentosTable.tsx` + filtros, nova aba em `src/pages/GestaoParts.tsx`, hook `useGestaoPartsOrcamentos.ts`, e um card de configuração com o toggle de envio automático.

## Viabilidade dos endpoints
O feed v3 de pedidos já em uso aceita `tipopedido: ['ORCAMENTO']` com intervalo de datas e paginação por bloco, e o detalhe por requisição já está implementado — cobre busca por ID, por período e os dados do modal. O filtro por vendedor será aplicado sobre os campos de vendedor retornados pelo feed; se algum orçamento vier sem vendedor, ele aparece como "Sem vendedor". Não há endpoint de escrita de flag de "enviado" no ERP, por isso a idempotência fica no nosso banco.

---

# Parte 2: Carteira por vendedor, roteamento e coluna de vendedor

## 5. Carteira de clientes (isolamento no Inbox)
- Cada conversa/lead passa a ter um vendedor responsável explícito (campo de atribuição já existente `assigned_to` nas conversas, agora obrigatório para leads do fluxo Gestão Parts).
- Novo modo de visibilidade "Carteira" por membro da equipe: quando ligado para um usuário, ele só vê e interage com conversas atribuídas a ele. Donos e administradores continuam vendo tudo.
- A restrição é aplicada no banco (regra de acesso), não só na tela — então a lista, a busca, os contadores de não lidas e o envio de mensagens respeitam a carteira.
- As mensagens de orçamento (manual ou automática) são gravadas na conversa do cliente já atribuída ao vendedor emissor, ficando visíveis apenas na carteira dele.

## 6. Roteamento automático de novos contatos
- Quando chega mensagem de um número desconhecido, o sistema consulta o ERP por telefone.
- Se o ERP retornar o cliente e ele tiver pedido/orçamento em andamento (tipos ORCAMENTO/PRE-VENDA/CONDICIONAL em situação aberta), lemos o vendedor daquele processo e atribuímos a conversa ao usuário do sistema correspondente.
- Sem correspondência no ERP (ou vendedor sem usuário mapeado): a conversa segue para a fila geral/distribuição atual, sem bloquear a chegada da mensagem.
- Tudo é assíncrono e tolerante a falhas: se o ERP estiver fora do ar, a mensagem entra normalmente e a atribuição é tentada de novo depois.

## 7. Coluna "Vendedor" na aba Pedidos
- Adicionar a coluna Vendedor na tabela de pedidos e o campo correspondente no detalhe (pop-up), lendo os campos de vendedor retornados pelo ERP, com "—" quando ausente.

## Detalhes técnicos (parte 2)
- Banco: coluna `wallet_only boolean default false` em `team_members` (modo carteira por usuário); tabela `gestao_parts_vendedores` mapeando `codvendedor`/nome do ERP para `user_id` do sistema; índice em `conversations.assigned_to`.
- Acesso: estender `can_access_conversation_channel` (ou nova função security definer usada nas policies de `conversations` e `inbox_messages`) para, quando `wallet_only` estiver ativo, exigir `assigned_to = auth.uid()`. Owners/admins isentos.
- Roteamento: no handler de webhook de mensagens recebidas (Evolution e Meta), ao criar contato/conversa nova, chamar em background uma rotina `gestao-parts-route-lead` que faz a consulta reversa no ERP e grava `assigned_to`.
- Consulta reversa no ERP: já viável — `GET /erpssplus/pessoas/{telefone}` (com o telefone no formato do ERP, helper `toErpPhone`) devolve a pessoa e o código interno; a partir do código consultamos o feed de pedidos v3 filtrando os tipos em aberto para ler o campo de vendedor (`vendedor`/`desvendedor`, já presente nos registros do ERP).
- Frontend: coluna e campo de vendedor em `PedidosTable.tsx`; tela de equipe ganha o interruptor "Ver apenas a própria carteira"; tela de configuração do Gestão Parts ganha o mapeamento vendedor ERP → usuário.

## Viabilidade confirmada
A consulta reversa por telefone existe e já é usada hoje no card do lead. O que o ERP não fornece pronto é o vínculo "vendedor do ERP = usuário do WideZap": esse de-para será cadastrado uma vez na tela de configuração. O vendedor do processo vem do próprio registro de pedido/orçamento retornado pelo feed.
