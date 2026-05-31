## Objetivo
Permitir configurar, no Agente de IA, múltiplas janelas de horário com **dias da semana específicos** por janela (Seg–Dom). Exemplo: Seg–Sex 00–08, Seg–Sex 18–24, Sáb 13–24, Dom 00–24.

## Estado atual
- Tabela `ai_agent_configs` já possui `active_hours_windows jsonb` (array de `{start, end}`).
- UI em `AIAgentFormDialog.tsx` já permite múltiplas faixas de hora, **mas sem dia da semana**.
- Backend `supabase/functions/ai-campaign-agent/index.ts` valida via `isWithinAnyActiveWindow` apenas por hora.
- Não há migração necessária — o jsonb absorve o novo campo.

## Mudanças

### 1. Estrutura de dados (sem migração)
Cada janela passa a ser:
```
{ start: number, end: number, days: number[] }   // 0=Dom, 1=Seg, ... 6=Sáb
```
- Janelas antigas sem `days` são tratadas como **todos os dias** (compat).

### 2. UI — `src/components/ai-agents/AIAgentFormDialog.tsx`
Para cada faixa adicionar seletor de dias da semana:
- 7 toggles compactos (D S T Q Q S S) usando `ToggleGroup` (multi).
- Atalhos: botões "Seg–Sex", "Sáb–Dom", "Todos".
- Layout por faixa: linha 1 = dias; linha 2 = horário início/fim + remover.
- Default ao adicionar faixa: `days: [1,2,3,4,5]` (Seg–Sex).
- Preset inicial quando não há janelas: `[{start:8,end:20,days:[1,2,3,4,5,6,0]}]`.
- Validação: pelo menos 1 dia selecionado por faixa (senão desabilita salvar com toast).

### 3. Backend — `supabase/functions/ai-campaign-agent/index.ts`
- `isWithinActiveHours` passa a receber também o dia atual.
- `isWithinAnyActiveWindow` filtra primeiro por `days` (se ausente, aceita qualquer dia), depois aplica a verificação de hora existente (incluindo a lógica overnight).
- Resolver dia/hora atuais no **timezone da organização** via `_shared/timezone.ts` (`nowInTimezone` / `resolveOrgTimezone`) — alinhado à regra de timezone do projeto. Passar `organization_id` ao helper.

### 4. Tipos
- Atualizar interface local `active_hours_windows` em `useAIAgentConfig.ts` e na edge function para `{ start: number; end: number; days?: number[] }[]`.

## Fora de escopo
- Não alterar `active_hours_start/end` legados (mantidos para compat).
- Não mexer em outras superfícies que leem `active_hours_*` (campanhas/funil) — elas continuam usando o fallback por hora; podemos estender depois se você quiser.

Confirma para eu implementar?