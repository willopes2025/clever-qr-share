# Funil de Status de Pedidos Condicionais (Gestão Parts)

## Resposta à pergunta: dá para usar webhook?

Sim, mas com uma ressalva importante.

A API Gestão Parts tem dois endpoints de webhook:

- `PUT /erpssplus/webhook/pedido/status` — notifica mudança de **status de pedido de e-commerce**
- `PUT /erpssplus/webhook/pedido` — notifica mudança de **pedido de e-commerce**

Ambos aceitam apenas `{ "url": "..." }` (uma URL por conta) e o ERP chama essa URL via POST. Ou seja: dá para receber notificação push em vez de ficar consultando.

A ressalva: a documentação diz explicitamente "pedidos de e-commerce". Pedidos **condicionais** provavelmente não disparam esse webhook. O acompanhamento detalhado de condicional vem de `GET /erpssplus/v3/pedido/status/processo` (usando a `chaveprocesso` que vem do `/v3/pedido/feed`), que só existe em modo consulta.

Por isso o plano é **híbrido**: registra o webhook (ganho imediato onde ele funciona) e mantém uma verificação periódica leve para os condicionais. Assim que confirmarmos na prática que o webhook dispara para condicional, a verificação periódica pode ser reduzida ou desligada.

## Etapas do funil (espelhando o ERP)

Novo funil "Pedidos Condicionais" com as etapas dos processos internos:

1. Aguardando separação
2. Em separação
3. Separação concluída
4. Aguardando conferência
5. Em conferência
6. Conferência finalizada
7. Em faturamento
8. Faturado
9. Aguardando liberação de entrega
10. Liberado para entrega
11. Enviado ao transportador
12. Entrega concluída

O card do lead se move automaticamente conforme o status retornado pelo ERP, e o valor/dados do pedido ficam no cartão.

## Mensagens automáticas (Evolution API)

Cada etapa dispara uma mensagem de texto para o cliente pela instância Evolution vinculada. Textos propostos (editáveis depois na tela de automações):

- Em separação: "Oi {{nome}}! Seu pedido {{pedido}} já está em separação aqui no estoque. 📦"
- Separação concluída: "{{nome}}, a separação do seu pedido {{pedido}} foi concluída e ele seguiu para conferência."
- Em conferência: "Seu pedido {{pedido}} está passando pela conferência de qualidade agora."
- Em faturamento: "Estamos emitindo a nota fiscal do seu pedido {{pedido}}."
- Faturado: "Pedido {{pedido}} faturado! Nota fiscal emitida — em breve segue para entrega. ✅"
- Liberado para entrega: "Boa notícia, {{nome}}: seu pedido {{pedido}} foi liberado para entrega."
- Enviado ao transportador: "Seu pedido {{pedido}} saiu para entrega com o transportador. 🚚"
- Entrega concluída: "Entrega concluída! Esperamos que esteja tudo certo com o pedido {{pedido}}. Qualquer coisa, é só chamar aqui. 🙌"

Etapas puramente internas (aguardando separação/conferência) não enviam mensagem, para não poluir o cliente.

## Detalhes técnicos

- Migração: cria o funil "Pedidos Condicionais" + as 12 etapas na ordem acima; adiciona colunas de rastreio em `gestao_parts_lead_data` (`chave_processo`, `ultimo_status`, `ultimo_status_em`) e índice por `chave_processo`.
- Nova edge function pública `gestao-parts-webhook` (`verify_jwt = false`, protegida por token no path/query):
  - recebe o POST do ERP, identifica o pedido, localiza/cria contato e deal, resolve o status e move o card.
  - registra o payload bruto em `webhook_logs` para diagnóstico.
- Nova edge function `gestao-parts-webhook-register`: chama `PUT /erpssplus/webhook/pedido/status` e `PUT /erpssplus/webhook/pedido` apontando para a URL acima (botão "Registrar webhook" na tela Gestão Parts, mostrando status atual).
- Reaproveita a lógica de credenciais/`gpCall` já existente em `gestao-parts-api`/`gestao-parts-sync-leads`.
- Verificação periódica (fallback para condicional): cron a cada 15 min chamando uma função que, para os deals abertos nesse funil, consulta `GET /erpssplus/v3/pedido/status/processo` pela `chaveprocesso` e aplica a mesma função de transição usada pelo webhook (código compartilhado em `_shared`).
- Movimentação e mensagem: reutiliza o motor de automações do funil (`on_stage_enter`), então as mensagens ficam editáveis pela interface e respeitam a instância Evolution configurada.
- Anti-duplicidade: só envia mensagem quando o status realmente muda (`ultimo_status` diferente do novo).
- A ingestão de condicionais no funil usa o mesmo agrupamento já existente em `gestao-parts-sync-leads`, filtrando o tipo condicional.
