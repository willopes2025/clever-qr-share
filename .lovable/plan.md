

## Plano: Mostrar apenas campos preenchidos + dropdown para campos vazios

### Conceito

Tanto na seção "Dados do Lead" quanto "Dados do Contato", os campos serão divididos em dois grupos:
- **Campos preenchidos**: exibidos normalmente como hoje (editáveis inline)
- **Campos vazios**: ocultos da lista principal e acessíveis via um Select/dropdown "Adicionar campo" que lista apenas os campos sem valor. Ao selecionar um campo vazio, ele é adicionado à lista visível e entra em modo de edição automaticamente

### Alterações

#### 1. `LeadFieldsSection.tsx`
- Separar `filteredLeadFields` em `filledFields` (campos com valor em `customFields`) e `emptyFields` (sem valor)
- Renderizar apenas `filledFields` na lista
- Após a lista, adicionar um `Select` com placeholder "Preencher campo..." listando os `emptyFields` por nome
- Ao selecionar um campo vazio, setar `editingField` para aquele campo e adicioná-lo temporariamente à lista visível (via estado `manuallyAdded`)
- Campos boolean/switch sempre aparecem (já que false é um valor válido)

#### 2. `ContactFieldsSection.tsx`
- Mesma lógica: separar preenchidos vs vazios
- O dropdown de campos vazios fica antes do botão "Adicionar Campo" existente
- Campos nativos (Nome, Telefone, Email) continuam sempre visíveis

### Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `LeadFieldsSection.tsx` | Separar filled/empty, dropdown para vazios |
| `ContactFieldsSection.tsx` | Mesma lógica aplicada aos campos do contato |

### Impacto
- Nenhuma alteração de banco de dados
- 2 arquivos frontend modificados
- Painel fica mais limpo mostrando só dados relevantes

