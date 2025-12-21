import { useState, useEffect, useCallback, useRef } from 'react';

// Notification sound URL (using a simple notification sound)
const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setIsSupported('Notification' in window);
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
    
    // Preload notification sound
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
    audioRef.current.volume = 0.5;
    audioRef.current.preload = 'auto';
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const playNotificationSound = useCallback(() => {
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((error) => {
          console.log('Could not play notification sound:', error);
        });
      }
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }, []);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    // Don't show notification if the page is focused
    if (document.hasFocus()) return null;

    // Play sound regardless of notification permission
    playNotificationSound();
    
    if (!isSupported || permission !== 'granted') return null;
    
    try {
      const notification = new Notification(title, {
        icon: '/favicon.png',
        badge: '/favicon.png',
        ...options
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
      return null;
    }
  }, [isSupported, permission, playNotificationSound]);

  const notifyNewMessage = useCallback((contactName: string, messagePreview: string) => {
    return sendNotification(`Nova mensagem de ${contactName}`, {
      body: messagePreview,
      tag: 'new-message',
      requireInteraction: false
    });
  }, [sendNotification]);

  return {
    permission,
    isSupported,
    requestPermission,
    sendNotification,
    notifyNewMessage,
    playNotificationSound
  };
};

// Update document title with unread count
export const useUnreadBadge = (unreadCount: number) => {
  useEffect(() => {
    const originalTitle = document.title.replace(/^\(\d+\)\s*/, '');
    
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${originalTitle}`;
    } else {
      document.title = originalTitle;
    }

    return () => {
      document.title = originalTitle;
    };
  }, [unreadCount]);
};
