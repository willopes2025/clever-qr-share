

## Auto-detectar tipo "Data" pelo nome do campo personalizado

### Problema
Quando o usuário cria um campo personalizado com nome contendo "data" (ex: "Data de nascimento", "Data da consulta"), o tipo padrão é "texto". O usuário precisa mudar manualmente para "data".

### Solução
Adicionar uma função `inferFieldType(name)` que analisa o nome do campo e sugere automaticamente o tipo correto. Aplicar nos 3 componentes de criação de campos.

**Regras de inferência:**
- Nome contém "data" → tipo `date`
- Nome contém "hora" ou "horário" → tipo `time`
- Nome contém "email" ou "e-mail" → tipo `email`
- Nome contém "telefone" ou "celular" ou "whatsapp" → tipo `phone`
- Nome contém "url" ou "site" ou "link" → tipo `url`
- Nome contém "valor" ou "preço" ou "custo" → tipo `number`
- Caso contrário → mantém `text`

**Arquivos a editar:**

1. **`src/components/contacts/InlineFieldCreator.tsx`** — ao digitar o nome, chamar `inferFieldType` e atualizar `fieldType` automaticamente
2. **`src/components/contacts/CreateFieldInlineDialog.tsx`** — mesma lógica no onChange do nome
3. **`src/components/inbox/CustomFieldsManager.tsx`** — mesma lógica no onChange do nome

O usuário ainda poderá alterar o tipo manualmente após a sugestão automática.

