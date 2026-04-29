# Correções: Botão Voltar do Chat (mobile) + Dashboard sem dados

## Problema 1 — Botão "voltar" do chat fica embaixo da Dynamic Island

### Diagnóstico
No `MessageView.tsx`, quando aberto no mobile, o header interno do chat (com o botão `ArrowLeft` em `linha 943-952`) tem altura `h-14` mas **não respeita a safe-area do iPhone**. Em aparelhos com Dynamic Island/notch (iPhone 14 Pro+, 15, 16, 17, 18…), o botão fica parcialmente coberto pela ilha do sistema, e os toques caem na barra de status do iOS em vez do botão. Por isso "precisa apertar várias vezes".

Além disso o `-ml-1` empurra o botão para fora da área confortável de toque na borda esquerda.

### Correção
1. Adicionar `safe-area-top` (classe já existente em `index.css`) ao header do `MessageView` quando estiver em mobile, para que ele desça abaixo da Dynamic Island.
2. Remover o `-ml-1` do botão e garantir alvo de toque ≥ 44×44 px (já está 44, mas ampliar a zona de hit com `p-2` e remover offsets negativos).
3. Garantir `position: relative` + `z-10` no header para ficar acima de qualquer overlay de animação.

## Problema 2 — Dashboard sem nenhuma informação

### Diagnóstico
O hook `useDashboardMetrics` (em `src/hooks/useDashboardMetrics.ts`) filtra **todas** as queries por `eq('user_id', user.id)`. Isso significa que:
- Se o usuário logado é **membro** de uma organização (não o dono que criou os registros), ele não vê nada.
- Mesmo o dono não vê dados criados pela equipe.

Isso viola a regra de memória do projeto: **acesso colaborativo organizacional via `get_organization_member_ids`**.

### Correção
Refatorar `useDashboardMetrics`, `useRecentCampaigns`, `useScheduledCampaigns` e `useCampaignChartData` para buscar primeiro a lista de IDs da organização (RPC `get_organization_member_ids` ou função equivalente já usada no projeto) e usar `.in('user_id', memberIds)` em vez de `.eq('user_id', user.id)`.

Padrão a seguir (já usado em outros hooks como `useConversations`, inbox, etc.):

```ts
const { data: memberIds } = await supabase.rpc('get_organization_member_ids', { _user_id: user.id });
const ids = memberIds?.length ? memberIds : [user.id];
// ... .in('user_id', ids)
```

Aplicar em todas as 4 queries (`whatsapp_instances`, `contacts`, `campaigns`, `campaign_messages` + as 3 funções auxiliares).

## Arquivos afetados
- `src/components/inbox/MessageView.tsx` — safe-area + ajustes do botão voltar
- `src/hooks/useDashboardMetrics.ts` — usar IDs da organização em todas as queries

## Validação
- Abrir `/inbox` em viewport de iPhone (440×688) → confirmar que o botão voltar fica abaixo da Dynamic Island e responde no primeiro toque.
- Abrir `/dashboard` no desktop e mobile → confirmar que cards mostram contagens reais (contatos, campanhas, mensagens enviadas, taxa de entrega).
