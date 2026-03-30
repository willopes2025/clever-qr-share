

## Plano: Expandir Gatilhos de Automação (Paridade Kommo)

### Análise: Atual vs Kommo

**Já temos:**
- Gatilhos de pipeline: entrar/sair etapa, deal ganho/perdido, entrar no funil
- Gatilhos de conversa: mensagem recebida, palavra-chave, inatividade
- Gatilhos de ação: tag add/remove, formulário, webhook, campo alterado, contato criado, valor alterado

**Faltam (baseado nas imagens do Kommo):**

| Categoria | Gatilho Kommo | Novo trigger_type |
|---|---|---|
| Pipeline | Quando o responsável é alterado | `on_responsible_changed` |
| Programado | X horas antes de um campo de data | `on_scheduled_before_date_field` |
| Programado | Tempo exato (data + hora) | `on_scheduled_exact_time` |
| Programado | Diariamente às (hora fixa) | `on_scheduled_daily` |
| Conversa | Quando conversa é encerrada | `on_conversation_closed` |
| Conversa | X horas após última mensagem recebida | `on_hours_after_last_message` |

### Implementação

#### 1. Migração de banco de dados
Adicionar os 6 novos valores ao enum `funnel_trigger_type`:
```sql
ALTER TYPE funnel_trigger_type ADD VALUE 'on_responsible_changed';
ALTER TYPE funnel_trigger_type ADD VALUE 'on_scheduled_before_date_field';
ALTER TYPE funnel_trigger_type ADD VALUE 'on_scheduled_exact_time';
ALTER TYPE funnel_trigger_type ADD VALUE 'on_scheduled_daily';
ALTER TYPE funnel_trigger_type ADD VALUE 'on_conversation_closed';
ALTER TYPE funnel_trigger_type ADD VALUE 'on_hours_after_last_message';
```

#### 2. Frontend - AutomationFormDialog.tsx
- Adicionar os 6 novos tipos ao `TriggerType`
- Adicionar opções no Select de gatilhos organizadas por categoria (usando separadores visuais)
- Criar configurações específicas para cada novo gatilho:
  - **on_responsible_changed**: sem config extra (dispara quando muda o responsável)
  - **on_scheduled_before_date_field**: selector de campo de data + input de horas antes
  - **on_scheduled_exact_time**: date picker + time picker
  - **on_scheduled_daily**: time picker apenas
  - **on_conversation_closed**: sem config extra
  - **on_hours_after_last_message**: input de horas

#### 3. Frontend - AutomationCard.tsx e AutomationsDialog.tsx
- Adicionar labels, ícones e cores para os novos triggers
- Subtitles contextuais (ex: "3h antes de Vencimento", "Diário às 09:00")

#### 4. Backend - Edge Function `process-funnel-automations`
- Adicionar `on_responsible_changed` ao processamento de eventos (comparar responsável anterior vs novo)
- Adicionar `on_conversation_closed` ao processamento

#### 5. Nova Edge Function `process-scheduled-automations`
Para os 3 gatilhos programados (que precisam de um cron job):
- **on_scheduled_before_date_field**: A cada minuto, buscar automações ativas deste tipo, verificar se o campo de data do deal minus X horas = agora
- **on_scheduled_exact_time**: Verificar se a data/hora configurada = agora
- **on_scheduled_daily**: Verificar se a hora atual = hora configurada, executar para todos os deals do funil/etapa
- Registrar execuções numa tabela `automation_execution_log` para evitar duplicatas
- Configurar cron job (pg_cron) para rodar a cada minuto

#### 6. Tabela `automation_execution_log`
```sql
CREATE TABLE automation_execution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES funnel_automations(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES funnel_deals(id) ON DELETE CASCADE,
  executed_at timestamptz DEFAULT now(),
  trigger_key text, -- para dedup (ex: "daily_2026-03-30")
  UNIQUE(automation_id, deal_id, trigger_key)
);
```

### Arquivos modificados/criados

| Arquivo | Alteração |
|---|---|
| Migração SQL | Enum + tabela execution_log + cron |
| `AutomationFormDialog.tsx` | 6 novos triggers + configs UI |
| `AutomationCard.tsx` | Labels, ícones, subtitles |
| `AutomationsDialog.tsx` | Labels para novos triggers |
| `process-funnel-automations/index.ts` | on_responsible_changed, on_conversation_closed |
| `process-scheduled-automations/index.ts` | **Nova** - cron para triggers programados |

### Organização dos gatilhos no formulário (agrupados)

```text
── GATILHOS DO PIPELINE ──
  🚀 Quando entrar no funil
  📋 Todos que já fazem parte do funil
  ⚡ Quando entrar na etapa
  ↔️ Quando sair da etapa
  ✅ Quando deal for ganho
  ❌ Quando deal for perdido
  👤 Quando responsável for alterado        ← NOVO

── GATILHOS PROGRAMADOS ──
  ⏰ X horas antes de campo de data         ← NOVO
  📅 Em data e hora exata                    ← NOVO
  🔄 Diariamente às                         ← NOVO
  ⏱️ Após X dias na etapa
  😴 Após X dias sem interação

── GATILHOS DE CONVERSA ──
  💬 Quando receber mensagem
  🔑 Quando mensagem conter palavra-chave
  ⏳ X horas após última mensagem           ← NOVO
  🔒 Quando conversa for encerrada          ← NOVO

── GATILHOS DE AÇÃO ──
  🏷️ Quando tag for adicionada
  🏷️ Quando tag for removida
  👥 Quando contato for criado
  💰 Quando valor do deal mudar
  📝 Quando campo personalizado mudar
  📝 Quando formulário for enviado
  🔗 Webhook externo
```

