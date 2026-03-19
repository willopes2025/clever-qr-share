

## Mensagens Personalizadas por IA no Disparo de Oportunidades

### O que será feito

Adicionar uma opção no dialog de disparo em massa para que a IA gere mensagens personalizadas para cada lead, baseadas nos dados da análise de oportunidades (score, insight, histórico de conversa).

### Fluxo do usuário

1. Seleciona oportunidades e clica "Disparar"
2. No dialog, escolhe entre **Template** (existente) ou **Mensagem IA Personalizada** (novo)
3. Se escolher IA: escreve instruções/prompt (ex: "faça um follow-up mencionando o interesse do cliente")
4. Clica em confirmar → sistema gera mensagens via IA para cada contato → cria campanha → inicia disparo

### Alterações técnicas

#### 1. Nova Edge Function: `supabase/functions/generate-opportunity-messages/index.ts`
- Recebe: `funnel_id`, lista de `deal_ids`, `prompt` do usuário, configurações de campanha (intervalos, horários, etc.), `instance_ids`, `sending_mode`
- Para cada deal: busca dados do contato, oportunidade (score/insight) e últimas mensagens da conversa
- Envia tudo para Gemini 2.5 Flash com tool calling, pedindo uma mensagem personalizada por contato
- Cria broadcast list temporária → insere contatos → cria campanha → insere `campaign_messages` com conteúdo IA gerado → inicia disparo chamando `send-campaign-messages`
- Retorna o `campaign_id` criado

#### 2. `src/components/funnels/OpportunityBroadcastDialog.tsx`
- Adicionar toggle/tabs no topo: "Template" vs "Mensagem IA"
- Quando "Mensagem IA" selecionado:
  - Esconde seleção de template
  - Mostra campo de texto para instruções/prompt do usuário
  - Mostra preview explicativo ("A IA criará uma mensagem única para cada contato baseada no histórico e análise")
- No submit com modo IA: chama `generate-opportunity-messages` ao invés do fluxo atual de criar lista + campanha manualmente

#### 3. `src/components/funnels/FunnelOpportunitiesView.tsx`
- Passar `deal_ids` selecionados e `funnel_id` para o dialog (já passa `selectedContacts` e `funnelName`, adicionar os IDs dos deals)

### Dados que a IA terá para personalizar

- Nome e telefone do contato
- Score e insight da análise de oportunidades
- Etapa atual no funil e valor do deal
- Últimas 20 mensagens da conversa (se houver)
- Prompt/instruções do usuário

### Sem alterações no banco de dados

A edge function cria `campaign_messages` com `message_content` já preenchido pela IA (mesmo campo usado pelo fluxo normal de templates). O `send-campaign-messages` envia normalmente.

