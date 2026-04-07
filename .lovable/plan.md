

## Diagnóstico: Leads com Mesmo Telefone

### Problema Identificado

Quando você tenta cadastrar um novo lead com um telefone que já existe, o sistema **falha silenciosamente** e não cria o lead. Isso acontece porque:

1. A tabela `contacts` tem uma constraint `unique_phone_per_user` que impede dois contatos com o mesmo telefone
2. O fluxo de criação tenta **criar um novo contato** antes de criar o deal/lead
3. Quando o INSERT do contato falha (telefone duplicado), o `onSuccess` nunca executa → o deal **nunca é criado**
4. O usuário vê o erro "Este número já está cadastrado" e nada mais acontece

### O Cenário Real

Pai, mãe e filho podem usar o **mesmo telefone**. Eles devem ser **leads separados** (deals no funil), mas vinculados ao **mesmo contato** (mesmo telefone = mesma conversa no WhatsApp).

### Plano de Correção

**Arquivos a alterar:**

1. **`src/hooks/useContacts.ts`** — Função `createContact`
   - Quando o INSERT falhar com `unique_phone_per_user`, buscar o contato existente pelo telefone
   - Atualizar os dados do contato existente (nome, email, campos custom) se fornecidos
   - Retornar o contato existente em vez de lançar erro, permitindo que o `onSuccess` execute e crie o deal

2. **`src/pages/Contacts.tsx`** — Função `handleCreateContact`
   - Ajustar o fluxo para que, ao receber um contato existente de volta, ainda crie o deal normalmente
   - Mostrar toast informativo: "Contato existente atualizado - Lead criado" em vez de erro

3. **`src/hooks/useFunnels.ts`** — Função `createDeal` (sem mudança, já funciona)
   - Já permite criar múltiplos deals para o mesmo `contact_id` — não tem restrição

### Comportamento Esperado Após Correção

- Telefone **novo** → cria contato + cria lead ✅
- Telefone **existente** → encontra contato existente, atualiza dados se necessário, cria novo lead vinculado ✅
- Toast informativo diferencia os dois cenários
- O contato mantém uma única conversa no WhatsApp (mesmo telefone)
- Múltiplos leads/deals podem existir para o mesmo contato no funil

### Pontos que NÃO mudam

- A constraint `unique_phone_per_user` permanece (1 contato por telefone é correto para o sistema de conversas)
- Webhooks, formulários e campanhas continuam funcionando normalmente
- A deduplicação no `submit-form` e `receive-webhook` já faz o correto (encontra contato existente e cria deal)

