

## Plano: IA do WhatsApp criar tarefas no sistema

### O que será feito
A IA que atende clientes no WhatsApp poderá criar tarefas automaticamente dentro do sistema. Por exemplo, quando um cliente pedir para agendar algo ou quando a IA identificar que precisa de follow-up, ela criará uma tarefa atribuída ao responsável da conversa.

### Como funciona
A IA já usa um sistema de "ferramentas" (tool calling) para agendar no Calendly e enviar templates. Vamos adicionar uma nova ferramenta `create_task` que a IA pode chamar durante a conversa.

### Exemplo de uso
- Cliente diz: "Preciso agendar manutenção de unhas para semana que vem"
- IA responde: "Vou passar sua informação para a Aline agendar seu horário! 😊"
- IA automaticamente cria uma tarefa: "Agendar manutenção de unhas - [Nome do cliente]" com a data sugerida

### Alterações

**1. Edge Function `ai-campaign-agent/index.ts`**

- Adicionar a ferramenta `create_task` na lista de tools (sempre disponível, não depende de configuração):
  ```
  {
    name: 'create_task',
    description: 'Cria uma tarefa interna para a equipe de atendimento...',
    parameters: { title, description, due_date, priority }
  }
  ```

- Adicionar o handler no bloco de processamento de tool calls (após `send_template`):
  - Insere na tabela `conversation_tasks` com `user_id` do dono da conversa, `conversation_id`, `contact_id`
  - Retorna confirmação para a IA continuar a resposta

- Adicionar instrução no system prompt para a IA saber quando criar tarefas:
  - Quando cliente pede agendamento e não há Calendly
  - Quando precisa de follow-up humano
  - Quando faz handoff para humano
  - Quando coleta informação que requer ação posterior

### Detalhes técnicos

- Tabela `conversation_tasks` já existe e é usada pelo chatbot builder (`execute-chatbot-flow`)
- Campos: `title` (obrigatório), `description`, `due_date`, `priority` (low/medium/high)
- O `assigned_to` será o `user_id` do dono da conversa (responsável)
- A tarefa aparecerá automaticamente no painel de Tarefas (/tasks) e na sidebar do Inbox
- Nenhuma migration necessária — a tabela e campos já existem

