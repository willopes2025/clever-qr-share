

## Adicionar opções de telefone adicional (Comercial, Pessoal, Celular) na importação

### Problema
Na tela de mapeamento de colunas da importação de contatos, só existe a opção "Telefone" (principal). Quando o CSV tem colunas como "Telefone comercial", "Celular", "Telefone residencial", não há como mapeá-las para `additional_phones`.

### Solução

**Arquivo: `src/components/contacts/ImportContactsDialogV2.tsx`**

1. **Adicionar 3 novos campos no `STANDARD_FIELDS`:**
   - `phone_comercial` → "Telefone Comercial" 📞
   - `phone_pessoal` → "Telefone Pessoal" 📱
   - `phone_celular` → "Celular" 📲

2. **No switch de processamento do mapeamento**, tratar os novos cases (`phone_comercial`, `phone_pessoal`, `phone_celular`):
   - Limpar o valor (remover não-dígitos)
   - Acumular no array `additional_phones` dentro de `custom_fields`, no formato `{ phone: "55...", label: "Comercial" }` — mesmo formato já usado pelo sistema (`AdditionalPhonesManager`, `MessageView`)

3. **Na lógica de construção do contato**, garantir que `custom_fields.additional_phones` seja inicializado como array vazio e que cada campo de telefone extra faça `.push()` nele.

**Arquivo: `src/hooks/useContacts.ts`**

4. **Na mutação de importação**, ao fazer upsert do contato, fazer merge dos `additional_phones` importados com os já existentes no contato (evitar duplicatas).

### Resultado
O usuário poderá mapear múltiplas colunas de telefone do CSV para tipos específicos (Comercial, Pessoal, Celular), e todos serão salvos como telefones adicionais do contato, integrados ao seletor de telefone no Inbox.

