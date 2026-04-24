## Problema confirmado
O gargalo agora é a consulta principal do Inbox, não mais os deals do funil.

Evidências encontradas:
- A requisição do Inbox para `conversations` está retornando `500` com `canceling statement due to statement timeout`.
- Hoje o hook `src/hooks/useConversations.ts` ainda busca a lista completa de conversas com embed de `contact` e `tag_assignments`, sem paginação.
- A base atual tem cerca de `8.464` conversas e `9.172` deals abertos, então abrir tudo de uma vez ficou caro demais.
- O perfil do navegador indica que o frontend não é o principal problema; a espera está concentrada no carregamento de dados.

## O que vou implementar

### 1. Paginar a lista do Inbox na origem
Atualizar `src/hooks/useConversations.ts` para carregar apenas a primeira página da lista de conversas ao abrir o Inbox, em vez de puxar tudo.

Planejamento técnico:
- aplicar `range/limit` na query principal
- manter ordenação por `is_pinned` + `last_message_at`
- carregar os deals apenas para os contatos visíveis na página atual
- preparar o hook para `page` / `pageSize` ou `useInfiniteQuery`

Resultado esperado: a barra lateral abre rápido mesmo com milhares de conversas.

### 2. Separar “lista leve” de “detalhe pesado”
Hoje a query base já traz campos que não precisam existir no primeiro paint da lista.

Vou dividir em duas camadas:
- **Lista leve:** id, contato básico, preview, unread, flags de IA, responsável, provider, etapa/deal visível
- **Detalhe sob demanda:** `notes`, `custom_fields`, dados completos do contato e demais informações do painel lateral

Arquivos envolvidos:
- `src/hooks/useConversations.ts`
- `src/components/inbox/RightSidePanel.tsx`
- componentes do painel lateral do lead/contato

Resultado esperado: o Inbox abre primeiro, e os detalhes carregam quando a conversa é selecionada.

### 3. Remover dependências pesadas fora da tela principal
Existem componentes usando `useConversations()` só para coisas simples, como badge de não lidas ou mutação de criar conversa.

Vou trocar isso por hooks leves:
- `src/mobile/components/MobileHeader.tsx` → usar `useUnreadCount`
- `src/mobile/components/MobileBottomNav.tsx` → usar `useUnreadCount`
- `src/components/MobileSidebarDrawer.tsx` → usar `useUnreadCount`
- `src/components/inbox/NewConversationDialog.tsx` → extrair mutações para um hook menor, sem disparar a query completa

Resultado esperado: menos montagem desnecessária da query pesada.

### 4. Ajustar backend para a nova estratégia
Se a query paginada ainda sofrer com o volume e com as regras de acesso, vou reforçar o backend com uma das opções abaixo:
- adicionar índices compostos voltados ao padrão real do Inbox
- e, se necessário, substituir a leitura REST atual por uma função paginada no backend que já devolva a lista enxuta do Inbox

Arquivos envolvidos:
- nova migration em `supabase/migrations/...sql`

Resultado esperado: evitar `statement timeout` mesmo com a base crescendo.

### 5. Refinar realtime e cache da lista paginada
Depois da paginação, o realtime não pode continuar “refazendo tudo”.

Vou ajustar para:
- atualizar apenas a página ativa
- mover a conversa alterada para o topo localmente quando chegar mensagem nova
- evitar refetch global completo da lista a cada evento

Arquivos envolvidos:
- `src/hooks/useGlobalRealtime.ts`
- `src/hooks/useConversations.ts`

## Validação
Vou considerar resolvido quando:
- a requisição principal do Inbox deixar de retornar timeout
- a primeira abertura do Inbox ocorrer rapidamente
- abrir uma conversa não travar a tela
- o painel lateral continuar mostrando dados corretos após seleção
- badges de não lidas e criação de conversa continuarem funcionando

## Detalhes técnicos
```text
Antes:
Inbox open
  -> busca todas as conversas
  -> embute contato + tags
  -> busca deals dos contatos retornados
  -> timeout / atraso grande

Depois:
Inbox open
  -> busca só a 1ª página da lista leve
  -> renderiza imediatamente
  -> ao selecionar conversa, busca detalhes sob demanda
  -> realtime atualiza apenas o necessário
```

## Arquivos mais prováveis de mudança
- `src/hooks/useConversations.ts`
- `src/hooks/useGlobalRealtime.ts`
- `src/components/inbox/ConversationList.tsx`
- `src/components/inbox/RightSidePanel.tsx`
- `src/components/inbox/NewConversationDialog.tsx`
- `src/mobile/components/MobileHeader.tsx`
- `src/mobile/components/MobileBottomNav.tsx`
- `src/components/MobileSidebarDrawer.tsx`
- `supabase/migrations/...sql`