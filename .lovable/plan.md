

# Fix: Conversa de busca server-side não abre ao clicar

## Problema

O `Inbox.tsx` armazena apenas o `selectedConversationId` e depois busca o objeto completo somente dentro de `conversations` (do hook `useConversations`). Conversas encontradas via busca server-side (que não estavam no cache local) existem apenas dentro do `ConversationList` como `missingSearchConversations` — por isso, ao clicar, `selectedConversation` resolve como `null` e o painel de mensagens não abre.

## Solução

1. **Guardar o objeto completo da conversa selecionada** no `Inbox.tsx` como fallback. Quando `handleSelectConversation` é chamado, armazenar o objeto em um `useState<Conversation | null>` separado.

2. **Atualizar o `selectedConversation` memo** para usar o objeto das `conversations` atualizadas (para manter dados frescos), mas se não encontrar lá, usar o objeto salvo como fallback.

## Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Inbox.tsx` | Adicionar `fallbackConversation` state; atualizar `handleSelectConversation` para salvar objeto; atualizar memo `selectedConversation` para usar fallback |

## Detalhes

```typescript
// Novo state
const [fallbackConversation, setFallbackConversation] = useState<Conversation | null>(null);

// handleSelectConversation atualizado
const handleSelectConversation = (conversation: Conversation) => {
  setSelectedConversationId(conversation.id);
  setFallbackConversation(conversation); // salva objeto completo
  // ... resto igual
};

// selectedConversation memo atualizado
const selectedConversation = useMemo(() => {
  if (!selectedConversationId) return null;
  return conversations?.find(c => c.id === selectedConversationId) 
    || fallbackConversation?.id === selectedConversationId ? fallbackConversation : null;
}, [conversations, selectedConversationId, fallbackConversation]);
```

Mudança mínima (~5 linhas), sem efeitos colaterais.

