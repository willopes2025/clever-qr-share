# Corrigir lag ao digitar no campo de mensagem (Inbox)

## Diagnóstico

`src/components/inbox/MessageView.tsx` tem **1875 linhas** e mantém o estado `newMessage` no topo do componente (linha 102). A cada tecla digitada:

1. `handleMessageChange` chama `setNewMessage(value)` (linha 534).
2. O componente inteiro re-renderiza — incluindo a lista de mensagens, bubbles, mídia, presença, sidebar etc.
3. Em conversas longas (ex.: João Luiz, com histórico grande), esse re-render custa dezenas a centenas de ms por tecla, gerando o atraso visível.

O `notifyTyping` em si não é o gargalo (tem debounce de 1500ms), mas o `console.log` em todo broadcast e os re-renders pesados amplificam o problema.

## Solução

Isolar o composer em um componente filho com **estado local próprio**, para que digitar não re-renderize a árvore inteira do `MessageView`.

### 1. Criar `src/components/inbox/MessageComposer.tsx`

Novo componente memoizado que:

- Mantém `value` em estado interno (`useState` local), evitando re-render do pai a cada tecla.
- Recebe via props: `onSend(text)`, `onTypingHint()` (chama `notifyTyping`), `onSlashCommand(query|null)`, `disabled`, `placeholder`, `initialValue` (para limpar/preencher via key/imperative).
- Encapsula: textarea, botão enviar, emoji picker, anexo, áudio, autocomplete de slash command (UI), `handleKeyDown` (Enter envia).
- Expõe um `ref` imperativo (`useImperativeHandle`) com `setText(text)`, `insertText(text)`, `clear()`, `focus()` — usado pelo pai para casos como AI sugerir mensagem, template, etc.
- Envolto em `React.memo` com props estáveis.

### 2. Ajustar `MessageView.tsx`

- Remover `useState newMessage` e todas as derivações dependentes da digitação contínua.
- Substituir o bloco do textarea (~linhas 1749–1810) por `<MessageComposer ref={composerRef} ... />`.
- Onde hoje se faz `setNewMessage(...)` programaticamente (AI, template, reply, etc.), trocar por `composerRef.current?.setText(...)` ou `insertText`.
- O botão "enviar" e o disable passam a viver dentro do composer (ele já conhece o texto). `selectedInstanceId` / `hasValidSender` viram props.
- `handleSend` recebe o texto como argumento vindo do composer, em vez de ler do estado do pai.

### 3. Limpar logs ruidosos do presence

Em `src/hooks/useConversationPresence.ts`, remover/condicionar os `console.log` de `sync`, `join`, `leave`, `broadcast typing received/sent`, `track result`, `subscribe status`, `creating channel`, `others now`. Eles disparam a cada keystroke remoto e poluem o devtools. Manter apenas warnings de erro real.

## Detalhes técnicos

- O `notifyTyping` continua sendo chamado no `onChange` interno do composer; como o pai não re-renderiza, o custo cai para apenas o re-render do próprio composer (textarea + autocomplete).
- `useImperativeHandle` é necessário porque hoje várias ações do pai (AI agent, templates, quick replies, slash commands aplicados, reply-to) escrevem no campo. Mantemos esse contrato sem voltar o estado para o pai.
- Manter compatibilidade com `VoiceRecorder`, `MediaUploadButton`, `EmojiPicker`, `SlashCommandPopup` movendo-os para dentro do composer.
- Não alterar lógica de envio, presença, realtime ou backend — apenas onde o estado de texto vive.

## Arquivos afetados

- `src/components/inbox/MessageComposer.tsx` (novo)
- `src/components/inbox/MessageView.tsx` (refator do bloco do composer + remoção do `newMessage` state)
- `src/hooks/useConversationPresence.ts` (limpar `console.log`)

## Validação

- Digitar rapidamente em uma conversa longa: as letras devem aparecer instantaneamente.
- Enviar mensagem (Enter e botão), shift+Enter quebra linha.
- Slash command (`/`) abre popup e insere template.
- Botões: emoji, anexo, áudio, AI ("Acionar IA") — continuam funcionais.
- Indicador de "digitando" para o outro usuário continua aparecendo.
