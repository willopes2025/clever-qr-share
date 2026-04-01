

# Corrigir Loop do ssOtica no Kanban

## Problema Identificado

O `useSsoticaSync` está sendo executado dentro do `DealFormDialog`, que é renderizado por **cada card** no Kanban (`FunnelDealCard`). Com 50+ cards visíveis, cada um dispara 3 chamadas à API do ssOtica (OS, Vendas, Parcelas) simultaneamente. Pior: quando a busca é por telefone (sem CPF), o sistema baixa TODA a lista de OS/vendas/parcelas para filtrar localmente.

O loop acontece porque:
1. Sync escreve em `custom_fields` do deal
2. Isso causa re-fetch dos deals no Kanban
3. Os cards re-montam, resetando o `syncAttemptedRef`
4. Sync dispara novamente → ciclo infinito

## Solução

### 1. Condicionar o sync ao dialog estar aberto
No `useSsoticaSync`, adicionar um parâmetro `enabled` e só disparar quando o dialog estiver de fato aberto. Isso elimina completamente o loop pois os 50+ cards do Kanban não vão mais sincronizar em background.

### 2. Passar `open` como parâmetro
Atualizar todas as chamadas a `useSsoticaSync` para incluir `open` do dialog como condição de ativação.

### 3. Melhorar cache para evitar re-syncs
Quando o dialog abre e já existe `ssotica_ultima_sync` recente nos `custom_fields`, usar os dados em cache sem fazer novas chamadas à API.

## Arquivos Alterados

- `src/hooks/useSsoticaSync.ts` — Adicionar parâmetro `enabled`, condicionar `useEffect` a ele, e impedir sync quando desabilitado.
- `src/components/funnels/DealFormDialog.tsx` — Passar `open` como parâmetro `enabled` ao hook.

## Resultado Esperado

- Zero chamadas à API do ssOtica ao carregar o Kanban
- Sync só dispara quando o usuário clica para abrir um card
- Cache de 5 minutos continua funcionando
- Fim do loop e da lentidão

