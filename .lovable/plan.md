
# Fluxos do Chatbot disponíveis no comando "/" do Inbox

## Objetivo
Adicionar os fluxos do chatbot como opções no menu de comandos rápidos ("/") da caixa de mensagem do Inbox. Quando o agente digitar "/", além dos templates existentes, verá também os fluxos ativos do chatbot para dispará-los diretamente na conversa.

## Como vai funcionar

1. O agente digita "/" na caixa de mensagem do Inbox
2. O popup mostra duas seções: **Respostas Rápidas** (templates existentes) e **Fluxos do Chatbot** (novo)
3. Ao selecionar um fluxo, o sistema inicia a execução automática desse fluxo para o contato da conversa atual
4. As mensagens do fluxo (nó "message") são enviadas sequencialmente ao contato via WhatsApp
5. Perguntas (nó "question") aguardam resposta do contato antes de continuar

---

## Detalhes Técnicos

### 1. Atualizar o SlashCommandPopup para suportar fluxos

**Arquivo:** `src/components/inbox/SlashCommandPopup.tsx`

- Adicionar nova prop `flows` (lista de `ChatbotFlow[]`)
- Criar uma seção separada "Fluxos do Chatbot" no popup com ícone diferenciado (Bot/Workflow)
- Filtrar fluxos pelo termo de busca (nome e descrição)
- Adicionar callback `onSelectFlow` para quando um fluxo for selecionado
- Unificar a navegação por teclado (setas/Enter) entre templates e fluxos

### 2. Carregar fluxos ativos no MessageView

**Arquivo:** `src/components/inbox/MessageView.tsx`

- Importar e usar o hook `useChatbotFlows`
- Filtrar apenas fluxos ativos (`is_active === true`)
- Passar os fluxos e callback `onSelectFlow` para o `SlashCommandPopup`
- Implementar `handleFlowSelect` que dispara a execução do fluxo

### 3. Criar Edge Function para executar fluxo no Inbox

**Arquivo:** `supabase/functions/execute-chatbot-flow/index.ts`

Nova edge function que:
- Recebe `flowId`, `conversationId`, `contactId`, `instanceId` e `userId`
- Carrega os nós e arestas do fluxo do banco
- Percorre os nós sequencialmente (seguindo a mesma lógica do `ChatbotTestDialog`)
- Para nós do tipo **message**: envia a mensagem via Evolution API / Meta API e salva no banco de mensagens
- Para nós do tipo **question**: envia a pergunta e marca a conversa como "aguardando resposta do fluxo"
- Para nós do tipo **action**: executa ações (adicionar tag, mover funil, transferir para humano, etc.)
- Para nós do tipo **delay**: agenda continuação com atraso configurado
- Substitui variáveis (nome, telefone) com dados do contato

### 4. Tabela de estado de execução de fluxo

**Migração SQL** para criar a tabela `chatbot_flow_executions`:

- `id` (UUID, PK)
- `flow_id` (referência ao fluxo)
- `conversation_id` (referência à conversa)
- `contact_id` (referência ao contato)
- `user_id` (quem disparou)
- `instance_id` (instância WhatsApp)
- `current_node_id` (nó atual sendo processado)
- `status` (running, waiting_input, completed, paused, error)
- `variables` (JSONB - variáveis coletadas durante execução)
- `created_at`, `updated_at`

Com políticas RLS para que apenas o próprio usuário acesse suas execuções.

### 5. Integrar com receive-webhook para continuar fluxos

**Arquivo:** `supabase/functions/receive-webhook/index.ts`

- Ao receber mensagem inbound, verificar se existe uma execução de fluxo ativa (`status = 'waiting_input'`) para aquela conversa
- Se existir, processar a resposta como input do nó "question" e continuar a execução do fluxo chamando a edge function `execute-chatbot-flow` com o próximo nó

### 6. Indicador visual no Inbox

**Arquivo:** `src/components/inbox/MessageView.tsx`

- Mostrar badge/indicador quando um fluxo está em execução na conversa
- Botão para pausar/cancelar fluxo ativo
- Mensagens enviadas pelo fluxo terão um badge "Bot" ou "Fluxo" para diferenciar de mensagens manuais

---

## Resumo dos arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| `src/components/inbox/SlashCommandPopup.tsx` | Modificar - adicionar seção de fluxos |
| `src/components/inbox/MessageView.tsx` | Modificar - carregar fluxos e handler de seleção |
| `supabase/functions/execute-chatbot-flow/index.ts` | Criar - engine de execução de fluxo |
| `supabase/functions/receive-webhook/index.ts` | Modificar - continuar fluxos aguardando input |
| Migração SQL | Criar tabela `chatbot_flow_executions` + RLS |
