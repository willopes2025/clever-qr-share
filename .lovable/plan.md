## Diagnóstico

O Dashboard Financeiro fica preso em "Carregando dados financeiros..." porque o `useFinancialMetrics` só sai de `isLoading=false` quando **TODAS** as 4 queries do `useAsaas` terminam: `balance`, `customers`, `payments`, `subscriptions`.

Olhando os logs do `asaas-api`:
- A query `list-all-payments` atinge o limite de segurança de **5000 registros** e leva ~43s.
- `list-all-customers` e `list-all-subscriptions` também rodam em paralelo, cada uma puxando até 5000 itens.
- O `useAsaas()` é instanciado **duas vezes** na página `AsaasDashboard` (uma direta, outra dentro de `useFinancialMetrics`), o que pode estar duplicando o estado (não as queries, mas a leitura).

Resultado: payloads gigantes (15-20k registros somados), o navegador tenta processar tudo em uma única passada de `useMemo`, o JSON parsing + filter/reduce trava a UI, e se qualquer uma das 3 paginadas estourar timeout/erro silencioso o `isLoading` nunca volta para `false`.

## Plano de correção

### 1. Liberar a UI antes de tudo carregar
Em `src/components/financeiro/AsaasDashboard.tsx`:
- Trocar o gate `metrics.isLoading` por gates **granulares**: mostrar KPIs já com `balance` carregado, gráficos quando `payments` chegar, MRR quando `subscriptions` chegar.
- Cada card/seção mostra seu próprio skeleton enquanto a query dele está pendente. Nada bloqueia o resto.

### 2. Tornar `useFinancialMetrics` resiliente
Em `src/hooks/useFinancialMetrics.ts`:
- Não exigir todos os 4 loadings para retornar dados. Calcular o que dá com o que já chegou.
- Expor flags separadas: `isLoadingPayments`, `isLoadingSubscriptions`, etc., além de um `isPartial`.

### 3. Reduzir o volume puxado no dashboard
Hoje a página puxa **todos** os 5000+ pagamentos só para calcular métricas dos últimos 30 dias.

Opção A (recomendada, rápida): no edge function `asaas-api`, adicionar suporte ao parâmetro `dateRange` em `list-all-payments` e enviar `dueDate[ge]`/`dueDate[le]` no filtro da Asaas, limitando aos últimos ~90 dias para o dashboard. Continua existindo um `list-all-payments` sem filtro para as outras abas (Cobranças), mas o dashboard usa o filtrado.

Opção B (maior refactor, opcional): criar um endpoint `get-dashboard-metrics` na edge function que faça a agregação no servidor e devolva só os números, evitando trafegar milhares de registros.

### 4. Garantir que erros não deixem o loading travado
- No `useAsaas`, adicionar `retry: 1` e `refetchOnWindowFocus: false` nas 4 queries pesadas.
- Tratar `isError` no `AsaasDashboard` com mensagem clara + botão "Tentar novamente", em vez de spinner eterno.

### 5. Evitar dupla instância do `useAsaas`
`AsaasDashboard` chama `useAsaas()` e também `useFinancialMetrics()` (que chama `useAsaas()` de novo). Como as queries são chaveadas pelo `queryKey`, o React Query deduplica — mas há `useState` locais (`lastSync`, `isSyncing`) que ficam fora de sincronia. Mover `lastSync`/`isSyncing` para um pequeno contexto ou usar `useMutationState`/atom, para não criar dois "componentes" de sync independentes.

## Detalhes técnicos

Arquivos a editar:
- `src/components/financeiro/AsaasDashboard.tsx` — gates granulares + tratamento de erro.
- `src/hooks/useFinancialMetrics.ts` — remover dependência total do loading agregado, aceitar dados parciais.
- `src/hooks/useAsaas.ts` — `retry: 1`, `refetchOnWindowFocus: false`, opcionalmente aceitar `dateRange` no `list-all-payments`.
- `supabase/functions/asaas-api/index.ts` — aceitar filtro `dueDate[ge]`/`dueDate[le]` para a action `list-all-payments` quando o cliente enviar.

Sem mudanças de schema. Sem mudanças nas outras abas (Clientes/Cobranças/Assinaturas) — elas continuam puxando tudo.