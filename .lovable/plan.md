## Diagnóstico

A campanha gera mensagens com placeholders vazios — `{{consultor}}`, `{{valor_da_entrada}}`, `{{data_da_entrada}}`, `{{forma_de_pagamento}}` aparecem literalmente no WhatsApp ou viram texto vazio — porque a Edge Function `start-campaign` (linhas 1320–1345 de `supabase/functions/start-campaign/index.ts`) faz a substituição olhando **apenas** para `contacts.custom_fields`.

Confirmei no banco:
- `consultor`, `valor_da_entrada`, `data_da_entrada`, `forma_de_pagamento` → entity_type = **`lead`** (ficam em `funnel_deals.custom_fields`)
- `primeiro_nome` → entity_type = `contact`, mas é virtual (derivado do `name`), não está em `custom_fields`

Como nada disso é resolvido, o regex final de limpeza (`messageContent.replace(/\{\{[^}]+\}\}/g, '')`) acaba apagando os placeholders, gerando a mensagem incompleta vista no print.

Observação: a função `execute-chatbot-flow` **já** trata `primeiro_nome` e campos de lead corretamente (corrigido em loop anterior). Esta correção é necessária apenas no caminho de campanhas tradicionais (template + variações).

## Mudanças

**Arquivo:** `supabase/functions/start-campaign/index.ts`

No bloco `messageRecords = filteredContacts.map(...)` (linhas ~1320–1345):

1. **Antes do `.map`**, fazer um único batch fetch dos deals dos contatos filtrados:
   ```ts
   const contactIds = filteredContacts.map(c => c.id);
   const { data: deals } = await supabase
     .from('funnel_deals')
     .select('contact_id, custom_fields, value, name, stage:funnel_stages(name), funnel:funnels(name)')
     .in('contact_id', contactIds)
     .order('created_at', { ascending: false });
   const dealByContact = new Map<string, any>();
   for (const d of deals || []) {
     if (!dealByContact.has(d.contact_id)) dealByContact.set(d.contact_id, d);
   }
   ```

2. **Dentro do `.map`**, expandir a substituição:
   - `{{primeiro_nome}}` / `{{first_name}}` → primeira palavra de `contact.name`
   - `{{nome}}` / `{{name}}`, `{{telefone}}` / `{{phone}}`, `{{email}}` (já existem)
   - `{{valor}}` → `deal.value`
   - `{{etapa}}` → `deal.stage?.name`
   - `{{funil}}` → `deal.funnel?.name`
   - Loop em `contact.custom_fields` (campos de contato — já existe)
   - **Novo:** loop em `deal.custom_fields` (campos de lead)
   - Manter o regex final que limpa placeholders restantes

3. Aplicar a mesma lógica também no bloco anterior (linhas ~1083–1108) onde mensagens IA caem no fallback de texto fixo, garantindo consistência.

## Detalhes técnicos

- A consulta de deals é feita uma única vez (em batch via `.in('contact_id', ...)`) para não impactar performance em campanhas grandes (a campanha "Receitas Vencidas" tem 7.878 contatos).
- Para campanhas que já estão `sending` com `campaign_messages` enfileiradas (como a do print), os registros já gravados no banco têm `message_content` corrompido. **Não vou regravá-los automaticamente** para evitar efeito colateral; após o deploy as próximas campanhas (e a campanha "teste" da Ingrid mencionada antes) serão enviadas corretamente. Se quiser regerar uma campanha já em andamento, posso adicionar um botão "Regerar mensagens" no card da campanha em um próximo passo.
- Manter compatibilidade com a substituição existente para não quebrar campanhas em curso.

## Fora de escopo

- UI do CampaignCard (estimativa de conclusão / aviso de daily_limit) — fica para outro loop.
- Mostrar fuso horário no card da campanha — fica para outro loop.

Pronto para aplicar?