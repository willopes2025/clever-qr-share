

## Plano: Disparos automáticos de cobrança via WhatsApp (Asaas)

### Resumo

Criar um sistema automático de lembretes de cobrança que envia mensagens WhatsApp para clientes do Asaas em 5 momentos:
1. **Boleto emitido** — imediatamente ao criar a cobrança
2. **5 dias antes** do vencimento
3. **No dia** do vencimento
4. **1, 3 e 5 dias após** o vencimento (3 mensagens pós-vencimento)

### Como funciona

```text
┌──────────────────────┐
│   Webhook do Asaas    │──── PAYMENT_CREATED ────► Agenda 5 lembretes
│  (já existe)          │                           na tabela billing_reminders
└──────────────────────┘

┌──────────────────────┐
│  Cron Job (1x/hora)  │──── Busca lembretes ────► Envia WhatsApp via
│  process-billing-    │     com due ≤ agora       instância do usuário
│  reminders           │     e status = pending     (Evolution ou Meta)
└──────────────────────┘
```

### Alterações

**1. Nova tabela `billing_reminders`**
- `id`, `user_id`, `contact_id`, `conversation_id`
- `asaas_payment_id`, `asaas_customer_id`
- `reminder_type` (emitted, before_5d, due_day, after_1d, after_3d, after_5d)
- `scheduled_for` (timestamp de quando enviar)
- `status` (pending, sent, cancelled, skipped)
- `message_content` (texto gerado)
- `due_date`, `value`, `billing_type`, `invoice_url`, `bank_slip_url`
- RLS: usuário vê apenas seus lembretes

**2. Atualizar `asaas-webhook/index.ts`**
- No evento `PAYMENT_CREATED`: criar 5 registros em `billing_reminders` com as datas calculadas (hoje, vencimento-5, vencimento, vencimento+1, vencimento+3, vencimento+5)
- Localizar o contato pelo `asaas_customer_id` ou telefone para vincular `contact_id` e `conversation_id`
- No evento `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`: cancelar lembretes pendentes desse pagamento (status → cancelled)
- No evento `PAYMENT_DELETED`: cancelar lembretes pendentes

**3. Nova Edge Function `process-billing-reminders`**
- Busca lembretes com `status = pending` e `scheduled_for ≤ now()`
- Para cada lembrete: monta mensagem personalizada com nome, valor, data e link de pagamento
- Envia via instância WhatsApp do usuário (Evolution API ou Meta, igual ao `send-inbox-message`)
- Atualiza status para `sent`
- Se o contato não tem conversa ativa, cria uma nova

**4. Cron Job (pg_cron)**
- Executar `process-billing-reminders` a cada hora (ou a cada 30 min)

**5. Tela de configuração (opcional/futuro)**
- Permitir que o usuário edite os templates de mensagem para cada tipo de lembrete
- Ativar/desativar tipos específicos de lembrete

### Mensagens padrão

| Momento | Exemplo de mensagem |
|---------|-------------------|
| Boleto emitido | "Olá {nome}! Sua cobrança de R${valor} foi gerada. Vencimento: {data}. Link: {url}" |
| 5 dias antes | "Lembrete: sua cobrança de R${valor} vence em 5 dias ({data}). Link: {url}" |
| No dia | "Hoje é o vencimento da sua cobrança de R${valor}. Evite juros! Link: {url}" |
| 1 dia após | "Sua cobrança de R${valor} venceu ontem. Regularize: {url}" |
| 3 dias após | "Cobrança de R${valor} em atraso há 3 dias. Link para pagamento: {url}" |
| 5 dias após | "Último lembrete: cobrança de R${valor} em atraso. Entre em contato para regularizar: {url}" |

### Detalhes técnicos

- Migration: criar tabela `billing_reminders` com índices em `(status, scheduled_for)` e `asaas_payment_id`
- Webhook cancela automaticamente lembretes quando pagamento é confirmado, evitando cobranças indevidas
- A busca do contato usa `asaas_customer_id` já existente na tabela `contacts`
- O envio usa a mesma lógica de instância do `send-inbox-message` (detecta Evolution vs Meta)
- Cron job via `pg_cron` + `pg_net` chamando a Edge Function

