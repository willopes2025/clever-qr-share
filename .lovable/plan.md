

# Melhorar busca de leads no Inbox

## Problema atual

A busca atual no `ConversationList.tsx` já faz `phone.includes(search)` e `name.toLowerCase().includes(search)`, que teoricamente deveria funcionar para buscas parciais. Porém, os telefones são armazenados com DDI (ex: `5527988355451`), e a busca local funciona apenas sobre as conversas já carregadas em memória.

O problema principal: a busca por conteúdo via `useConversationSearch` só busca mensagens (mínimo 3 chars), mas **não busca contatos no servidor**. Se o usuário tem muitas conversas e busca "maria" ou "5451", só encontra matches entre as conversas já carregadas pelo hook `useConversations`.

## Solução

### 1. Criar hook `useContactSearch` para busca server-side de contatos

Novo hook que busca contatos no banco por nome OU telefone parcial quando o termo tem 3+ caracteres. Retorna `conversation_id`s matching.

```typescript
// src/hooks/useContactSearch.ts
// Busca contacts onde name ILIKE %term% OR phone ILIKE %term%
// Depois busca conversations com esses contact_ids
```

### 2. Atualizar `ConversationList.tsx`

- Importar `useContactSearch` ao lado de `useConversationSearch`
- Na lógica de filtro, combinar resultados: contactSearch OR messageSearch OR localMatch
- Garantir que a busca por telefone parcial (ex: "5451") encontre contatos com `phone LIKE '%5451%'` no servidor
- Atualizar placeholder do input para indicar que aceita busca por nome, telefone parcial ou conteúdo

### Arquivos a criar/editar

| Arquivo | Acao |
|---------|------|
| `src/hooks/useContactSearch.ts` | Criar - busca server-side por nome/telefone parcial |
| `src/components/inbox/ConversationList.tsx` | Editar - integrar hook de busca de contatos |

## Fluxo

1. Usuário digita "5451" ou "maria" no campo de busca
2. Após 500ms debounce e 3+ chars:
   - `useContactSearch`: busca `contacts` onde `phone ILIKE '%5451%'` ou `name ILIKE '%maria%'`, retorna `conversation_id`s via join com `conversations`
   - `useConversationSearch`: busca mensagens (já existe)
3. Filtro combina: local match OR contact server match OR message content match
4. Resultado mostra todas as conversas que correspondem

