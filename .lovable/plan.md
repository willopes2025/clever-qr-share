

# Aba "Oportunidades" no Funil de Vendas

## Conceito

Nova aba no módulo de Funis que usa IA (Gemini 2.5 Flash) para analisar as conversas dos deals de um funil específico e ranquear as melhores oportunidades de fechamento. A IA avalia sinais de compra, engajamento e contexto das mensagens para gerar um score e justificativa por deal.

## Dados exibidos por oportunidade

| Campo | Origem |
|-------|--------|
| Nome | `contacts.name` via `funnel_deals.contact_id` |
| Telefone | `contacts.phone` |
| Email | `contacts.email` (se houver) |
| Etapa atual | `funnel_stages.name` via `funnel_deals.stage_id` |
| Valor do deal | `funnel_deals.value` |
| Score de oportunidade | Gerado pela IA (1-100) |
| Motivo/Insight | Texto da IA explicando por que é uma boa oportunidade |

## Arquitetura

### 1. Edge Function `analyze-funnel-opportunities`

- Recebe `funnel_id` como parâmetro
- Busca todos os deals abertos do funil (excluindo etapas won/lost)
- Para cada deal com `conversation_id`, busca as últimas 30 mensagens da conversa
- Envia o contexto (mensagens + dados do deal) para Gemini 2.5 Flash via Lovable AI
- IA retorna um JSON com score (1-100) e justificativa para cada deal
- Retorna a lista ranqueada por score decrescente

### 2. Componente `FunnelOpportunitiesView`

- Tabela com colunas: Score, Nome, Telefone, Email, Etapa, Valor, Insight da IA
- Ordenada por score (maior primeiro)
- Badge colorido no score (verde >70, amarelo 40-70, vermelho <40)
- Botão "Analisar Oportunidades" que dispara a análise
- Estado de loading durante processamento
- Cache do resultado na sessão para não re-analisar a cada troca de aba

### 3. Integração na página Funnels

- Nova aba "Oportunidades" com ícone `Sparkles` no `TabsList` existente
- `viewMode` ganha valor `'opportunities'`
- Renderiza `FunnelOpportunitiesView` quando selecionado

## Arquivos a criar/editar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/analyze-funnel-opportunities/index.ts` | Criar - Edge Function |
| `src/components/funnels/FunnelOpportunitiesView.tsx` | Criar - Componente da aba |
| `src/pages/Funnels.tsx` | Editar - Adicionar aba e viewMode |
| `supabase/config.toml` | Atualizar automaticamente (JWT config) |

## Fluxo

1. Usuário seleciona funil e clica na aba "Oportunidades"
2. Clica em "Analisar Oportunidades"
3. Edge Function busca deals abertos + mensagens das conversas
4. Envia para Gemini 2.5 Flash com prompt estruturado pedindo análise de sinais de compra
5. Retorna lista ranqueada com scores e insights
6. Frontend exibe tabela ordenada por score

## Segurança

- Edge Function valida autenticação do usuário
- Verifica que o usuário pertence à organização dona do funil
- Não expõe dados entre organizações

