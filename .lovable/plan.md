

## Sincronizar apenas cobranças dentro do prazo da trilha

### Contexto
A trilha de cobrança cobre do momento da emissão até 5 dias após o vencimento. Cobranças com vencimento há mais de 5 dias não teriam nenhum lembrete futuro para agendar, então sincronizá-las seria desperdício de processamento.

### Mudança proposta

Na Edge Function `sync-existing-billing-reminders`:

1. **Filtrar cobranças por data na API do Asaas** — ao buscar cobranças `PENDING` e `OVERDUE`, adicionar o filtro `dueDate[ge]` com a data de hoje menos 5 dias. Isso garante que só retornem cobranças cujo vencimento está no máximo 5 dias no passado (ainda dentro da trilha).

2. **Validação adicional no loop** — para cada cobrança retornada, calcular quais tipos de lembrete ainda têm `scheduled_for` no futuro e ignorar os que já passaram. Se nenhum lembrete futuro for possível, pular a cobrança.

### Lógica resumida
```text
Data mínima = hoje - 5 dias
Buscar cobranças: status IN (PENDING, OVERDUE) AND dueDate >= data_mínima

Para cada cobrança:
  Calcular 6 datas de lembrete
  Filtrar apenas scheduled_for > agora
  Se nenhum → pular
  Se há futuros → inserir em billing_reminders
```

### Benefícios
- Menos chamadas à API do Asaas (retorna menos cobranças)
- Processamento mais rápido
- Evita criar registros inúteis no banco

### Arquivo envolvido
- `supabase/functions/sync-existing-billing-reminders/index.ts` (novo)
- `src/components/settings/AsaasSettings.tsx` (botão de sincronização)

