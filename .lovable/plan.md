## Diagnóstico

Investiguei o banco e o código. São **três problemas separados**:

### 1. Duplicatas reais encontradas (apenas 1 caso para `williamminguta@gmail.com`)
- `Forma de Pg Saldo` (`forma_de_pg_saldo`) **vs** `Forma Pg Saldo` (`forma_pg_saldo`) → ambos do tipo `lead`, criados em 26/03 quase no mesmo segundo. É duplicata real.
- "Modelo de Lente - Dependente 1" e "Modelo de Lente - Dependente 2" **NÃO são duplicatas** — são dois campos diferentes (um por dependente). Mesma coisa para "Tipo de Lente" e "Ref. Armação". Vou deixá-los intactos.
- Para `andressamartins@oticamarins.com.br` não há nenhuma duplicata.

### 2. Não existe gerenciamento de campos no Funil
O diálogo "Configurar Colunas" (mostrado no print) só permite **mostrar/ocultar e reordenar** colunas. Não tem botão de **excluir / editar / tornar obrigatório**.
Hoje, a única tela com essas ações é o `CustomFieldsManager` no painel lateral do Inbox (ícone de engrenagem). Por isso o usuário não consegue gerenciar os campos pelo Funil.

### 3. Excluir/Editar funcionam pela RLS, mas a UX está escondida
As policies de `custom_field_definitions` permitem `UPDATE` e `DELETE` para o dono e qualquer membro ativo da organização. O hook `useCustomFields` está correto. O problema é puramente de UI (não há botão na tela do Funil).

---

## Plano de correção

### Passo 1 — Limpar duplicata real existente (migration)
Remover o campo `forma_pg_saldo` (id `625af5bc-81f3-419f-ab6c-4af220331339`) pois é cópia de `forma_de_pg_saldo`.
Antes de excluir, copiar qualquer valor existente em `funnel_deals.custom_fields->>'forma_pg_saldo'` para a chave canônica `forma_de_pg_saldo` quando esta estiver vazia, para não perder dados.

### Passo 2 — Adicionar botão "Gerenciar Campos" no Funil (Lista e Kanban)
No header do `FunnelListView` (e também no `FunnelKanbanView`), adicionar um botão ao lado de "Colunas" que abre o componente `CustomFieldsManager` já existente. Esse componente já tem:
- Listagem de todos os campos personalizados (Contato + Lead)
- Botão de **editar** (nome, tipo, opções, **obrigatório** via switch)
- Botão de **excluir**
- Botão de **adicionar** novo campo

Como o `CustomFieldsManager` está hoje com seu próprio `DialogTrigger` (ícone de engrenagem), vou refatorá-lo levemente para aceitar `open`/`onOpenChange` controlados, permitindo que o Funil dispare o mesmo dialog.

### Passo 3 — Reaproveitar a mesma ação no `ColumnsConfigDialog`
Em cada linha de coluna **personalizada** (id começando com `custom_`), exibir dois ícones extras à direita:
- ✏️ "Editar campo" → abre o editor inline do `CustomFieldsManager` direto naquele campo
- 🗑️ "Excluir campo" → confirma e chama `deleteField`
Isso resolve o caso prático mostrado no print: o usuário identifica a coluna duplicada e a remove sem precisar trocar de tela.

### Passo 4 — Indicador visual de duplicatas
No `CustomFieldsManager`, marcar com badge "Possível duplicata" quando dois campos da mesma `entity_type` tiverem similaridade > 0.85 no `field_name` (cálculo no client). Apenas visual; não exclui automaticamente.

### Passo 5 — Validação ao criar campo novo
Em `CustomFieldsManager.handleAddField`, antes de chamar `createField`, verificar se já existe um campo com o mesmo `field_key` na mesma `entity_type`. Se existir, exibir toast de erro e não criar — evita gerar novas duplicatas no futuro.

---

## Arquivos afetados

- **Migration SQL** (nova): consolidar `forma_pg_saldo` em `forma_de_pg_saldo` e remover a definição duplicada
- `src/components/inbox/CustomFieldsManager.tsx`: aceitar props `open`/`onOpenChange` opcionais; adicionar validação anti-duplicata; badge de "possível duplicata"
- `src/components/funnels/ColumnsConfigDialog.tsx`: novos botões editar/excluir por linha de coluna personalizada; novas props `onEditField` e `onDeleteField`
- `src/components/funnels/FunnelListView.tsx`: adicionar botão "Gerenciar Campos" no header e wirar callbacks editar/excluir do `ColumnsConfigDialog` ao `useCustomFields`
- `src/components/funnels/FunnelKanbanView.tsx`: adicionar mesmo botão "Gerenciar Campos" no header

Posso aplicar este plano?