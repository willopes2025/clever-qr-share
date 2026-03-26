

## Webhook Genérico Bidirecional para Make (Integromat)

### Situação atual

O sistema já possui:
- **`receive-automation-webhook`** — recebe webhooks e executa ações no funil (mover, tags, notas, etc.)
- **Ação `webhook_request`** nas automações — envia dados para URLs externas
- **`agent-integration-webhook`** — webhook de agentes IA

O que **falta** para integração completa com Make:
1. Um endpoint genérico que aceite **qualquer payload** do Make e execute ações variadas (enviar WhatsApp, criar leads, atualizar contatos) sem depender de automações de funil pré-configuradas
2. Logs centralizados de todas as operações (entrada e saída)
3. Uma interface para gerenciar URLs de webhook do Make e visualizar logs

### Plano

#### 1. Criar tabela `webhook_connections`
Armazenar conexões de webhook configuradas pelo usuário (URLs do Make, tokens, direção).

```sql
CREATE TABLE public.webhook_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'both', -- 'in', 'out', 'both'
  webhook_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  target_url TEXT, -- URL do Make para envio (saída)
  is_active BOOLEAN DEFAULT true,
  last_received_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: usuário só vê seus próprios webhooks
ALTER TABLE public.webhook_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own webhook_connections" ON public.webhook_connections
  FOR ALL TO authenticated USING (user_id = auth.uid());
```

#### 2. Criar tabela `webhook_logs`
Log unificado de todas as operações de webhook (entrada e saída).

```sql
CREATE TABLE public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES public.webhook_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL, -- 'in' ou 'out'
  action TEXT, -- 'send_message', 'create_lead', 'move_deal', etc.
  status TEXT DEFAULT 'success', -- 'success', 'error'
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own webhook_logs" ON public.webhook_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
```

#### 3. Criar Edge Function `make-webhook`
Endpoint genérico que:
- **Recebe** (Make → Sistema): aceita ações como `send_message`, `create_lead`, `move_deal`, `update_contact`, `add_tag`, `create_deal`
- **Responde** com dados do sistema para que o Make capture na resposta
- Loga tudo na tabela `webhook_logs`

Ações suportadas no payload:

```text
POST /functions/v1/make-webhook?token=xxx

{
  "action": "send_message",        // ação a executar
  "phone": "5511999999999",         // identificador do contato
  "message": "Olá {{nome}}!",      // texto da mensagem
  "instance_id": "uuid"            // instância WhatsApp
}

Outras ações:
- "create_lead": cria deal no funil
- "move_deal": move deal para outra etapa
- "update_contact": atualiza campos do contato
- "add_tag" / "remove_tag": gerencia tags
- "get_deal_info": retorna dados de um deal (saída)
- "get_contact_info": retorna dados de um contato (saída)
```

#### 4. Criar página de Webhooks na UI
Nova aba/seção em configurações ou integrações:
- Listar conexões webhook criadas
- Copiar URL do webhook com token
- Ver logs de execução (entrada/saída, status, payload)
- Ativar/desativar conexões
- Documentação inline do payload esperado para cada ação

### Arquivos a criar/editar

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar tabelas `webhook_connections` e `webhook_logs` |
| `supabase/functions/make-webhook/index.ts` | Nova Edge Function genérica |
| `src/hooks/useWebhookConnections.ts` | Hook para CRUD de conexões e logs |
| `src/pages/WebhooksPage.tsx` | Página de gerenciamento |
| `src/components/webhooks/WebhookConnectionCard.tsx` | Card de conexão |
| `src/components/webhooks/WebhookLogsTable.tsx` | Tabela de logs |
| `src/App.tsx` | Adicionar rota `/webhooks` |
| Sidebar/menu | Adicionar link para webhooks |

### Resultado

O Make poderá:
1. **Chamar a URL** do webhook com qualquer ação (enviar mensagem, criar lead, mover deal, etc.)
2. **Receber dados** na resposta (info de contatos, deals)
3. Tudo **logado** com payload, status e erros para debug

