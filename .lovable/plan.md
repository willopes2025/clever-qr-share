

## Disparo em lotes com pausa — "Batch Pause"

### O que será feito
Adicionar uma opção nas configurações de envio da campanha para disparar em lotes: enviar X mensagens, pausar por Y minutos, e repetir. Exemplo: enviar 5 mensagens, pausar 30 minutos, enviar mais 5, etc.

### Mudanças

**1. Migração — 3 novas colunas na tabela `campaigns`**
```sql
ALTER TABLE campaigns ADD COLUMN batch_enabled boolean DEFAULT false;
ALTER TABLE campaigns ADD COLUMN batch_size integer DEFAULT 5;
ALTER TABLE campaigns ADD COLUMN batch_pause_minutes integer DEFAULT 30;
```

**2. CampaignFormDialog.tsx — UI para configurar lotes**
- Dentro do Collapsible "Configurações de Envio", adicionar uma seção "Disparo em Lotes" com:
  - Switch para ativar/desativar (`batch_enabled`)
  - Input "Mensagens por lote" (`batch_size`, ex: 5)
  - Input "Pausa entre lotes (minutos)" (`batch_pause_minutes`, ex: 30)
- Texto explicativo: "Envia X mensagens, pausa por Y minutos e repete"
- Passar os 3 novos campos no `onSubmit`

**3. Campaigns.tsx / useCampaigns — Incluir novos campos**
- Adicionar `batch_enabled`, `batch_size`, `batch_pause_minutes` no tipo `Campaign` e nos `onSubmit` de criação/edição

**4. OpportunityBroadcastDialog.tsx — Incluir campos de lote**
- Adicionar os mesmos controles de lote neste dialog que também cria campanhas

**5. send-campaign-messages/index.ts — Lógica de pausa entre lotes**
- Buscar os campos `batch_enabled`, `batch_size`, `batch_pause_minutes` junto com as demais settings
- Após enviar cada mensagem, incrementar `messageIndex`
- Quando `batch_enabled` e `messageIndex > 0` e `messageIndex % batch_size === 0`:
  - Calcular delay = `batch_pause_minutes * 60` segundos
  - Usar o mesmo mecanismo de `scheduleNextMessage` com `isIntervalDelay: true` (chunked delay ou persistent scheduling)
  - Log: "Batch de X mensagens enviado. Pausando por Y minutos..."
- O intervalo normal entre mensagens (message_interval_min/max) continua sendo aplicado dentro de cada lote

### Arquivos a editar
- `supabase/migrations/` — nova migração com 3 colunas
- `src/components/campaigns/CampaignFormDialog.tsx` — UI de configuração
- `src/pages/Campaigns.tsx` — tipo e submit
- `src/components/funnels/OpportunityBroadcastDialog.tsx` — mesma UI
- `supabase/functions/send-campaign-messages/index.ts` — lógica de pausa entre lotes

