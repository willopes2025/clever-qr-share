

## Análise: Formulário que atualiza dados do lead pelo código do lead

### O que já existe

O sistema atual de formulários (`submit-form`) já suporta localizar contatos por `contact_id` (via parâmetro estático `_static_contact_id`) e atualizar seus dados. Porém, **não existe** a possibilidade de localizar um contato pelo `contact_display_id` (código visível como "0001", "0042", etc.).

### Como implementar

A ideia é permitir que o formulário tenha um campo onde o respondente digita o código do lead (ex: "0042"), e o sistema use esse código para localizar o contato existente e atualizar seus dados (contato + deal/lead).

### Plano

#### 1. Novo mapping_type: `lookup_by_display_id`
- Adicionar o valor `lookup_by_display_id` ao constraint `form_fields_mapping_type_check` na tabela `form_fields`.
- Isso permite que um campo do formulário seja configurado como "campo de busca por código do lead".

#### 2. Atualizar `submit-form` Edge Function
- Antes de tentar criar/buscar contato por telefone/email, verificar se algum campo tem `mapping_type = 'lookup_by_display_id'`.
- Se existir, buscar o contato na tabela `contacts` usando `contact_display_id` igual ao valor informado.
- Se encontrado, usar esse contato como base (igual ao fluxo do `_static_contact_id`) e atualizar seus dados e custom fields.
- Se não encontrado, retornar erro informando que o código não foi encontrado.

#### 3. Atualizar o Form Builder (UI)
- No seletor de mapeamento de campo (`FormFieldMappingConfig` ou similar), adicionar a opção "Buscar lead por código" como tipo de mapeamento.
- Quando selecionado, o campo funciona como identificador de busca, não como dado a ser salvo.

#### 4. Atualizar `public-form` para exibir o campo normalmente
- Nenhuma mudança necessária no renderizador -- o campo aparece como input de texto normal.

### Resumo de arquivos alterados
- **Migração SQL**: Adicionar `lookup_by_display_id` ao constraint `form_fields_mapping_type_check`
- **`supabase/functions/submit-form/index.ts`**: Lógica de busca por `contact_display_id`
- **Componente de mapeamento no Form Builder**: Adicionar opção de mapeamento "Buscar lead por código"

