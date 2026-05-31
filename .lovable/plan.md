## Problema

No `submit-form/index.ts`, quando o formulário usa lookup por código do lead (`lookup_by_lead_number`) e o deal encontrado está em um funil **diferente** do `target_funnel_id` configurado no formulário, o código atual:

1. Calcula `targetStageId` apenas se `target_stage_id` estiver setado, ou se `target_funnel_id === lookupDealFunnelId` (mesmo funil).
2. Em seguida valida que o `stage` pertence ao funil atual do deal — se não pertencer, loga `"skipping stage move"` e **não move nada**.

Resultado: lead encontrado pelo código mas que está em outro funil (ex.: fora do "Centro de Saúde Visual") permanece intocado.

## Correção

Permitir mover o deal entre funis quando o formulário tem `target_funnel_id` definido:

1. Se `form.target_funnel_id` estiver definido e for diferente de `lookupDealFunnelId`:
   - Resolver `targetStageId`: usar `form.target_stage_id` (se válido para o `target_funnel_id`); senão buscar o primeiro stage (`display_order`) do `target_funnel_id`.
   - Atualizar `funnel_deals` setando tanto `funnel_id = form.target_funnel_id` quanto `stage_id = targetStageId` e `entered_stage_at = now()`.
   - Disparar `process-funnel-automations` com o novo `funnelId` (target) e `fromStageId = lookupDealStageId` (do funil antigo) — ou sem `fromStageId`, já que é troca de funil, para acionar `on_stage_enter` no novo estágio.

2. Se `form.target_funnel_id` não estiver definido, manter comportamento atual (mover apenas dentro do mesmo funil).

3. Trocar a validação atual ("stage deve pertencer ao funil do deal") para ("stage deve pertencer ao `target_funnel_id` quando há troca de funil", senão ao funil do deal).

4. Manter atualização de `custom_fields`, `value` e `title` do deal como hoje.

## Arquivo afetado

- `supabase/functions/submit-form/index.ts` — bloco "LOOKUP BY LEAD_NUMBER" (linhas ~706–794).

Sem mudanças de schema, sem mudanças no frontend.