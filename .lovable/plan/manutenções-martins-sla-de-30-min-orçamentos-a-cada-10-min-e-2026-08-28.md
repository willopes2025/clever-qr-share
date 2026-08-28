# Manutenções Martins: SLA de 30 min, orçamentos a cada 10 min e listagem completa

## 1. Devolver lead para "Sem dono" após 30 minutos sem resposta

Regra: quando a última mensagem da conversa é do cliente (sem resposta do vendedor) e passam 30 minutos **de horário comercial** (segunda a sexta, 8h–18h, fuso da organização), a conversa perde o responsável e volta a aparecer na aba "Sem dono".

- Fora do horário comercial e nos fins de semana o cronômetro fica parado: o tempo só acumula dentro das janelas 8h–18h de dias úteis.
- Se o vendedor responder, o contador zera (a conversa deixa de ter mensagem pendente).
- Vale apenas para a organização com o módulo Gestão Parts ativo (Martins), como as demais features de carteira/responsável.
- Ao liberar, fica registrado no histórico da conversa que o lead foi devolvido por falta de resposta, para o vendedor entender o motivo.

## 2. Envio automático de orçamentos a cada 10 minutos

- O agendamento passa de 15 para 10 minutos.
- Textos da tela de configuração são atualizados para "a cada 10 minutos".
- A trava de execução única continua valendo, então execuções sobrepostas seguem sendo descartadas.

## 3. Orçamentos que existem no ERP e não aparecem na listagem

Causas identificadas na busca por período:
- A varredura de páginas do feed do ERP para no máximo 10 blocos por consulta, então períodos com muitos orçamentos ficam truncados sem aviso.
- O laço interrompe a busca no primeiro bloco vazio, mesmo quando o ERP ainda tem blocos posteriores com registros.
- Quando o resultado é truncado, a tela não avisa o usuário nem oferece "carregar mais".

Correções:
- Percorrer os blocos até o total informado pelo ERP, com limite maior e proteção de tempo, sem parar em um bloco vazio intermediário.
- Buscar os blocos em paralelo (em lotes) para caber no tempo de execução.
- Deduplicar por empresa + número.
- Ordenar do mais novo para o mais antigo, como já é feito em Pedidos.
- Quando ainda assim faltar página, mostrar aviso "resultado parcial" com botão de carregar mais.

## Detalhes técnicos

**SLA (item 1)**
- Nova edge function `inbox-sla-release`, chamada por `pg_cron` a cada 5 minutos.
- Seleciona conversas com `assigned_to not null`, `status <> 'archived'`, `last_message_direction = 'inbound'` e `last_message_at` antigo o bastante, limitadas às organizações com Gestão Parts ativo.
- Helper de minutos comerciais: soma apenas os intervalos dentro de 8h–18h de seg–sex, usando o fuso resolvido por `_shared/timezone.ts` (`resolveOrgTimezone`), nunca offset fixo.
- Ao atingir 30 minutos comerciais: `update conversations set assigned_to = null` e inserção em `contact_activity_log` (ou `conversation_notes`) registrando a devolução automática.
- Parâmetros (`30` minutos, `8`–`18`) ficam como constantes no arquivo da função.

**Orçamentos 10 min (item 2)**
- Migração: `cron.unschedule('gestao-parts-orcamentos-job')` + `cron.schedule(..., '*/10 * * * *', ...)`.
- Texto em `src/components/gestao-parts/OrcamentoAutoCard.tsx`.
- Ajustar a janela de varredura do job (`gestao-parts-orcamentos-job`) para continuar cobrindo os últimos dias mesmo com execução mais frequente.

**Listagem (item 3)**
- `supabase/functions/gestao-parts-api/index.ts`, ação `list_orcamentos`: paginação completa com `totalblocos`, blocos em paralelo (lotes de ~5), dedupe por `empresa|numpedido`, `truncated: boolean` no retorno.
- `src/components/gestao-parts/OrcamentosTable.tsx`: ordenação por data/hora de emissão desc, aviso de resultado parcial e botão "Carregar mais blocos".
