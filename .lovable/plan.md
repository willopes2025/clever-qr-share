## Objetivo

Permitir definir, por campo de agendamento, **quantas pessoas podem agendar no mesmo horário** (capacidade do slot). Quando o limite for atingido, o horário fica bloqueado automaticamente no formulário público.

## Mudanças

### 1. UI — `src/components/forms/builder/FieldProperties.tsx`
Adicionar novo input em "Configurações de Agendamento", logo abaixo de "Duração do slot":

- **Campo:** "Capacidade por horário (pessoas)"
- Tipo: number, mínimo 1, padrão 1
- Salvo em `settings.schedule.max_per_slot`
- Atualizar a interface `ScheduleConfig` com `max_per_slot?: number`

### 2. Backend — `supabase/functions/check-availability/index.ts`
Hoje a função marca um horário como ocupado se existir **qualquer** task naquele `due_time`. Vamos trocar por **contagem**:

- Ler `schedule.max_per_slot` (default = 1, mantendo comportamento atual)
- Substituir `occupiedTimes: Set<string>` por `slotCounts: Map<string, number>`
- Incrementar contagem ao percorrer `conversation_tasks` e `deal_tasks` no mesmo dia
- Slot fica indisponível quando `slotCounts.get(slot) >= max_per_slot`

### 3. Sem mudanças de schema
`form_fields.settings` já é JSONB livre — não precisa de migration.

## Como funciona depois
- No builder, ao configurar o campo de agendamento, defina por exemplo `Capacidade por horário = 3`
- O formulário público vai mostrar o slot das 10:00 disponível até 3 inscrições; a 4ª pessoa não verá mais esse horário
- Datas/dias bloqueados e antecedência mínima continuam funcionando igual

## Fora do escopo
- Bloquear/desbloquear slots individuais manualmente (apenas datas inteiras já existem)
- Mostrar contagem "2/3 vagas" no formulário público (pode ser adicionado depois se quiser)
