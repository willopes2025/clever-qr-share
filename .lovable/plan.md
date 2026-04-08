

## Rastreamento de Métricas por Nó do Chatbot (Funil de Conversão)

### Problema Atual
O sistema atual só rastreia a execução geral do fluxo na tabela `chatbot_executions` (com `current_node_id`), mas não registra quais nós foram processados, quantos leads passaram por cada etapa, nem quantos responderam. Isso impossibilita análise de funil.

### Solução

#### 1. Nova tabela: `chatbot_node_executions`
Registrar cada passagem de nó individualmente durante a execução do fluxo.

```sql
CREATE TABLE public.chatbot_node_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES chatbot_executions(id) ON DELETE CASCADE NOT NULL,
  flow_id UUID REFERENCES chatbot_flows(id) ON DELETE CASCADE NOT NULL,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'processed', -- 'processed', 'waiting_input', 'responded', 'skipped'
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS + índices
```

Campos-chave:
- **status = 'processed'**: o nó foi executado (mensagem enviada, ação realizada)
- **status = 'waiting_input'**: aguardando resposta (pergunta/list_message)
- **status = 'responded'**: o lead respondeu àquele nó

#### 2. Atualizar Edge Function `execute-chatbot-flow`
No loop principal de processamento de nós (`while (currentId ...)`), inserir um registro em `chatbot_node_executions` para cada nó processado. Quando o lead responde (input recebido via webhook), atualizar o registro do nó de `waiting_input` → `responded`.

#### 3. Painel de Analytics no Editor de Fluxo
Adicionar um botão "📊 Métricas" ao header do editor do fluxo que abre um painel lateral/dialog mostrando:

| Etapa (Nó) | Tipo | Alcançados | Responderam | Taxa (%) |
|-------------|------|-----------|-------------|----------|
| Mensagem 1  | message | 500 | — | 100% |
| Pergunta 1  | question | 500 | 120 | 24% |
| Mensagem 2  | message | 120 | — | 24% |
| Pergunta 2  | question | 120 | 45 | 37.5% |

- Percentuais calculados: "alcançados / total que iniciou o fluxo"
- Para nós de pergunta/list_message: mostrar também "responderam / alcançados"
- Filtro de período (últimos 7/30/90 dias)

#### 4. Badges visuais nos nós (opcional mas valioso)
Mostrar um pequeno badge no canto dos nós no canvas com o percentual de passagem, para visualização rápida da performance do funil direto no editor visual.

### Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar tabela `chatbot_node_executions` com RLS |
| `supabase/functions/execute-chatbot-flow/index.ts` | Inserir log por nó processado; atualizar status quando lead responde |
| `src/components/chatbot-builder/ChatbotFlowAnalytics.tsx` | **Novo** — painel de métricas do funil |
| `src/hooks/useChatbotFlowAnalytics.ts` | **Novo** — hook para buscar e agregar dados de analytics |
| `src/components/chatbot-builder/ChatbotFlowEditor.tsx` | Adicionar botão "Métricas" e integrar o painel |
| Nós visuais (MessageNode, QuestionNode, etc.) | Adicionar badge opcional com % de alcance |

