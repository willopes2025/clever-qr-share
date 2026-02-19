
# Correcao: Limite de 1000 Linhas no Dashboard

## Problema Identificado

O numero "1,000 Enviadas" esta errado porque o Supabase retorna no maximo **1000 linhas por consulta** por padrao. O numero real de mensagens enviadas nos ultimos 30 dias e **19,577**.

Esse mesmo problema afeta varias consultas no dashboard que buscam dados da tabela `inbox_messages` sem usar contagem server-side.

## Consultas Afetadas

| Arquivo | Consulta | Problema |
|---------|---------|----------|
| `useDashboardMetricsV2.ts` linha 161-166 | WhatsApp `messagesSent` | Conta `.length` em vez de usar `count: 'exact'` |
| `useDashboardMetricsV2.ts` linha 84-89 | Overview `messagesData` para tempo de resposta | Busca ate 1000 mensagens |
| `useDashboardMetricsV2.ts` linha 67-71 | Overview `conversationsData` para auto/humano | Pode atingir limite com muitas conversas |
| `useAdvancedDashboardMetrics.ts` linha 198-202 | Messaging metrics `totalSent/totalReceived` | Conta `.length` em array limitado |
| `useAdvancedDashboardMetrics.ts` linha 244-250 | Response time metrics | Busca mensagens sem limite adequado |

## Solucao

### 1. WhatsApp Metrics - Usar contagem server-side (CRITICO)

Substituir a busca de todas as linhas por 3 queries de contagem separadas:

```typescript
// Enviadas (total outbound)
const { count: messagesSent } = await supabase
  .from('inbox_messages')
  .select('*', { count: 'exact', head: true })
  .eq('direction', 'outbound')
  .gte('created_at', start.toISOString())
  .lte('created_at', end.toISOString());

// Entregues (sent + received status)
const { count: messagesDelivered } = await supabase
  .from('inbox_messages')
  .select('*', { count: 'exact', head: true })
  .eq('direction', 'outbound')
  .in('status', ['sent', 'received'])
  .gte('created_at', start.toISOString())
  .lte('created_at', end.toISOString());

// Falhadas
const { count: messagesFailed } = await supabase
  .from('inbox_messages')
  .select('*', { count: 'exact', head: true })
  .eq('direction', 'outbound')
  .eq('status', 'failed')
  .gte('created_at', start.toISOString())
  .lte('created_at', end.toISOString());
```

Para "Mensagens por Chip", buscar apenas os `conversation_id` distintos com uma abordagem de agrupamento via SQL ou manter a logica atual que e aceitavel para o grafico de barras (quantidade relativa entre chips nao precisa ser exata).

### 2. Overview Metrics - Contagens server-side para auto/humano

Substituir busca de `conversationsData` por queries de contagem:

```typescript
const { count: autoAttendances } = await supabase
  .from('conversations')
  .select('*', { count: 'exact', head: true })
  .eq('ai_handled', true)
  .gte('created_at', start.toISOString());

const { count: humanAttendances } = await supabase
  .from('conversations')
  .select('*', { count: 'exact', head: true })
  .eq('ai_handled', false)
  .gte('created_at', start.toISOString());
```

### 3. Advanced Dashboard Metrics - Contagens server-side

Substituir `useMessagingMetrics` para usar queries de contagem para `totalSent` e `totalReceived`, e manter a busca de dados apenas para o grafico diario (que pode usar amostragem limitada).

### 4. Taxa de Resposta - Ajustar calculo

A taxa de resposta precisa ser recalculada usando contagens server-side em vez de contar arrays limitados a 1000.

### 5. Financial Metrics - Correcao residual

A linha 385 do `useDashboardMetricsV2.ts` ainda usa `is_final` para filtrar deals em negociacao, mas deveria usar `final_type` como foi corrigido no outro trecho (linhas 392-401). Corrigir para consistencia.

## Arquivos a Modificar

1. `src/hooks/useDashboardMetricsV2.ts` - Queries de contagem para WhatsApp e Overview
2. `src/hooks/useAdvancedDashboardMetrics.ts` - Queries de contagem para Messaging metrics
