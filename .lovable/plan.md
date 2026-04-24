
## Objetivo
Permitir que campanhas disparem fluxos completos de chatbot (em vez de apenas templates de mensagem), respeitando todas as regras de envio já existentes (intervalos, lotes, limites diários, janela horária, instâncias).

## 1. Schema do banco

**Tabela `campaigns`** — adicionar colunas:
- `dispatch_mode` text NOT NULL DEFAULT `'template'` — valores: `'template'` | `'chatbot'`
- `chatbot_flow_id` uuid NULL — FK para `chatbot_flows(id)` ON DELETE SET NULL
- Index em `chatbot_flow_id`

**Tabela `chatbot_executions`** — adicionar coluna:
- `trigger_campaign_id` uuid NULL — FK para `campaigns(id)` ON DELETE SET NULL
- Index em `trigger_campaign_id`

Migration via tool de migração (schema change).

## 2. UI — Formulário de Campanha

**`src/components/campaigns/CampaignFormDialog.tsx`**
- Adicionar seletor "Modo de disparo" com 2 opções:
  - 📄 Template (Meta/Evolution) — comportamento atual
  - 🤖 Chatbot — dispara fluxo
- Quando `dispatch_mode === 'chatbot'`:
  - Esconder seleção de template Meta e mensagem de texto
  - Mostrar dropdown "Fluxo do chatbot" listando `chatbot_flows` ativos da organização
  - Manter seleção de instâncias Evolution (necessárias para o chatbot enviar mensagens)
  - Manter configurações de intervalo, lotes, horários, limites diários
- Validar que `chatbot_flow_id` está preenchido antes de salvar quando modo = chatbot

**`src/components/campaigns/CampaignCard.tsx`**
- Mostrar badge "🤖 Chatbot: [nome do fluxo]" quando aplicável
- Métricas: contar execuções iniciadas / concluídas / em andamento (via `chatbot_executions` filtrado por `trigger_campaign_id`)

## 3. Backend — Edge Function `send-campaign-messages`

Modificar `supabase/functions/send-campaign-messages/index.ts`:
- Ler `dispatch_mode` e `chatbot_flow_id` da campanha
- Se `dispatch_mode === 'chatbot'`:
  - Para cada contato do lote (respeitando intervalos, batch e janela horária já implementados):
    1. Criar registro em `chatbot_executions` com:
       - `flow_id = campaign.chatbot_flow_id`
       - `contact_id`, `phone`, `instance_id` (round-robin ou conforme `sending_mode`)
       - `trigger_campaign_id = campaign.id`
       - `status = 'running'`, `current_node_id = nó inicial`
       - `user_id` da campanha
    2. Invocar `execute-chatbot-flow` com `{ executionId }` para iniciar o fluxo
    3. Marcar `campaign_messages` (ou criar registro equivalente) como `sent` quando a execução iniciar com sucesso, `failed` em caso de erro
- Se `dispatch_mode === 'template'`: comportamento atual inalterado
- Mesma lógica em `process-scheduled-campaigns` continua funcionando (apenas chama `send-campaign-messages`, sem mudança)

## 4. Backend — Edge Function `start-campaign`

`supabase/functions/start-campaign/index.ts`:
- Validar que se `dispatch_mode === 'chatbot'`, então `chatbot_flow_id` existe e o fluxo está ativo e pertence à organização
- Validar que há pelo menos 1 instância Evolution conectada (chatbot precisa enviar mensagens)

## 5. Garantias e detalhes

- **Idempotência**: usar `trigger_campaign_id + contact_id` como chave única lógica para evitar disparar 2x o mesmo fluxo para o mesmo contato.
- **Anti-duplicidade**: se já existe `chatbot_execution` ativa para o contato (`status in ('running','waiting_input')`), pular e registrar como `skipped`.
- **Métricas**: a campanha ainda usa a tabela `campaign_messages` para contar enviados/falhos; um registro = uma execução de fluxo iniciada.
- **Sem combinar template + chatbot** nesta primeira versão (modos mutuamente exclusivos), conforme aprovado.

## Arquivos a editar/criar
- Migration SQL (schema)
- `src/components/campaigns/CampaignFormDialog.tsx`
- `src/components/campaigns/CampaignCard.tsx`
- `supabase/functions/send-campaign-messages/index.ts`
- `supabase/functions/start-campaign/index.ts`
- (possível) novo hook `src/hooks/useChatbotFlows.ts` se ainda não existir para listar fluxos no formulário

## Memória a salvar após implementação
- `mem://features/campaigns/chatbot-dispatch-mode` — descrevendo o novo modo, regras de exclusividade e anti-duplicidade.
