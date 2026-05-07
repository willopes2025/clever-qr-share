## Problema

No inbox da Aline Galacha, buscas por termos comuns (ex.: "curso", "mais informações") mostram **"Nenhuma conversa encontrada"**, mesmo havendo dezenas de conversas com esses termos.

## Causa raiz

O fix anterior (subir o limite de `useConversationSearch` para 2000 mensagens) expôs um segundo bug em `ConversationList.tsx` (query `search-missing-conversations`):

- Termos comuns retornam **centenas de IDs únicos** de conversa (ex.: "mais informações" → 868 IDs no banco).
- Esses IDs são passados em uma única request `supabase.from('conversations').in('id', [800+ UUIDs])`.
- O PostgREST coloca todos os UUIDs na URL, que estoura o tamanho permitido — a request falha ou retorna vazio.
- Resultado: nada aparece na lista.

Confirmei via SQL que existem 18 mensagens da Aline com "mais informações" em conversas ativas que **deveriam** aparecer.

## Correção

### `src/components/inbox/ConversationList.tsx`
Quebrar a query `search-missing-conversations` em **chunks de 150 IDs** (padrão já usado em `useConversations.ts`):

- Loop sobre `missingConversationIds` em fatias de 150, agregando os resultados.
- Mesmo tratamento para o `funnel_deals.in('contact_id', ...)` que vem logo depois.
- Deduplicar `contactIds` antes de buscar deals.

### `src/hooks/useConversationSearch.ts`
Pequeno ajuste defensivo: manter o `limit(2000)` mas garantir que IDs únicos retornados sejam limitados a um teto razoável (ex.: 800) para evitar payloads gigantes mesmo com chunking — preserva relevância (mais recentes primeiro).

## Resultado esperado

Buscar "curso", "mais informações" ou qualquer termo comum no inbox passa a listar todas as conversas correspondentes da organização, ordenadas por mais recente.
