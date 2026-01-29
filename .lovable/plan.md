
# Plano: Busca por Conteúdo de Mensagens no Inbox

## Objetivo

Permitir que a busca "Buscar conversa..." encontre conversas que contenham qualquer palavra digitada no conteúdo das mensagens (não apenas pelo nome ou telefone do contato).

## Situação Atual

A busca no `ConversationList.tsx` (linha 117) atualmente filtra apenas por:
- Nome do contato
- Telefone do contato  
- Display ID do contato

```typescript
const matchesSearch = name.toLowerCase().includes(search) || phone.includes(search) || displayId.includes(search);
```

## Abordagem Proposta

Implementar busca em tempo real com **debounce** que consulta as mensagens no banco quando o termo de busca tem 3+ caracteres.

```text
┌─────────────────────────────────────────────────────────────┐
│ Usuário digita: "paciente"                                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ debounce 500ms
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Query: SELECT DISTINCT conversation_id                      │
│        FROM inbox_messages                                  │
│        WHERE content ILIKE '%paciente%'                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Resultado: IDs das conversas que contêm "paciente"          │
│ → Filtro combina com nome/telefone (OR)                     │
└─────────────────────────────────────────────────────────────┘
```

## Alterações Técnicas

### 1. Criar hook `useConversationSearch.ts`

Novo hook que faz a busca por conteúdo de mensagens:

```typescript
// src/hooks/useConversationSearch.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useConversationSearch = (searchTerm: string) => {
  return useQuery({
    queryKey: ['conversation-search', searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 3) return [];
      
      const { data, error } = await supabase
        .from('inbox_messages')
        .select('conversation_id')
        .ilike('content', `%${searchTerm}%`)
        .limit(100);
      
      if (error) throw error;
      
      // Return unique conversation IDs
      return [...new Set(data.map(m => m.conversation_id))];
    },
    enabled: searchTerm.length >= 3,
    staleTime: 30000, // Cache por 30s
  });
};
```

### 2. Modificar `ConversationList.tsx`

**Adicionar import e uso do hook:**

```typescript
import { useConversationSearch } from "@/hooks/useConversationSearch";

// Dentro do componente:
const [debouncedSearch, setDebouncedSearch] = useState("");

// Debounce de 500ms
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(searchTerm);
  }, 500);
  return () => clearTimeout(timer);
}, [searchTerm]);

const { data: matchingConversationIds = [] } = useConversationSearch(debouncedSearch);
```

**Atualizar a lógica de filtro (linha ~112-117):**

```typescript
const filteredConversations = sortedConversations.filter(conv => {
  const name = conv.contact?.name || "";
  const phone = conv.contact?.phone || "";
  const displayId = (conv.contact as any)?.contact_display_id || "";
  const search = searchTerm.toLowerCase();
  
  // Busca por nome, telefone ou ID
  const matchesContactSearch = name.toLowerCase().includes(search) || 
                               phone.includes(search) || 
                               displayId.includes(search);
  
  // Busca por conteúdo de mensagens (quando há resultado da query)
  const matchesMessageContent = debouncedSearch.length >= 3 && 
                                matchingConversationIds.includes(conv.id);
  
  // Combina: se não digitou nada, mostra todas; senão, combina OR
  const matchesSearch = !searchTerm ? true : 
                        (matchesContactSearch || matchesMessageContent);
  
  // ... resto dos filtros mantidos
});
```

### 3. Criar índice para otimização (opcional mas recomendado)

Migração SQL para melhorar performance com ~20k mensagens:

```sql
-- Índice para buscas ILIKE no conteúdo (trigram)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_inbox_messages_content_trgm 
ON inbox_messages USING gin (content gin_trgm_ops);
```

## Resultado Esperado

| Digitação | Comportamento |
|-----------|---------------|
| "" (vazio) | Mostra todas as conversas |
| "Ma" (2 chars) | Filtra apenas por nome/telefone |
| "Marcelo" (3+ chars) | Busca por nome + conteúdo de mensagens |
| "paciente" | Retorna conversas onde qualquer mensagem contém "paciente" |

## Arquivos a Modificar

1. **Criar:** `src/hooks/useConversationSearch.ts` - Hook de busca
2. **Modificar:** `src/components/inbox/ConversationList.tsx` - Integrar busca
3. **Migração SQL:** Índice trigram para performance (opcional)
