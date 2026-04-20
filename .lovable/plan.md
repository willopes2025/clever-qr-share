

## Adicionar condições de "Origem (número)" e "Palavra na mensagem"

Vou adicionar dois novos tipos de condição no formulário de **Automação de funil** (disponíveis para qualquer funil), e ensinar o motor de execução a avaliá-los.

### O que muda na interface (criar/editar automação)

No bloco **"Condições (opcional)"** do `AutomationFormDialog`, dois novos campos no dropdown "Campo":

1. **📱 Origem (número de envio)** — operadores: `igual a`, `diferente de`. O valor é selecionado em uma lista com todos os números conectados:
   - Instâncias Evolution (rótulo: nome + telefone da instância)
   - Números oficiais Meta (rótulo: display name + telefone)
   
2. **💬 Texto da mensagem** — operadores: `contém`, `não contém`, `igual a`, `não está vazio`. Campo de texto livre. Útil em conjunto com gatilhos `Receber mensagem` ou `Palavra-chave recebida`, mas também avaliado se houver `messageContent` no payload.

Ambas opções aparecem **para todos os funis**, sem nenhuma amarração ao funil "Programa Seven".

### O que muda no backend (motor)

Em `supabase/functions/process-funnel-automations/index.ts`, dentro do bloco que avalia `automationConditions` (linhas 219-268), adicionar dois novos casos:

- **`condition.field === 'lead_source_instance'`**  
  Resolve o `instance_id` (ou `meta_phone_number_id`) da conversa atual do `deal.contact_id`/`user_id` e compara com o valor configurado. Suportará:
  - `evo:<instance_id>` para instâncias Evolution
  - `meta:<phone_number_id>` para números Meta
  
- **`condition.field === 'message_text'`**  
  Compara o `messageContent` recebido no payload (já disponível para gatilhos de mensagem). Em outros gatilhos sem mensagem, a condição com operador `contains`/`equals` simplesmente falha (sem texto = sem match), e `not_empty` também.

Mesma lógica replicada em `supabase/functions/process-existing-deals-automation/index.ts` para que o botão **"Executar em todos os leads do funil"** respeite as novas condições (no caso de `lead_source_instance` consulta a conversa do contato; `message_text` é ignorado nesse contexto pois não há mensagem associada à execução em massa).

### Arquivos afetados

- `src/components/funnels/AutomationFormDialog.tsx` — adicionar 2 itens no `<Select>` de campo, e um seletor dinâmico de instâncias/números Meta quando o campo for `lead_source_instance`.
- `supabase/functions/process-funnel-automations/index.ts` — avaliação das novas condições.
- `supabase/functions/process-existing-deals-automation/index.ts` — mesma avaliação (com fallback para `message_text`).

### Comportamento garantido

- Disponível em **qualquer funil** criado no sistema (não há nenhum filtro por nome/ID de funil — o dropdown de condições é compartilhado).
- Funciona com a ação `add_tag` para taguear automaticamente leads cuja origem seja um número específico ou cuja primeira mensagem contenha uma palavra-chave.
- Combinável com outras condições já existentes (lógica "E").

