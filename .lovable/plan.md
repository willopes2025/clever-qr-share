## Diagnóstico

Olhei o fluxo do formulário com campo **Agendamento (scheduling)** e encontrei **dois problemas** que impedem o uso desse campo como gatilho de data/hora nas automações:

### Problema 1 — O campo personalizado é criado como `text`, não como `datetime`

Em `supabase/functions/submit-form/index.ts` (linhas 163–188 e 205–230), quando o formulário tem `mapping_type = 'new_custom_field'` ou `'new_lead_field'` com auto-criação, o `field_type` é **fixo em `'text'`**, independente do tipo real do campo no formulário (scheduling, date, time, datetime).

Consequência: na tela de criar automação (`AutomationFormDialog.tsx` linha 440), o seletor de campo de data filtra somente `field_type === 'date' || 'datetime'`. Como o campo recém-criado está como `text`, **ele não aparece na lista** de gatilhos "antes/depois de data do campo".

### Problema 2 — O valor do agendamento nunca é salvo em `custom_fields`

O bloco em `submit-form/index.ts` (linhas 676–736) que trata `field.field_type === 'scheduling'` **só cria uma `conversation_task`**. O valor "YYYY-MM-DD HH:mm" do agendamento **não é gravado em `contacts.custom_fields` nem em `funnel_deals.custom_fields`**.

Consequência: mesmo se o `field_type` estivesse correto, o processador de automações (`process-scheduled-automations/index.ts` linha 342) não encontraria valor algum em `custom_fields[dateFieldKey]` para esse contato/deal.

## Correções (somente backend — edge function `submit-form`)

### Passo 1 — Inferir o `field_type` correto ao auto-criar
Mapear o tipo do campo do formulário para o `field_type` da `custom_field_definitions`:
- `scheduling` → `datetime`
- `date` → `date`
- `time` → `time`
- `datetime` → `datetime`
- `number` → `number`
- `email` → `email`
- `phone` → `phone`
- `url` → `url`
- default → `text`

Aplicar nas duas branches (`new_custom_field` e `new_lead_field`). Se o campo já existir mas estiver com `field_type='text'` indevidamente, fazer um UPDATE corrigindo (apenas quando o novo tipo for `date`/`datetime`/`time`, para não sobrescrever escolhas manuais legítimas).

### Passo 2 — Persistir o valor do agendamento em `custom_fields`
Quando o campo for `scheduling` E tiver `mapping_target`/`mapping_type` definido (contato ou lead), também gravar o valor em `contacts.custom_fields[key]` ou `funnel_deals.custom_fields[key]`, no formato ISO `YYYY-MM-DDTHH:mm:00` (parseável tanto pelo trigger quanto pela UI). Isso é independente da criação da task (a task continua sendo criada como hoje).

### Passo 3 — Aviso ao usuário
Após o deploy, o campo "Agendamento Consulta CSV" **existente** vai precisar de uma correção manual única:
- abrir Configurações → Campos Personalizados
- localizar o campo e mudar o tipo de "Texto" para "Data e Hora"

(ou eu posso rodar uma migration pontual que converte campos com `field_key` específico — me diga se quer assim.)

## Validação
1. Submeter o formulário com o campo de agendamento preenchido.
2. Verificar em `contacts.custom_fields` / `funnel_deals.custom_fields` que a chave do campo tem o valor ISO.
3. Verificar em `custom_field_definitions` que `field_type = 'datetime'`.
4. Abrir o builder de automação → trigger "Antes de data do campo" → o novo campo deve aparecer na lista.

## Arquivos alterados
- `supabase/functions/submit-form/index.ts` (somente)

Nenhuma mudança em UI, schema ou outras edge functions.
