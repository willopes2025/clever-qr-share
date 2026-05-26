## Diagnóstico

A submissão do formulário **"Exame de Vista CSV"** identificou o lead pelo código `#3828` corretamente (campo `lookup_by_display_id`) e atualizou o contato. Mas o card do lead não recebeu os campos novos (Condição do Exame, Origem do Lead, Consultor, Data Exame) e o lead não foi movido de etapa.

**Causa raiz:** o formulário está configurado **sem** `target_funnel_id` / `target_stage_id`. No edge function `submit-form`, toda a lógica que aplica `dealCustomFields` (campos do tipo `lead_field` / `new_lead_field`) e move a etapa do deal está dentro de um bloco `if (contactId && form.target_funnel_id) { ... }`. Sem funil-alvo, esse bloco é totalmente pulado — os campos de lead coletados são descartados.

Confirmei no banco:
- Form `Exame de Vista CSV`: `target_funnel_id = NULL`, `target_stage_id = NULL`
- Campos de lead mapeados: Condição do Exame, Origem, Consultor, Data Exame Consultório
- 2 submissões recentes do contato `#3828` salvas, mas o deal `06f6efac…` (funil "Programa Seven", etapa "Novo Lead") permaneceu com `custom_fields` vazio (só dados antigos da Ssotica) e na mesma etapa há 11 dias.

## Correção

### 1. `supabase/functions/submit-form/index.ts`

Quando o formulário usa `lookup_by_display_id` e/ou já há `contactId` resolvido, aplicar os `dealCustomFields` aos deals abertos do contato mesmo quando o formulário não tem `target_funnel_id`:

- Se `form.target_funnel_id` estiver definido → manter o comportamento atual (cria/atualiza deal nesse funil, move para `target_stage_id`).
- Se `target_funnel_id` for `NULL` mas houver `dealCustomFields` (ou `dealNativeFields`) **e** o contato foi resolvido via `lookup_by_display_id`:
  - Buscar todos os deals abertos (`closed_at IS NULL`) desse contato.
  - Fazer merge dos `custom_fields` em cada um (preservando valores existentes, sobrescrevendo só as chaves novas).
  - Atualizar `title`/`value` se vieram via `deal_native_field`.
  - Não mexer em `stage_id` (sem destino configurado).
  - Logar `Updated N open deals for contact X with form fields`.

### 2. UI: avisar configuração incompleta

Em `src/components/forms/` (editor do formulário) — quando o usuário tem pelo menos um campo mapeado como `lead_field` / `new_lead_field` e ainda **não** configurou um funil-alvo, mostrar um alerta amarelo no painel de configuração:
> "Você tem campos mapeados para o lead, mas não definiu um funil/etapa de destino. Os campos serão aplicados aos leads existentes (via código do lead), mas o lead não será movido de etapa. Configure um funil-alvo para mover automaticamente."

### 3. Reprocessar a submissão de hoje (opcional, manual)

Após o deploy, aplicar manualmente os `custom_fields` da última submissão (`3ca34c33-…`) ao deal `06f6efac-…` para corrigir o caso atual do lead Brasil Visão Cidadã.

## Detalhes técnicos

- O `lookupDisplayId` já fica registrado durante o loop de campos; basta passar uma flag `lookedUpByDisplayId = !!lookupDisplayId` para o novo bloco de update de deals.
- Manter o trigger `process-funnel-automations` apenas no caminho onde realmente há mudança de etapa (evitar disparos duplicados).
- Não afeta formulários públicos de captação nova (esses continuam dependendo de `target_funnel_id` para criar deal).
