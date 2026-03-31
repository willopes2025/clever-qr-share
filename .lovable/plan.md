
Objetivo: corrigir dois problemas no módulo de oportunidades do funil:
1. a IA não está cobrindo todos os leads com conversa relevante;
2. ao clicar em “Re-analisar”, a lista ainda recicla leads já mostrados em vez de forçar novos.

O que encontrei no código:
- A função `analyze-funnel-opportunities` analisa no máximo 30 deals por vez, escolhidos de forma aleatória entre os deals abertos.
- Ela lê mensagens apenas quando o `funnel_deals.conversation_id` está preenchido. Isso tende a perder leads que têm conversa vinculada ao contato, mas cujo deal não tem `conversation_id`.
- A reanálise recebe `exclude_deal_ids`, mas quando todos os deals elegíveis acabam excluídos, a função faz “reset” e volta a considerar todos, o que reintroduz os mesmos leads.
- Depois da análise, a função apaga do banco as oportunidades que não estão no lote atual, então a lista sempre reflete só o último lote analisado.

Plano de implementação

1. Melhorar a busca de conversa por lead
- Na função `supabase/functions/analyze-funnel-opportunities/index.ts`, parar de depender só de `deal.conversation_id`.
- Para deals sem `conversation_id`, buscar a conversa mais recente do mesmo `contact_id` e usar essa conversa para coletar mensagens.
- Priorizar a conversa do deal quando existir; caso não exista, usar fallback por contato.

2. Aumentar a cobertura de leads realmente conversados
- Separar os deals abertos em grupos:
  - com conversa/mensagens recentes;
  - sem conversa.
- Priorizar primeiro os deals com sinais reais de conversa.
- Só completar com deals sem conversa se faltar volume para o lote.
- Isso aumenta a chance de aparecerem “leads compradores” que já interagiram, em vez de muitos leads frios.

3. Corrigir a lógica de “Re-analisar” para trazer novos leads
- Remover o comportamento de reset automático quando todos os leads do lote anterior forem excluídos.
- Em reanálise, se não houver novos deals elegíveis fora da lista atual, retornar `exhausted: true` sem reciclar os mesmos.
- Manter a exclusão estrita dos `exclude_deal_ids` recebidos do frontend.

4. Melhorar a rotação entre reanálises
- Em vez de aleatoriedade pura sobre todos os deals, aplicar seleção com rotação mais previsível:
  - filtrar deals excluídos;
  - priorizar deals com conversa;
  - embaralhar apenas dentro do conjunto elegível restante;
  - limitar ao lote.
- Resultado esperado: cada reanálise mostra outro conjunto de oportunidades plausíveis, sem repetir em sequência.

5. Ajustar a experiência no frontend
- Em `src/components/funnels/FunnelOpportunitiesView.tsx`, manter o fluxo atual de `excludeDealIds`, mas alinhar mensagens:
  - se não houver novos leads, mostrar aviso claro de que todos os leads elegíveis já foram analisados;
  - se houver novo lote, substituir a lista atual normalmente.
- Não mudar a UI estrutural; apenas garantir comportamento coerente com a expectativa da reanálise.

Arquivos a alterar
- `supabase/functions/analyze-funnel-opportunities/index.ts`
- `src/components/funnels/FunnelOpportunitiesView.tsx`

Resultado esperado
- A análise passa a considerar mais leads que realmente conversaram.
- Leads com conversa deixam de ser perdidos só porque o deal não tem `conversation_id`.
- “Re-analisar” para de trazer os mesmos leads em sequência.
- Quando não houver mais leads novos elegíveis, o sistema informa isso em vez de reciclar a lista.

Detalhes técnicos
```text
Fluxo atual:
deal -> conversation_id -> inbox_messages

Fluxo proposto:
deal
 ├─ se tiver conversation_id -> usa a conversa do deal
 └─ senão -> busca conversa mais recente por contact_id
                -> lê mensagens
                -> monta contexto para IA

Reanálise atual:
exclui IDs atuais
  -> se zera conjunto, reseta tudo
  -> repete leads

Reanálise proposta:
exclui IDs atuais
  -> se zera conjunto, retorna "sem novos leads"
  -> não repete em sequência
```
