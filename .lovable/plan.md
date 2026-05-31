## O que está acontecendo

Olhei a conversa da Tatiely Maciel (`d5c16f60-7aff-4b37-92c2-a66d896245fc`). Dois problemas distintos:

### Problema 1 — Mensagens do chatbot sem badge de origem
As mensagens enviadas pelos fluxos **"Agendamento de exame de vista"** e **"Confirmação de Exame de Vista"** ficaram com `sent_via_instance_id = NULL` e `sent_via_meta_number_id = NULL` no banco. Por isso o inbox não exibe "via Centro de Saúde Visual" no rodapé.

Causa: em `supabase/functions/execute-chatbot-flow/index.ts`, todos os `inbox_messages.insert(...)` do caminho Evolution (envio de texto, mídia, botões, listas, etc.) salvam `sent_via_chatbot_flow_id` mas **não** salvam `sent_via_instance_id`, mesmo quando `resolvedInstanceId` está disponível. O caminho Meta já salva `sent_via_meta_number_id` corretamente.

### Problema 2 — Disparo saiu pelo "Centro de Saúde Visual" e não pelo "Seven" (Meta) que já vinha sendo usado
A conversa já tinha histórico Meta (`Seven · +55 27 99824-6204` — `meta_phone_number_id=1094594580394816`). Os dois fluxos do chatbot estão configurados com `instance_id` apontando para a Evolution `Centro de Saúde Visual` (`854edf33-…`).

Pela regra de precedência atual em `execute-chatbot-flow` (linhas 131-156), **o default do fluxo sobrescreve o canal já registrado na conversa**. Resultado: chatbot dispara por Evolution → lead recebe num WhatsApp e responde "1" lá → respostas Meta (Seven) e dispatch Evolution (CSV) ficam misturados na mesma conversa.

---

## Plano

### 1. Corrigir badge de origem (Problema 1)

Em `supabase/functions/execute-chatbot-flow/index.ts`, adicionar `sent_via_instance_id: resolvedInstanceId` em **todos** os inserts de `inbox_messages` do caminho Evolution. Inserts identificados a corrigir:

- texto Evolution (linha ~439)
- mídia Evolution (linha ~531)
- botões Evolution `sendButtons` (linha ~613)
- mídia dentro de nó de pergunta (linha ~883) — ajustar a regra atual `!instanceName && metaPhoneNumberId` para gravar `sent_via_instance_id` quando `instanceName` estiver presente
- texto pós-validação Evolution (linha ~1453)
- lista Evolution `sendList` (linha ~1558)
- resposta Evolution genérica (linha ~1632)

Critério único: se a mensagem saiu por Evolution e existe `resolvedInstanceId`, gravar nele. Se saiu por Meta, manter `sent_via_meta_number_id` como já está.

### 2. Definir o canal de disparo do chatbot (Problema 2)

Precisa de decisão sua antes de mexer. Hoje a regra é:

```text
1) Override da automação       (manda no card "Acionar Chatbot")
2) Default do fluxo            (chatbot_flows.instance_id)   ← está vencendo
3) instance/meta_phone da conversa
4) Fallback automático
```

Opções:

**A) Manter como está.** Fluxo sempre dispara pelo número configurado nele, mesmo que a conversa já estivesse rodando em outro canal. Só conserto o badge.

**B) Inverter precedência:** quando a conversa **já tem histórico em outro canal** (Meta ou Evolution diferente), priorizar o canal da conversa em vez do default do fluxo. Override manual da automação continua vencendo de tudo.

**C) Híbrido:** se a conversa já tem `meta_phone_number_id`/`instance_id` ativo nos últimos N dias, priorizar o canal da conversa; caso contrário usar o default do fluxo.

### Arquivos afetados

- `supabase/functions/execute-chatbot-flow/index.ts` (correção do badge sempre; ajuste de precedência se B ou C)

### Não vou mexer agora

- O registro existente da Tatiely não será reescrito retroativamente. A correção vale para novos disparos.
- Sem alterações em UI/frontend — o badge já é renderizado a partir de `sent_via_instance_id` / `sent_via_meta_number_id`.

---

**Preciso da sua escolha sobre o item 2 (A, B ou C) antes de implementar. O item 1 eu já corrijo de qualquer forma.**