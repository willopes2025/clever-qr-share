
# Correção: Limite de 1000 Contatos na Importação

## Problema Identificado

O cliente **Matheus Suave** (`matheussuave002@gmail.com`) possui:
- **Plano:** Agência (contatos ilimitados - `max_contacts = null`)
- **Contatos atuais:** 1.741

O problema está na função de deduplicação dentro do `importContacts` no arquivo `src/hooks/useContacts.ts`. A query que busca contatos existentes **não possui paginação**:

```typescript
// Linha 339-342 - PROBLEMÁTICO
const { data: existingContacts, error: fetchError } = await supabase
  .from("contacts")
  .select("id, phone, email, contact_display_id, custom_fields")
  .eq("user_id", user.id);  // SEM paginação!
```

O Supabase tem um **limite padrão de 1000 registros por query**. Consequências:
1. Se o cliente tem mais de 1000 contatos, apenas os primeiros 1000 são verificados na deduplicação
2. Pode causar duplicações indesejadas ou contatos não sendo reconhecidos como existentes
3. Comportamento inconsistente na importação

---

## Solução Proposta

Implementar paginação na busca de contatos existentes durante a deduplicação, similar ao que já é feito no `fetchAllContacts` (linhas 60-109).

### Arquivo a modificar
`src/hooks/useContacts.ts`

### Mudanças

1. **Criar função auxiliar para buscar todos os contatos com paginação**
   
   Adicionar função similar ao `fetchAllContacts` mas otimizada para deduplicação (buscando apenas campos necessários):

   ```typescript
   const fetchAllContactsForDedup = async (userId: string) => {
     const PAGE_SIZE = 1000;
     let allContacts: Array<{
       id: string;
       phone: string;
       email: string | null;
       contact_display_id: string | null;
       custom_fields: Record<string, unknown> | null;
     }> = [];
     let page = 0;
     let hasMore = true;

     while (hasMore) {
       const from = page * PAGE_SIZE;
       const to = from + PAGE_SIZE - 1;

       const { data, error } = await supabase
         .from("contacts")
         .select("id, phone, email, contact_display_id, custom_fields")
         .eq("user_id", userId)
         .range(from, to);

       if (error) throw error;

       if (data && data.length > 0) {
         allContacts = [...allContacts, ...data];
         hasMore = data.length === PAGE_SIZE;
         page++;
       } else {
         hasMore = false;
       }
     }

     return allContacts;
   };
   ```

2. **Substituir a query atual pela função paginada**

   Alterar a linha 339-347 de:
   ```typescript
   const { data: existingContacts, error: fetchError } = await supabase
     .from("contacts")
     .select("id, phone, email, contact_display_id, custom_fields")
     .eq("user_id", user.id);
   ```
   
   Para:
   ```typescript
   const existingContacts = await fetchAllContactsForDedup(user.id);
   ```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useContacts.ts` | Adicionar função de paginação e atualizar query de deduplicação |

---

## Resultado Esperado

Após a correção:
- Importação funcionará corretamente para usuários com mais de 1000 contatos
- A deduplicação verificará **todos** os contatos existentes
- Não haverá mais limite implícito de 1000 contatos na importação
