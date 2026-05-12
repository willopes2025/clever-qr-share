# Por que está lento

A função `process-warming` envia **apenas 1 mensagem por schedule por execução**, e o cron `process-warming` está agendado para rodar **a cada 30 minutos** (`*/30 11-23,0 * * *`).

Isso significa, na melhor das hipóteses:
- Janela permitida: 8h–22h (Brasil) = 14h
- 2 execuções/hora × 14h = **~28 mensagens/dia por instância**

Confirmado no banco para o cliente `supervisor@aliancaempresas...`:

| Instância | Dia | Meta diária (progressão) | Enviadas hoje |
|---|---|---|---|
| Supervisor | 9 | 45–80 | 4 |
| Aquecimento Cristiane | 8 | 40–70 | 5 |
| Aquecimento Tatiana | 8 | 40–70 | 5 |
| Aquecimento José Luiz | 2 | 8–15 | 13 |
| Fran Aquecimento | 2 | 8–15 | 10 |

Ou seja: instâncias em estágio inicial (dia 1–2) até conseguem cumprir a meta, mas a partir do dia 3+ o cron não tem cadência suficiente para acompanhar a progressão (que vai até 250 msg/dia no dia 21).

Causa-raiz: **cadência do cron + 1 envio por schedule por execução**, não há nada de errado com a chamada Evolution em si (logs mostram envios bem-sucedidos).

# Mudanças propostas

## 1. Enviar lote por schedule a cada execução (não 1 só)

Em `supabase/functions/process-warming/index.ts`, dentro do loop `for (const schedule of schedules)`, em vez de selecionar um único `target`/`content` e dar `continue`, envolver a parte de seleção + verificação WhatsApp + envio + log + update num **loop interno** que envia até `BATCH_PER_RUN` mensagens (ex.: 3–5) ou até atingir `targetToday`. Entre cada envio do lote, esperar um delay aleatório curto (ex.: 8–25s) para parecer humano.

Pseudo:
```ts
const BATCH_PER_RUN = 4;
let sentInThisRun = 0;
let sentToday = schedule.messages_sent_today;
while (sentInThisRun < BATCH_PER_RUN && sentToday < targetToday) {
  // escolher target + content (lógica atual)
  // checkWhatsAppNumber
  // enviar
  // insert warming_activities
  // sentToday++ se sucesso; sentInThisRun++
  // await sleep(random 8000–25000)
}
// um único update no schedule no final (com sentToday e total)
```

Benefícios:
- Reduz round-trips de update no `warming_schedules`
- Mantém aleatoriedade entre envios
- Respeita o `targetToday` aleatório do dia (nada muda na progressão)

## 2. Aumentar a frequência do cron

Trocar `*/30 11-23,0 * * *` por `*/5 * * * *` (a cada 5 min). A própria função já bloqueia fora de 8h–22h via `isWithinWarmingHours()`, então não há risco de envio noturno.

Capacidade resultante (com batch=4 e cron=5min): até ~672 envios/dia por instância em teoria, mas o `targetToday` continua limitando ao máximo da progressão (~250 no dia 21). Vai apenas distribuir os envios ao longo do dia em vez de bater o teto cedo.

## 3. (Opcional, recomendado) Pequena otimização de queries

Hoje, para cada schedule, o código consulta `warming_pairs`, `warming_contacts`, `warming_pool`, `warming_pool_pairs`, `warming_content` e ainda invoca a função `check-connection-status` para cada par. Como agora chamaremos várias vezes por execução, mover essas consultas para **antes do loop interno** e reaproveitar a lista de `targets`/`contents`. Só `checkWhatsAppNumber` precisa rodar por envio.

# Detalhes técnicos

- Arquivo: `supabase/functions/process-warming/index.ts` (única edição de código).
- Cron: rodar via tool de inserção SQL:
  ```sql
  SELECT cron.unschedule('process-warming');
  SELECT cron.schedule('process-warming', '*/5 * * * *', $$ ... mesmo http_post atual ... $$);
  ```
- Constantes sugeridas no topo do arquivo:
  ```ts
  const BATCH_PER_RUN = 4;
  const MIN_DELAY_MS = 8000;
  const MAX_DELAY_MS = 25000;
  ```
- Não alterar `WARMING_PROGRESSION` nem a janela 8h–22h.
- Não alterar UI nem hooks.

# Validação

1. Após deploy, observar logs `process-warming` por ~10 min e confirmar múltiplos `Sending ${type} to ...` por execução.
2. Query: `SELECT instance_name, current_day, messages_sent_today FROM warming_schedules ws JOIN whatsapp_instances wi ON wi.id=ws.instance_id WHERE ws.user_id = '56244cf5-...';` — esperar `messages_sent_today` evoluir até bater `min` da progressão do dia em poucas horas.
3. Conferir `warming_activities` para garantir distribuição temporal (não rajada).
