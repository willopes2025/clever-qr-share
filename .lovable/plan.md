

## Plano: Notificações visíveis mesmo com sistema minimizado + toast in-app

### Situação atual
- O sistema já usa a **Browser Notification API** (`useNotifications.ts`) para notificar mensagens inbound
- Porém, na linha 51, há um `if (document.hasFocus()) return null` que **bloqueia** notificações quando a aba está ativa
- Quando a aba está em foco, nenhum feedback visual aparece — o som toca mas não há popup
- A API de Browser Notifications **já funciona** quando o navegador está minimizado, desde que a permissão tenha sido concedida

### O que será feito

#### 1. Remover bloqueio de notificação quando em foco (`useNotifications.ts`)
- Remover a linha `if (document.hasFocus()) return null`
- Quando em foco: exibir **toast in-app** (sonner) com nome do contato e preview da mensagem, clicável para abrir a conversa
- Quando minimizado/em background: disparar **Browser Notification** normalmente (popup do sistema operacional)

#### 2. Adicionar toast in-app no `NotificationProvider.tsx`
- Quando a mensagem inbound chega e a aba está em foco, chamar `toast()` do sonner com:
  - Ícone de mensagem
  - Nome do contato + preview
  - Ação clicável que navega para `/inbox?conversationId=X`
- Quando a aba NÃO está em foco, manter o Browser Notification (popup do OS)

#### 3. Garantir que o som toca em ambos os cenários
- O som já toca independente da permissão — será mantido

### Arquivos a modificar
- `src/hooks/useNotifications.ts` — separar lógica: retornar se está em foco ou não, deixar o chamador decidir
- `src/components/NotificationProvider.tsx` — adicionar toast in-app com navegação quando em foco, browser notification quando não

### Resultado
- **App minimizado/background**: popup nativo do sistema operacional (Browser Notification)
- **App em foco**: toast sonner no canto da tela com dados do contato + link para conversa
- **Ambos**: som de notificação

