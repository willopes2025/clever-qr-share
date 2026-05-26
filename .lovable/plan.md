Diagnóstico encontrado:

- O cadastro mais recente do formulário **Exame de Vista CSV** foi salvo às 10:43 BRT e os campos chegaram ao banco corretamente no lead `#3828`:
  - `consultor: William`
  - `origem_do_lead: Brasil Visão Cidadã`
  - `condio_do_exame: [Gratuito]`
  - `data_exame_consult: 2026-05-27T14:45:00`
- O formulário está com **Funil de Destino vazio** (`target_funnel_id = null`). Por isso ele só atualiza o lead existente pelo código, mas **não move o card para a etapa correta**.
- O realtime de `funnel_deals` invalida `funnel-deals`, métricas e contagens, mas **não invalida a query principal `funnels`**, que é a query usada pelo Kanban. Isso explica o card não refletir imediatamente todos os dados enquanto a tela está aberta.
- O card do funil usa uma formatação própria de data em `FunnelDealCard.tsx`, diferente da função corrigida em `date-utils.ts`, então ainda pode exibir data/hora de forma inconsistente no card.

Plano de correção:

1. **Atualizar realtime do funil**
   - Ajustar `src/hooks/useGlobalRealtime.ts` para invalidar também a query `funnels` quando `funnel_deals` mudar.
   - Assim, quando o formulário atualizar o lead, o Kanban recarrega e o card mostra os dados novos sem depender de refresh manual.

2. **Unificar formatação de campos no card**
   - Ajustar `src/components/funnels/FunnelDealCard.tsx` para usar `formatCustomFieldValue`/`parseAnyDateValue` de `src/lib/date-utils.ts`.
   - Garantir que campos `datetime` mostrem **data + hora** no card, não apenas a data.
   - Manter arrays como `Gratuito` ou múltiplos valores separados por vírgula.

3. **Corrigir o destino do formulário CSV no banco**
   - Configurar o formulário **Exame de Vista CSV** para o funil correto **Brasil visão cidadã** e etapa **Lead Agendado**.
   - Isso fará novos envios criarem/moverem o lead automaticamente para a etapa correta.

4. **Corrigir o lead recém-testado**
   - Mover o lead `#3828` para a etapa correta, caso ele ainda esteja no funil/etapa antiga.
   - Preservar os campos já atualizados no card.

5. **Validar**
   - Consultar novamente o formulário, o lead `#3828` e seus campos após a correção.
   - Confirmar que o destino está configurado e que o card terá dados atualizados via realtime.