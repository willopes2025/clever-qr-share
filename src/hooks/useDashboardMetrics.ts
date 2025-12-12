import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export interface DashboardMetrics {
  instances: {
    total: number;
    connected: number;
    disconnected: number;
  };
  contacts: {
    total: number;
    active: number;
    optedOut: number;
  };
  campaigns: {
    total: number;
    draft: number;
    scheduled: number;
    sending: number;
    completed: number;
    failed: number;
  };
  messages: {
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    pending: number;
  };
  deliveryRate: number;
}

export interface RecentActivity {
  id: string;
  type: 'campaign_started' | 'campaign_completed' | 'instance_connected' | 'contact_added';
  title: string;
  description: string;
  timestamp: string;
}

export interface CampaignChartData {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
}

export const useDashboardMetrics = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Fetch all data in parallel
      const [
        instancesResult,
        contactsResult,
        campaignsResult,
        messagesResult
      ] = await Promise.all([
        supabase.from('whatsapp_instances').select('status').eq('user_id', user.id),
        supabase.from('contacts').select('status, opted_out').eq('user_id', user.id),
        supabase.from('campaigns').select('status, sent, delivered, failed').eq('user_id', user.id),
        supabase.from('campaign_messages').select('status, campaign_id').eq('status', 'sent')
      ]);

      // Process instances
      const instances = instancesResult.data || [];
      const instanceMetrics = {
        total: instances.length,
        connected: instances.filter(i => i.status === 'connected').length,
        disconnected: instances.filter(i => i.status !== 'connected').length,
      };

      // Process contacts
      const contacts = contactsResult.data || [];
      const contactMetrics = {
        total: contacts.length,
        active: contacts.filter(c => c.status === 'active' && !c.opted_out).length,
        optedOut: contacts.filter(c => c.opted_out).length,
      };

      // Process campaigns
      const campaigns = campaignsResult.data || [];
      const campaignMetrics = {
        total: campaigns.length,
        draft: campaigns.filter(c => c.status === 'draft').length,
        scheduled: campaigns.filter(c => c.status === 'scheduled').length,
        sending: campaigns.filter(c => c.status === 'sending').length,
        completed: campaigns.filter(c => c.status === 'completed').length,
        failed: campaigns.filter(c => c.status === 'failed').length,
      };

      // Process messages
      const totalSent = campaigns.reduce((acc, c) => acc + (c.sent || 0), 0);
      const totalDelivered = campaigns.reduce((acc, c) => acc + (c.delivered || 0), 0);
      const totalFailed = campaigns.reduce((acc, c) => acc + (c.failed || 0), 0);
      
      const messageMetrics = {
        total: totalSent + totalDelivered + totalFailed,
        sent: totalSent,
        delivered: totalDelivered,
        failed: totalFailed,
        pending: 0,
      };

      // Calculate delivery rate
      const totalMessages = totalSent + totalDelivered + totalFailed;
      const deliveryRate = totalMessages > 0 ? (totalDelivered / totalMessages) * 100 : 0;

      return {
        instances: instanceMetrics,
        contacts: contactMetrics,
        campaigns: campaignMetrics,
        messages: messageMetrics,
        deliveryRate,
      } as DashboardMetrics;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Set up real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => {
        refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_messages' }, () => {
        refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_instances' }, () => {
        refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  useEffect(() => {
    if (data) {
      setMetrics(data);
    }
  }, [data]);

  return { metrics, isLoading, refetch };
};

export const useRecentCampaigns = () => {
  return useQuery({
    queryKey: ['recent-campaigns'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          id,
          name,
          status,
          started_at,
          completed_at,
          scheduled_at,
          sent,
          delivered,
          failed,
          total_contacts
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });
};

export const useScheduledCampaigns = () => {
  return useQuery({
    queryKey: ['scheduled-campaigns'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          id,
          name,
          scheduled_at,
          total_contacts,
          list_id,
          broadcast_lists(name)
        `)
        .eq('user_id', user.id)
        .eq('status', 'scheduled')
        .not('scheduled_at', 'is', null)
        .order('scheduled_at', { ascending: true })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });
};

export const useCampaignChartData = () => {
  return useQuery({
    queryKey: ['campaign-chart-data'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get campaigns from last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('campaigns')
        .select('started_at, sent, delivered, failed')
        .eq('user_id', user.id)
        .gte('started_at', sevenDaysAgo.toISOString())
        .not('started_at', 'is', null);

      if (error) throw error;

      // Group by date
      const chartData: { [key: string]: CampaignChartData } = {};
      
      // Initialize last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
        chartData[dateStr] = { date: dateStr, sent: 0, delivered: 0, failed: 0 };
      }

      // Aggregate data
      (data || []).forEach(campaign => {
        if (campaign.started_at) {
          const date = new Date(campaign.started_at);
          const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
          if (chartData[dateStr]) {
            chartData[dateStr].sent += campaign.sent || 0;
            chartData[dateStr].delivered += campaign.delivered || 0;
            chartData[dateStr].failed += campaign.failed || 0;
          }
        }
      });

      return Object.values(chartData);
    },
    refetchInterval: 60000,
  });
};
