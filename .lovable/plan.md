## Diagnóstico — Filtros das Listas Dinâmicas

Após auditar `src/hooks/useBroadcastLists.ts` e `src/components/broadcasts/BroadcastListFormDialog.tsx`, encontrei **6 problemas** que fazem com que os leads filtrados não apareçam corretamente na lista (e divirjam entre o badge de contagem e a lista efetiva exibida/disparada):

---

### Bugs encontrados

**1. Etapas finais (Ganho/Perdido) ocultas no seletor de etapa**
No diálogo de criação da lista, ao escolher fonte = "Funil", o select de Etapa filtra `s => !s.is_final`. Isso impede o usuário de criar uma lista para leads ganhos/perdidos (ex.: reativar perdidos com uma campanha).

**2. Branch "Funil" usa `.limit(1000)` em vez de paginar**
Em `useListContacts`, quando `source === 'funnel'`, a query usa `.limit(1000)` (linhas 353 e 385). Funis com >1000 deals retornam **lista truncada silenciosamente** — diferente do badge de contagem, que conta tudo via `head: true`. Isso faz parecer que "leads não aparecem".

**3. Filtro `optedOut` não aplicado na fonte "Funil"**
Quando source = funnel, o código nunca aplica `excludeOptedOut` aos contatos retornados. O usuário marca a opção mas ela é ignorada para listas de funil.

**4. Filtro de tags na fonte "Funil" só busca os primeiros 1000 deals**
A combinação `funil + tags` faz fetch de até 1000 deals e depois filtra por tag em memória. Em funis grandes, leads válidos ficam de fora.

**5. `customFields` aplicado na entidade errada quando source = "funnel"**
No dialog, ao escolher fonte = "funnel", só são listados campos do tipo `lead` — porém o filtro é aplicado em `funnel_deals.custom_fields`. Isso está correto **somente** se o campo estiver salvo no deal. Campos de Lead que foram convertidos/movidos do contato (vencimento boleto etc., conforme memória do projeto, vivem em `contacts.custom_fields`) ficam fora do filtro. Resultado: zero matches mesmo havendo leads válidos.

**6. Inconsistência entre contagem e listagem para "tags + customFields"**
Em `countContactsByCriteria` (branch com tags), aplica filtros de `customFields` mas pagina manualmente. A `useListContacts` (branch idêntico) também pagina, mas a deduplicação por `Map<id>` esconde resultados quando a query retorna >1000 linhas com mesmo contato em múltiplas tags. Em contas grandes o número exibido no card e o número da lista divergem.

---

### Plano de correção

**A. `BroadcastListFormDialog.tsx`**
- Permitir todas as etapas no select (incluindo `is_final`), marcando-as visualmente com badge "Final".
- Quando fonte = "funnel", oferecer um sub-seletor "Buscar campos em" → opções: **Lead** (deal.custom_fields, padrão) ou **Contato** (contact.custom_fields). Mostrar campos da entidade escolhida.

**B. `useBroadcastLists.ts` — `useListContacts` (branch funnel)**
- Substituir `.limit(1000)` por paginação `.range()` em loop (igual ao branch de contatos).
- Aplicar `optedOut` no contato (via filtro no join `contacts!inner(...)` com `.eq('contacts.opted_out', false)`).
- Para tags + funnel: trocar a busca em memória por **paginação completa** dos deals e depois join com `contact_tags` em lote.
- Adicionar suporte para filtros de `customFields` em `contacts.custom_fields` quando o usuário escolher entidade "Contato" (usar JOIN ao invés de filtro no deal).

**C. `useBroadcastLists.ts` — `countContactsByCriteria` (branch funnel)**
- Replicar exatamente as mesmas regras (paginar, aplicar optedOut, suportar campo do contato vs do lead) para garantir paridade entre badge e lista.

**D. Consistência geral**
- Extrair uma função helper `applyCustomFieldFilters(query, customFields, jsonColumn)` reutilizada por todos os 4 branches (count contatos, count funil, list contatos, list funil) para eliminar divergências.
- Unificar pagamento Asaas: aplicar `optedOut` também quando o filtro é `asaasPaymentStatus` em fonte funil (hoje só funciona em contatos).

---

### Detalhes técnicos

**Sintaxe JSONB no PostgREST**
A sintaxe atual ``custom_fields->>${fieldKey}`` está correta para campos top-level com chaves alfanuméricas/underscore. Caso a chave do campo contenha hífen (raro mas possível), precisa virar ``custom_fields->>"${fieldKey}"``. Vou normalizar via helper.

**OptedOut em join**
Para `funnel_deals` com `contacts!inner(...)`, o filtro precisa ser:
```ts
query = query.eq('contacts.opted_out', false);
```
(não `query.eq('opted_out', false)` — esse filtra na tabela base errada).

**Paginação consistente**
```ts
let all: any[] = [];
let page = 0;
const PAGE = 1000;
while (true) {
  const { data, error } = await query.range(page*PAGE, (page+1)*PAGE - 1);
  if (error) throw error;
  if (!data?.length) break;
  all.push(...data);
  if (data.length < PAGE) break;
  page++;
}
```

---

### Arquivos a editar

- `src/hooks/useBroadcastLists.ts` — corrigir as 4 branches (contagem/listagem × contatos/funil), adicionar helper compartilhado.
- `src/components/broadcasts/BroadcastListFormDialog.tsx` — liberar etapas finais + seletor de entidade dos campos personalizados na fonte funil.

Sem migração de banco. Sem mudanças em Edge Functions.

**Posso aplicar essas correções?**