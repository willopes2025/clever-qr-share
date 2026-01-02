import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContactActivity {
  id: string;
  contact_id: string;
  conversation_id: string | null;
  user_id: string | null;
  ai_agent_id: string | null;
  activity_type: string;
  description: string | null;
  metadata: Record<string, any>;
  created_at: string;
  user?: {
    full_name: string | null;
  } | null;
  ai_agent?: {
    agent_name: string;
  } | null;
}

export const useContactActivityLog = (contactId: string | null) => {
  return useQuery({
    queryKey: ['contact-activity-log', contactId],
    queryFn: async () => {
      if (!contactId) return [];

      const { data, error } = await supabase
        .from('contact_activity_log')
        .select(`
          *,
          user:profiles(full_name),
          ai_agent:ai_agent_configs(agent_name)
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as ContactActivity[];
    },
    enabled: !!contactId,
  });
};
