# Plano

Duas correções no Inbox e no motor de Chatbot.

## 1) Datas em formato brasileiro nas variáveis do chatbot

Hoje, em `supabase/functions/execute-chatbot-flow/index.ts`, o helper `formatVarValue` (linha ~345) devolve o valor cru. Quando o custom field é uma data armazenada como `2026-05-27` (campo `vencimento_boleto`, etc), a mensagem sai com `YYYY-MM-DD`.

**Mudança:** detectar strings/valores de data em `formatVarValue` e formatar para `DD/MM/YYYY` (e `DD/MM/YYYY HH:mm` quando vier data + hora), usando o timezone da organização (já temos `_shared/timezone.ts` com `parseInTimezone`).

Regra de detecção:
- `YYYY-MM-DD` → `DD/MM/YYYY`
- ISO completo (`YYYY-MM-DDTHH:mm[:ss][Z|±hh:mm]`) → `DD/MM/YYYY HH:mm` no timezone da org
- Instâncias de `Date` → idem ISO

Aplica em todos os pontos que passam pelo `substituteVars` (mensagens texto, mídia caption, template, condições etc.) — sem mexer na lógica de fluxo.

## 2) Mostrar nome do Chatbot / Template acima da mensagem (em vez de "Enviado pelo WhatsApp")

A tabela `inbox_messages` não guarda hoje a origem (chatbot/template). Vou adicionar rastreamento.

### Banco (migration)

```sql
ALTER TABLE public.inbox_messages
  ADD COLUMN IF NOT EXISTS sent_via_chatbot_flow_id uuid REFERENCES public.chatbot_flows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_via_template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_via_meta_template_id uuid REFERENCES public.meta_whatsapp_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inbox_messages_chatbot_flow ON public.inbox_messages(sent_via_chatbot_flow_id);
```

(Sem mudança de RLS — colunas adicionais na mesma tabela já protegida.)

### Edge functions (preencher origem)

- `supabase/functions/execute-chatbot-flow/index.ts`: em **todos** os `insert` em `inbox_messages` para mensagens **outbound** (linhas 417, 456, 503, 535, 583, 850, 977, 1037, 1415, 1519, 1592), incluir `sent_via_chatbot_flow_id: flow.id` e, quando o nó for template normal, `sent_via_template_id`; quando for `meta_template`, `sent_via_meta_template_id`.
- Demais paths de envio "manual via template/meta_template" (ex.: `send-campaign-messages`, e o envio do Inbox quando o usuário escolhe um template) só receberão `sent_via_template_id` / `sent_via_meta_template_id` se já tiverem essa informação à mão — escopo focado neste plano fica no chatbot, mas vou aproveitar os pontos óbvios em envio por template do Inbox para popular esses campos.

### Frontend

- `src/hooks/useConversations.ts`: incluir os novos campos no select e expor labels via joins leves (`chatbot_flows(name)`, `message_templates(name)`, `meta_whatsapp_templates(name)`).
- `src/components/inbox/MessageBubble.tsx` (linhas 80–130):
  - Nova prioridade de rótulo do cabeçalho outbound:
    1. Agente IA (já existe).
    2. Usuário humano (já existe — mostra `senderName`).
    3. **Chatbot:** ícone `Bot` + “Chatbot: <nome do fluxo>”.
    4. **Template:** ícone `FileText` + “Template: <nome>”.
    5. **Meta Template:** ícone `Send` + “Template Meta: <nome>”.
    6. Fallback atual “Enviado pelo WhatsApp” só quando realmente externo (sem nenhum dos IDs acima e sem `sent_by_user_id`/IA).

## Arquivos tocados

- `supabase/migrations/<ts>_inbox_message_source.sql` (novo)
- `supabase/functions/execute-chatbot-flow/index.ts`
- `src/hooks/useConversations.ts`
- `src/components/inbox/MessageBubble.tsx`

## Fora de escopo

- Não vou alterar o motor de campanhas/AI agent além do necessário para o chatbot; o histórico antigo de `inbox_messages` permanece com `Enviado pelo WhatsApp` (só novas mensagens terão a origem registrada).
