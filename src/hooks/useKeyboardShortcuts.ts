import { useEffect, useCallback } from 'react';

interface ShortcutHandlers {
  onNewConversation?: () => void;
  onSearch?: () => void;
  onEmojiPicker?: () => void;
  onNextConversation?: () => void;
  onPreviousConversation?: () => void;
  onSendMessage?: () => void;
  onEscape?: () => void;
}

export const useKeyboardShortcuts = (handlers: ShortcutHandlers) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? event.metaKey : event.ctrlKey;
    
    // Don't trigger shortcuts when typing in input fields (unless it's Escape)
    const isInputField = ['INPUT', 'TEXTAREA'].includes((event.target as Element).tagName);
    
    // Escape - close dialogs
    if (event.key === 'Escape' && handlers.onEscape) {
      handlers.onEscape();
      return;
    }
    
    // Allow these shortcuts even in input fields
    if (modKey && event.key === 'Enter' && handlers.onSendMessage) {
      event.preventDefault();
      handlers.onSendMessage();
      return;
    }
    
    // Don't trigger other shortcuts when in input fields
    if (isInputField) return;
    
    // Ctrl/Cmd + N - New conversation
    if (modKey && event.key === 'n' && handlers.onNewConversation) {
      event.preventDefault();
      handlers.onNewConversation();
      return;
    }
    
    // Ctrl/Cmd + K - Search
    if (modKey && event.key === 'k' && handlers.onSearch) {
      event.preventDefault();
      handlers.onSearch();
      return;
    }
    
    // Ctrl/Cmd + E - Emoji picker
    if (modKey && event.key === 'e' && handlers.onEmojiPicker) {
      event.preventDefault();
      handlers.onEmojiPicker();
      return;
    }
    
    // Arrow down - Next conversation
    if (event.key === 'ArrowDown' && handlers.onNextConversation) {
      event.preventDefault();
      handlers.onNextConversation();
      return;
    }
    
    // Arrow up - Previous conversation
    if (event.key === 'ArrowUp' && handlers.onPreviousConversation) {
      event.preventDefault();
      handlers.onPreviousConversation();
      return;
    }
  }, [handlers]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

export const KEYBOARD_SHORTCUTS = [
  { keys: ['Ctrl', 'N'], description: 'Nova conversa', mac: ['⌘', 'N'] },
  { keys: ['Ctrl', 'K'], description: 'Buscar conversa', mac: ['⌘', 'K'] },
  { keys: ['Ctrl', 'E'], description: 'Abrir emojis', mac: ['⌘', 'E'] },
  { keys: ['Ctrl', 'Enter'], description: 'Enviar mensagem', mac: ['⌘', 'Enter'] },
  { keys: ['↑'], description: 'Conversa anterior', mac: ['↑'] },
  { keys: ['↓'], description: 'Próxima conversa', mac: ['↓'] },
  { keys: ['Esc'], description: 'Fechar diálogo', mac: ['Esc'] },
];
