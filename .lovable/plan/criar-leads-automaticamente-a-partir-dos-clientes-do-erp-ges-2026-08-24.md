# Criar leads automaticamente a partir dos clientes do ERP Gestão Parts

Objetivo: todo cliente que fez pedido no Gestão Parts nos últimos 15 dias vira um lead no funil **Teste**, etapa **Novo Lead** — sem duplicar quem já tem lead — e isso passa a rodar sozinho todos os dias.

## Como vai funcionar

1. Uma rotina diária consulta o feed de pedidos do ERP dos últimos 15 dias (todos os tipos: orçamento, condicional, pré-venda, e-commerce).
2. Os pedidos são agrupados por cliente (código do ERP / CPF-CNPJ / telefone), montando uma lista única de clientes com nome, documento, telefone e total comprado no período.
3. Para cada cliente:
   - Localiza o contato existente pelo telefone normalizado (55 + DDD + número) ou pelo documento; se não existir, cria o contato.
   - Se esse contato já tiver qualquer lead ativo no funil Teste, **não cria nada** — apenas atualiza o snapshot do ERP no cartão.
   - Se não tiver, cria o lead na etapa "Novo Lead" com título = nome do cliente, valor = soma dos pedidos do período e a origem marcada como Gestão Parts.
   - Grava/atualiza o snapshot do ERP (pessoa, pedidos, financeiro) na tabela já existente `gestao_parts_lead_data`, ligada ao contato e ao lead.
4. Clientes sem telefone e sem documento válidos são ignorados e contabilizados no relatório da execução.
5. A primeira execução é disparada manualmente logo após a publicação, para já popular os últimos 15 dias.

## Detalhes técnicos

- Nova edge function `gestao-parts-sync-leads`:
  - Roda com service role, resolve as credenciais do ERP da mesma forma que `gestao-parts-api` (integração `gestao_parts`) e itera as integrações ativas.
  - Paginação por `bloco` no endpoint `/erpssplus/v3/pedido/feed` até esgotar `totalblocos` (com teto de segurança de blocos).
  - Normalização de telefone via `_shared/phone.ts` (`normalizePhone`), documento via dígitos.
  - Deduplicação: `contacts` por `phone` normalizado (e por documento nos campos personalizados quando não houver telefone); `funnel_deals` por `contact_id` + `funnel_id` (qualquer status).
  - Processamento em lotes de 25 clientes, com `EdgeRuntime.waitUntil` para não estourar o tempo de resposta.
  - Retorna resumo: clientes encontrados, leads criados, ignorados por duplicidade, ignorados por falta de dados, erros.
- Destino fixo configurado por constante/parâmetro: funil `Teste` (`cabd8131-…`), etapa `Novo Lead` (`a025ae81-…`), `user_id` do dono do funil.
- Agendamento diário via `pg_cron` + `pg_net` chamando a função (uma vez por dia, de madrugada no fuso da organização).
- Sem mudança de schema: reaproveita `contacts`, `funnel_deals` e `gestao_parts_lead_data`.
