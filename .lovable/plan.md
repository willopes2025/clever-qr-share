## Objetivo
Mostrar, no card "WhatsApp / Mensagens" do Dashboard, a quantidade de mensagens **enviadas**, **recebidas** e **entregues** por instância (chip), respeitando o período selecionado (hoje / 7d / 30d / 90d / custom).

Hoje o gráfico "Mensagens por Chip" mostra apenas uma barra com o total de mensagens enviadas. Vamos transformar isso em uma tabela/lista por instância com 3 colunas.

## Mudanças

### 1. `src/hooks/useDashboardMetricsV2.ts` — `useWhatsAppMetrics`
- Alterar `messagesByInstance` para retornar:
  ```ts
  Array<{
    instanceId: string;
    instanceName: string;
    sent: number;       // outbound no período
    received: number;   // inbound no período
    delivered: number;  // outbound com status delivered/read
  }>
  ```
- Buscar `inbox_messages` no período trazendo `conversation_id`, `direction`, `status` (em vez de só outbound).
- Manter o cruzamento com `conversations` (provider, instance_id, meta_phone_number_id) já existente, e agregar os 3 contadores por chip.
- Manter `limit(5000)` por enquanto (mesma limitação já usada). Se necessário, paginar em chunks numa segunda etapa.

### 2. `src/components/dashboard/WhatsAppSection.tsx`
- Substituir o `BarChart` por uma **tabela compacta** com:
  - Coluna: Instância
  - Coluna: Enviadas (ícone Send azul)
  - Coluna: Entregues (ícone CheckCheck verde)
  - Coluna: Recebidas (ícone ArrowDownLeft roxo)
- Linhas ordenadas por total (enviadas + recebidas) desc.
- Manter o cabeçalho com KPIs gerais e badges de chips ativos/inativos.
- Empty state quando não houver dados no período.

## Fora de escopo
- Não mexer no RPC `get_whatsapp_message_stats` (continua agregando os totais gerais do card de cima).
- Não alterar lógica de período / filtros do Dashboard.
- Sem mudanças em backend / edge functions.