

# Exibir Motivo Real do Erro nas Mensagens com Falha

## Problema
A edge function `send-inbox-message` já identifica erros específicos (ex: "Número não registrado no WhatsApp", "Instância desconectada"), mas ao atualizar o status da mensagem para `failed`, **não salva o motivo do erro** na coluna `error_message` da tabela `inbox_messages`. O `MessageBubble.tsx` tenta ler esse campo, mas como é sempre `null`, mostra a mensagem genérica.

## Solução
Salvar o `error_message` junto com o `status: 'failed'` em todos os pontos de falha da edge function.

### 1. Atualizar `supabase/functions/send-inbox-message/index.ts`
Em cada local onde faz `.update({ status: 'failed' })`, incluir também o `error_message`:

- **Linha 324** (template Meta falha): salvar `result.error?.message`
- **Linha 403** (mensagem Meta falha): salvar `result.error?.message`
- **Linha 556** (Evolution API falha): salvar o `errorMessage` já calculado

Além disso, no bloco `catch` final (linha 560-567), fazer update na mensagem (se o ID existir) com o erro capturado.

### 2. Atualizar `supabase/functions/send-inbox-media/index.ts`
Aplicar a mesma lógica para mensagens de mídia que falham.

### Resultado
Quando uma mensagem falhar, o tooltip/popover no chat mostrará o motivo real (ex: "Número (5527...) não registrado no WhatsApp" ou "Instância desconectada. Reconecte nas configurações") ao invés da mensagem genérica.

### Arquivos impactados
- `supabase/functions/send-inbox-message/index.ts`
- `supabase/functions/send-inbox-media/index.ts` (se aplicável)

