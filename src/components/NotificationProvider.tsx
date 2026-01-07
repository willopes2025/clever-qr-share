import { useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications, useUnreadBadge } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useGlobalRealtime } from "@/hooks/useGlobalRealtime";

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider = ({ children }: NotificationProviderProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { permission, requestPermission, notifyNewMessage } = useNotifications();

  // Use optimized unread count hook instead of fetching all conversations
  const { data: totalUnread = 0 } = useUnreadCount();

  // Consolidated realtime subscription
  useGlobalRealtime();

  // Fetch notification-only instance IDs to exclude from notifications
  const { data: notificationInstanceIds } = useQuery({
    queryKey: ['notification-instance-ids', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('is_notification_only', true);
      
      if (error) throw error;
      return data?.map(i => i.id) || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes - these rarely change
  });

  // Update page title with unread badge
  useUnreadBadge(totalUnread);

  // Request notification permission on first load
  useEffect(() => {
    if (permission === 'default') {
      const timeout = setTimeout(() => {
        requestPermission();
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [permission, requestPermission]);

  // Get contact name from cached data or fetch
  const getContactName = useCallback(async (conversationId: string): Promise<string> => {
    // Check cached conversations first
    const cachedConversations = queryClient.getQueryData<any[]>(['conversations', user?.id]);
    const cachedConv = cachedConversations?.find(c => c.id === conversationId);
    if (cachedConv?.contact?.name) return cachedConv.contact.name;
    if (cachedConv?.contact?.phone) return cachedConv.contact.phone;

    // Fetch from database if not cached
    try {
      const { data } = await supabase
        .from('conversations')
        .select('contact:contacts(name, phone)')
        .eq('id', conversationId)
        .single();
      
      if (data?.contact) {
        return (data.contact as any).name || (data.contact as any).phone || 'Contato';
      }
    } catch (error) {
      console.error('Error fetching contact for notification:', error);
    }

    return 'Contato';
  }, [queryClient, user?.id]);

  // Listen for inbound messages for browser notifications only
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('notification-inbound-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inbox_messages',
          filter: `direction=eq.inbound`,
        },
        async (payload) => {
          const message = payload.new as {
            id: string;
            conversation_id: string;
            content: string;
            user_id: string;
          };

          // Only notify for messages belonging to this user
          if (message.user_id !== user.id) return;

          // Check if from notification-only instance
          const cachedConversations = queryClient.getQueryData<any[]>(['conversations', user?.id]);
          const conversation = cachedConversations?.find(c => c.id === message.conversation_id);
          if (conversation?.instance_id && notificationInstanceIds?.includes(conversation.instance_id)) {
            return;
          }

          // Get contact name and send notification
          const contactName = await getContactName(message.conversation_id);
          const messagePreview = message.content?.length > 50 
            ? message.content.substring(0, 50) + '...' 
            : message.content || 'Nova mensagem';
          
          notifyNewMessage(contactName, messagePreview);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, getContactName, notifyNewMessage, queryClient, notificationInstanceIds]);

  return <>{children}</>;
};
