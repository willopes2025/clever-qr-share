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
