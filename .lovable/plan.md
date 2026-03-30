

## Plano: Adicionar campos personalizados como variáveis no formulário de Template Meta

### Problema
O formulário de criação de Template Meta (`MetaTemplateForm.tsx`) usa um `Textarea` simples para o corpo da mensagem. Não há nenhum mecanismo de autocompletar ou lista de variáveis disponíveis mostrando os campos personalizados do sistema.

### Contexto Importante
Templates Meta usam variáveis numéricas (`{{1}}`, `{{2}}`), diferente dos templates internos que usam chaves nomeadas (`{{nome}}`). Porém, ao criar o template, o usuário precisa saber quais dados ele tem disponíveis para planejar as variáveis.

### Solução
Adicionar uma seção de **variáveis disponíveis** abaixo do campo "Corpo da Mensagem" no `MetaTemplateForm.tsx`, mostrando os campos personalizados (contato e lead) como referência visual. Ao clicar em um chip, a próxima variável numérica disponível (`{{1}}`, `{{2}}`, etc.) será inserida no texto.

### Alterações

**1. `src/components/settings/meta-templates/MetaTemplateForm.tsx`**
- Importar `useCustomFields` para obter `contactFieldDefinitions` e `leadFieldDefinitions`
- Adicionar seção colapsável "Variáveis disponíveis" abaixo do textarea do corpo, com:
  - Chips clicáveis organizados em grupos: **Dados do Contato** (nome, telefone, email) e **Campos Personalizados** (contato + lead)
  - Ao clicar em um chip, insere `{{N}}` (próximo número disponível) no textarea na posição do cursor
  - Tooltip no chip mostrando o nome amigável do campo
- Atualizar a dica existente (`Use {{1}}, {{2}}, etc.`) para incluir uma nota de que os campos personalizados estão disponíveis abaixo
- Adicionar mapeamento visual: ao lado de cada exemplo de variável detectada, mostrar um texto indicando qual campo pode ser vinculado (referência, não binding real — o binding acontece na campanha)

### Detalhes Técnicos
- Reutilizar os ícones `User`, `FileText` já usados em outros componentes
- Os chips mostram o `field_name` amigável e ao clicar inserem `{{N+1}}` onde N é a contagem atual de variáveis no texto
- Nenhuma alteração de banco de dados necessária
- Nenhuma alteração na Edge Function necessária

