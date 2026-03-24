

# Adicionar Condições nas Automações do Funil

## Resumo
Adicionar um sistema de **condições opcionais** às automações do funil. Isso permite que uma automação só execute se determinadas condições forem atendidas — por exemplo, "Quando um lead entrar no funil, **se** o campo 'loja' for igual a 'Programa Seven', mover para outro funil."

## O que muda para o usuário
- No formulário de automação, aparecerá uma nova seção **"Condições (opcional)"** entre o gatilho e a ação
- O usuário poderá adicionar uma ou mais condições com: **Campo** + **Operador** + **Valor**
- Campos disponíveis: campos personalizados do lead, nome do contato, email, valor do deal
- Operadores: igual a, contém, não está vazio, está vazio, diferente de
- Múltiplas condições funcionam com lógica "E" (todas precisam ser verdadeiras)
- Nova ação disponível: **"Mover para outro funil"** — permite selecionar funil de destino e etapa

## Detalhes Técnicos

### 1. UI — AutomationFormDialog.tsx
- Adicionar estado `conditions` como array de `{ field: string, operator: string, value: string }`
- Renderizar seção de condições com botão "Adicionar condição" (similar ao padrão já usado em `CustomFieldFilterRow`)
- Campos selecionáveis: campos personalizados (do hook existente `useCustomFields`), `contact_name`, `contact_email`, `deal_value`, `deal_title`
- Operadores: `equals`, `not_equals`, `contains`, `not_empty`, `empty`
- Salvar condições no `trigger_config.conditions` do registro da automação
- Adicionar nova ação `move_to_funnel` com seletores de funil destino + etapa destino

### 2. Edge Function — process-funnel-automations/index.ts
- Após filtrar por stage e trigger type, antes de executar a ação, verificar `trigger_config.conditions`
- Para cada condição, avaliar o valor do campo no deal (`custom_fields`, `contact.name`, `contact.email`, `deal.value`, `deal.title`)
- Se qualquer condição falhar, pular a automação com log
- Implementar handler para nova ação `move_to_funnel`: cria novo deal no funil/etapa destino, move contato, e opcionalmente fecha o deal original

### 3. Arquivos a modificar
- `src/components/funnels/AutomationFormDialog.tsx` — UI de condições + nova ação
- `supabase/functions/process-funnel-automations/index.ts` — lógica de avaliação de condições + handler `move_to_funnel`

### 4. Sem mudanças no banco
As condições serão armazenadas no campo JSONB `trigger_config` já existente na tabela `funnel_automations`. A nova ação usa `action_config` para armazenar `target_funnel_id` e `target_stage_id`.

