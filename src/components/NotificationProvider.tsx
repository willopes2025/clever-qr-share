import { useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications, useUnreadBadge } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import type { Conversation } from "@/hooks/useConversations";

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider = ({ children }: NotificationProviderProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { permission, requestPermission, notifyNewMessage } = useNotifications();

  // Fetch conversations directly here to avoid hook order issues
  const { data: conversations } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          contact:contacts(id, name, phone)
        `)
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      return data as Conversation[];
    },
    enabled: !!user,
  });

  // Calculate total unread count
  const totalUnread = useMemo(() => {
    return conversations?.reduce((sum, c) => sum + c.unread_count, 0) || 0;
  }, [conversations]);
  
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

  // Get contact name from conversation - memoized callback
  const getContactName = useCallback(async (conversationId: string): Promise<string> => {
    // First check cached conversations
    const cachedConversation = conversations?.find(c => c.id === conversationId);
    if (cachedConversation?.contact?.name) {
      return cachedConversation.contact.name;
    }
    if (cachedConversation?.contact?.phone) {
      return cachedConversation.contact.phone;
    }

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
  }, [conversations]);

  // Listen for inbound messages globally
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('global-inbound-messages')
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
            direction: string;
          };

          // Only notify for messages belonging to this user
          if (message.user_id !== user.id) return;

          // Get contact name
          const contactName = await getContactName(message.conversation_id);
          
          // Truncate message for preview
          const messagePreview = message.content?.length > 50 
            ? message.content.substring(0, 50) + '...' 
            : message.content || 'Nova mensagem';
          
          // Send browser notification
          notifyNewMessage(contactName, messagePreview);

          // Invalidate queries to update UI
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          queryClient.invalidateQueries({ queryKey: ['messages', message.conversation_id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, getContactName, notifyNewMessage, queryClient]);

  return <>{children}</>;
};
