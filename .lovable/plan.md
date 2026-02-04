
# Plano: Agendamento de Mensagens na Aba de Tarefas

## Resumo

Adicionar um novo botão **"Mensagem"** ao lado de "Atribuir" no formulário de criação de tarefas do Inbox. Ao clicar, o usuário pode selecionar um template existente ou escrever uma mensagem manual que será enviada automaticamente no dia e hora marcados na tarefa.

---

## Como Vai Funcionar

1. No formulário de criação de tarefa, haverá um novo botão: **"Mensagem"**
2. Ao clicar, abre um popover com duas opções:
   - **Selecionar Template** - lista os templates existentes
   - **Escrever Manualmente** - campo de texto livre
3. A mensagem fica vinculada à tarefa
4. No dia e hora da tarefa (due_date + due_time), o sistema envia a mensagem automaticamente para o contato da conversa
5. Após o envio, a tarefa pode ser marcada como concluída automaticamente

---

## Visual do Fluxo

```text
+------------------------------------------+
| Título da tarefa                         |
+------------------------------------------+
| Descrição (opcional)                     |
+------------------------------------------+
| [dd/mm/yyyy] 📅    | [--:--] ⏰           |
+------------------------------------------+
| [Normal ▼]                               |
+------------------------------------------+
| [🏷 Tipo] [👤 Atribuir] [💬 Mensagem]    |   ← Novo botão
+------------------------------------------+

Ao clicar em "Mensagem":
+------------------------------------------+
| 💬 Agendar Mensagem                      |
+------------------------------------------+
| ○ Selecionar Template                    |
|   [Selecione um template ▼]              |
|                                          |
| ○ Escrever Manualmente                   |
|   +------------------------------------+ |
|   | Digite sua mensagem...             | |
|   +------------------------------------+ |
+------------------------------------------+
| Será enviada em: 05/02 às 10:00          |
+------------------------------------------+
```

---

## Mudanças Necessárias

### 1. Banco de Dados

Criar nova tabela para mensagens agendadas:

| Tabela | `scheduled_task_messages` |
|--------|---------------------------|
| `id` | uuid (PK) |
| `task_id` | uuid (FK → conversation_tasks) |
| `conversation_id` | uuid (FK → conversations) |
| `contact_id` | uuid (FK → contacts) |
| `user_id` | uuid |
| `template_id` | uuid (nullable, FK → message_templates) |
| `message_content` | text |
| `scheduled_at` | timestamptz |
| `status` | text ('pending', 'sent', 'failed') |
| `sent_at` | timestamptz (nullable) |
| `error_message` | text (nullable) |
| `created_at` | timestamptz |

### 2. Frontend - Novo Componente Seletor de Mensagem

**Arquivo:** `src/components/calendar/MessageSelector.tsx`

Componente com:
- Popover trigger estilo dos outros seletores (Tipo, Atribuir)
- Radio buttons para "Template" ou "Manual"
- Select para templates (usa `useMessageTemplates`)
- Textarea para mensagem manual
- Preview da mensagem quando template selecionado
- Indicador do horário agendado

### 3. Frontend - TasksTab

**Arquivo:** `src/components/inbox/TasksTab.tsx`

- Adicionar estados: `newMessageTemplateId`, `newMessageContent`, `newMessageMode`
- Adicionar o componente `MessageSelector` ao lado de `AssigneeSelector`
- Ao criar tarefa, se houver mensagem, criar registro em `scheduled_task_messages`
- Exibir indicador visual nas tarefas que têm mensagem agendada

### 4. Backend - Edge Function para Processar Mensagens Agendadas

**Arquivo:** `supabase/functions/process-scheduled-task-messages/index.ts`

- Executada via pg_cron a cada minuto
- Busca mensagens com `status = 'pending'` e `scheduled_at <= now()`
- Para cada mensagem:
  - Busca a instância WhatsApp da conversa
  - Substitui variáveis do template (se aplicável)
  - Envia via `send-inbox-message`
  - Atualiza status para 'sent' ou 'failed'
  - Opcionalmente marca a tarefa como concluída

### 5. Hook para Mensagens Agendadas

**Arquivo:** `src/hooks/useScheduledMessages.ts`

- Query para buscar mensagens agendadas de uma tarefa
- Mutation para criar/atualizar/deletar mensagem agendada

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar tabela `scheduled_task_messages` |
| Migração SQL | Criar job pg_cron |
| `src/components/calendar/MessageSelector.tsx` | Novo componente |
| `src/components/inbox/TasksTab.tsx` | Integrar seletor de mensagem |
| `src/hooks/useScheduledMessages.ts` | Novo hook |
| `supabase/functions/process-scheduled-task-messages/index.ts` | Nova edge function |

---

## Comportamento Esperado

1. Usuário cria tarefa com título "Lembrar sobre proposta"
2. Define data: 05/02/2026 às 10:00
3. Clica em "Mensagem" → Seleciona template "Lembrete de Proposta"
4. Clica em "Criar"
5. Sistema cria a tarefa e agendaa mensagem
6. No dia 05/02 às 10:00, o sistema automaticamente:
   - Busca a instância conectada da conversa
   - Substitui {{nome}} pelo nome do contato
   - Envia a mensagem via WhatsApp
   - Marca a tarefa como concluída (opcional)

---

## Indicadores Visuais

Na lista de tarefas, tarefas com mensagem agendada exibirão:
- Ícone de mensagem (💬) junto aos outros badges
- Ao passar o mouse, preview da mensagem
- Status: pendente (amarelo), enviada (verde), falhou (vermelho)

---

## Validações

- Só permite agendar mensagem se a tarefa tiver data E hora definidas
- Não permite agendar para datas/horas passadas
- Requer que a conversa tenha uma instância WhatsApp válida
- Template ou mensagem manual é obrigatório se o botão for ativado

---

## Observação Importante

As variáveis de template (como {{nome}}, {{telefone}}) serão substituídas no momento do envio, garantindo que os dados estejam atualizados.
