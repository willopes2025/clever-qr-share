Vou corrigir a instabilidade da tabela em modo linha no funil. O problema não parece ser o telefone em si: os logs mostram aviso de React sobre colunas com a mesma chave, como `custom_valor_da_entrada` e `custom_referncia_da_armao`. Também vi no banco que a configuração salva de colunas tem IDs duplicados e a coluna `phone` aparece fora do lugar no fim da ordem. Isso faz o React reutilizar/omitir células durante ordenação, dando a sensação de que o telefone aparece e some.

Plano de correção:

1. Sanitizar a configuração de colunas antes de renderizar
   - Remover IDs duplicados de `visibleColumns` e `columnOrder` em memória.
   - Garantir que `phone` esteja sempre visível.
   - Garantir que `phone` fique logo após `contact`, tanto em colunas visíveis quanto na ordem.
   - Ignorar IDs de colunas que não existem mais.

2. Evitar duplicidade na geração de campos personalizados
   - Ajustar `allColumns` para não criar colunas duplicadas quando existirem `field_key` repetidos vindos de usuários/organizações diferentes.
   - Preferir a definição mais adequada ao contexto atual e manter uma coluna por ID lógico.

3. Corrigir as chaves React da tabela
   - Trocar chaves simples como `key={colId}` por chaves estáveis que incluam posição quando necessário.
   - Isso elimina o aviso de “Encountered two children with the same key” e impede células de serem omitidas/reutilizadas indevidamente.

4. Persistir a configuração limpa ao salvar colunas
   - Quando o usuário abrir/salvar “Colunas”, salvar arrays já deduplicados e com `phone` na posição correta.
   - Isso impede que a configuração antiga volte a bagunçar a tabela após recarregar ou ordenar.

5. Remover logs temporários de diagnóstico
   - Remover os `console.log` adicionados anteriormente para telefone vazio/formatador.
   - Manter fallback seguro: se houver telefone no banco, exibir formatado; se a formatação falhar, exibir o número bruto; se realmente estiver vazio, mostrar `-`.

Arquivos prováveis:
- `src/components/funnels/FunnelListView.tsx`
- Possivelmente `src/components/funnels/ColumnsConfigDialog.tsx`, apenas se for necessário sanitizar também no modal de configuração.

Resultado esperado:
- O telefone não deve mais sumir ao ordenar A-Z ou Z-A.
- A coluna Telefone deve permanecer fixa logo após Contato.
- A tabela não deve mais emitir warnings de chaves duplicadas por colunas personalizadas.
- A visualização em linha fica estável mesmo com configurações antigas salvas.