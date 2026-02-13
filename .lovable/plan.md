
# Agendamento por Calendario no Formulario

## Resumo
Adicionar um novo tipo de campo "Agendamento" ao sistema de formularios que exibe um calendario interativo no formulario publico. O lead escolhe uma data e um horario disponivel. Ao submeter, o sistema cria automaticamente uma tarefa no calendario (que sincroniza com Google Calendar) e notifica o responsavel.

## Funcionalidades

### 1. Novo tipo de campo: `scheduling`
- Aparece na paleta do builder na categoria "Data e Hora"
- No formulario publico, renderiza um calendario visual + slots de horario
- O lead seleciona uma data e depois um horario disponivel

### 2. Configuracoes do campo (no painel de propriedades)
- **Dias da semana disponiveis**: checkboxes para cada dia (Seg-Dom)
- **Horario por dia**: hora de inicio e fim para cada dia habilitado (ex: Segunda 08:00-18:00)
- **Intervalo entre slots**: duracao de cada slot (15, 30, 45 ou 60 min)
- **Datas bloqueadas**: lista de datas especificas a excluir (feriados, ferias etc.)
- **Antecedencia minima**: quantos dias/horas no minimo antes do agendamento
- **Antecedencia maxima**: ate quantos dias no futuro mostrar disponibilidade

### 3. Verificacao de conflitos em tempo real
- Quando o lead seleciona uma data no calendario, o formulario consulta uma Edge Function (`check-availability`) que:
  - Busca tarefas existentes (conversation_tasks + deal_tasks) naquela data para o dono do formulario
  - Retorna os slots ja ocupados
  - O frontend filtra e mostra apenas slots livres

### 4. Criacao de tarefa ao submeter
- Na Edge Function `submit-form`, quando um campo do tipo `scheduling` e detectado:
  - Cria uma `conversation_task` vinculada ao contato (se existir)
  - Define `due_date` e `due_time` com os valores escolhidos
  - Define `sync_with_google: true` para sincronizar com Google Calendar
  - Titulo da tarefa: label do campo + nome do contato (se disponivel)

### 5. Notificacao
- Utiliza o sistema de notificacoes existente para alertar o responsavel sobre o novo agendamento

---

## Detalhes Tecnicos

### Alteracoes no banco de dados
Nenhuma tabela nova necessaria. As configuracoes de disponibilidade ficam no campo `settings` (JSON) da tabela `form_fields`.

Estrutura do `settings` para campo `scheduling`:
```json
{
  "schedule": {
    "slot_duration": 30,
    "min_advance_hours": 24,
    "max_advance_days": 30,
    "blocked_dates": ["2026-03-01", "2026-03-02"],
    "weekly_hours": {
      "1": { "enabled": true, "start": "08:00", "end": "18:00" },
      "2": { "enabled": true, "start": "08:00", "end": "18:00" },
      "3": { "enabled": true, "start": "08:00", "end": "18:00" },
      "4": { "enabled": true, "start": "08:00", "end": "18:00" },
      "5": { "enabled": true, "start": "08:00", "end": "18:00" },
      "6": { "enabled": false, "start": "", "end": "" },
      "0": { "enabled": false, "start": "", "end": "" }
    }
  }
}
```

### Arquivos a criar/modificar

1. **`src/components/forms/builder/FieldPalette.tsx`** -- Adicionar o tipo `scheduling` na categoria "Data e Hora"

2. **`src/components/forms/builder/FieldProperties.tsx`** -- Adicionar painel de configuracao de disponibilidade (dias, horarios, slots, datas bloqueadas)

3. **`src/components/forms/builder/FieldPreview.tsx`** -- Adicionar preview do campo de agendamento no builder

4. **`supabase/functions/check-availability/index.ts`** (nova) -- Edge Function que recebe `form_id`, `field_id`, `date` e retorna os slots disponiveis, verificando conflitos com tarefas existentes

5. **`supabase/functions/public-form/index.ts`** -- Adicionar geracao de HTML/JS para o campo `scheduling` com calendario interativo e consulta de disponibilidade

6. **`supabase/functions/submit-form/index.ts`** -- Adicionar logica para criar `conversation_task` quando campo `scheduling` e submetido, com `sync_with_google: true`

### Fluxo do formulario publico (campo scheduling)

```text
1. Lead abre formulario
2. Ve um calendario mensal com dias disponiveis destacados
3. Clica em um dia
4. Sistema consulta check-availability (fetch async)
5. Exibe lista de horarios disponiveis para aquele dia
6. Lead seleciona um horario
7. Valor e armazenado como "YYYY-MM-DD HH:mm"
8. Ao submeter, submit-form cria tarefa no calendario
```

### Calendario no formulario publico
Sera renderizado como HTML/CSS/JS puro (inline) na Edge Function `public-form`, sem dependencias externas. Inclui:
- Grade mensal com navegacao (mes anterior/proximo)
- Dias desabilitados (fora da disponibilidade configurada) em cinza
- Ao clicar em um dia, carrega slots via fetch
- Slots exibidos como botoes clicaveis abaixo do calendario

### Edge Function `check-availability`
- Recebe: `form_id`, `field_id`, `date` (YYYY-MM-DD)
- Busca config do campo (settings.schedule)
- Valida se o dia esta habilitado e nao bloqueado
- Gera todos os slots possiveis para o dia
- Busca tarefas existentes (conversation_tasks + deal_tasks) do owner para aquela data
- Remove slots conflitantes
- Retorna lista de horarios livres
