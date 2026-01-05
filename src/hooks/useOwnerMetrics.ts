import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

interface PlanRevenue {
  plan_name: string;
  revenue: number;
  count: number;
  percentage: number;
}

interface MonthlyData {
  month: string;
  value: number;
}

interface SignupData {
  date: string;
  count: number;
}

export interface OwnerMetrics {
  // Financeiro
  mrr: number;
  arr: number;
  arpu: number;
  revenueByPlan: PlanRevenue[];
  mrrHistory: MonthlyData[];
  
  // Usuarios
  totalUsers: number;
  payingUsers: number;
  freeUsers: number;
  conversionRate: number;
  signupsByDay: SignupData[];
  signupsByMonth: MonthlyData[];
  churnRate: number;
  newUsersThisMonth: number;
  
  // Operacional
  totalInstances: number;
  connectedInstances: number;
  totalContacts: number;
  totalConversations: number;
  activeCampaigns: number;
  activeAutomations: number;
  messagesSentToday: number;
}

export const useOwnerMetrics = () => {
  const [metrics, setMetrics] = useState<OwnerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [
        subscriptionsResult,
        profilesResult,
        instancesResult,
        contactsResult,
        conversationsResult,
        campaignsResult,
        automationsResult,
        subscriptionHistoryResult,
      ] = await Promise.all([
        supabase.from('subscriptions').select('*'),
        supabase.from('profiles').select('id, created_at'),
        supabase.from('whatsapp_instances').select('id, status'),
        supabase.from('contacts').select('id', { count: 'exact', head: true }),
        supabase.from('conversations').select('id', { count: 'exact', head: true }),
        supabase.from('campaigns').select('id, status'),
        supabase.from('funnel_automations').select('id, is_active'),
        supabase.from('subscription_history').select('*').order('created_at', { ascending: true }),
      ]);

      const subscriptions = subscriptionsResult.data || [];
      const profiles = profilesResult.data || [];
      const instances = instancesResult.data || [];
      const contactsCount = contactsResult.count || 0;
      const conversationsCount = conversationsResult.count || 0;
      const campaigns = campaignsResult.data || [];
      const automations = automationsResult.data || [];
      const subscriptionHistory = subscriptionHistoryResult.data || [];

      // Calculate financial metrics
      const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
      const payingSubscriptions = activeSubscriptions.filter(s => 
        s.plan && !s.plan.toLowerCase().includes('free') && !s.plan.toLowerCase().includes('trial')
      );

      // Plan prices mapping (based on your data)
      const planPrices: Record<string, number> = {
        'Avançado': 797,
        'Business': 597,
        'Starter': 297,
        'Free': 0,
        'Trial': 0,
      };

      // Calculate MRR
      let mrr = 0;
      const revenueByPlanMap: Record<string, { revenue: number; count: number }> = {};

      payingSubscriptions.forEach(sub => {
        const planName = sub.plan || 'Unknown';
        const price = planPrices[planName] || 0;
        mrr += price;

        if (!revenueByPlanMap[planName]) {
          revenueByPlanMap[planName] = { revenue: 0, count: 0 };
        }
        revenueByPlanMap[planName].revenue += price;
        revenueByPlanMap[planName].count += 1;
      });

      const revenueByPlan: PlanRevenue[] = Object.entries(revenueByPlanMap).map(([plan_name, data]) => ({
        plan_name,
        revenue: data.revenue,
        count: data.count,
        percentage: mrr > 0 ? (data.revenue / mrr) * 100 : 0,
      })).sort((a, b) => b.revenue - a.revenue);

      // Add free users to the breakdown
      const freeCount = subscriptions.filter(s => 
        !s.plan || s.plan.toLowerCase().includes('free') || s.plan.toLowerCase().includes('trial')
      ).length;
      
      if (freeCount > 0) {
        revenueByPlan.push({
          plan_name: 'Free/Trial',
          revenue: 0,
          count: freeCount,
          percentage: 0,
        });
      }

      // Calculate user metrics
      const totalUsers = profiles.length;
      const payingUsers = payingSubscriptions.length;
      const freeUsers = totalUsers - payingUsers;
      const conversionRate = totalUsers > 0 ? (payingUsers / totalUsers) * 100 : 0;
      const arpu = payingUsers > 0 ? mrr / payingUsers : 0;
      const arr = mrr * 12;

      // Calculate signups by day (last 30 days)
      const thirtyDaysAgo = subMonths(new Date(), 1);
      const signupsByDayMap: Record<string, number> = {};
      
      profiles.forEach(profile => {
        const createdAt = new Date(profile.created_at);
        if (createdAt >= thirtyDaysAgo) {
          const dateKey = format(createdAt, 'yyyy-MM-dd');
          signupsByDayMap[dateKey] = (signupsByDayMap[dateKey] || 0) + 1;
        }
      });

      const signupsByDay: SignupData[] = Object.entries(signupsByDayMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculate signups by month (last 12 months)
      const signupsByMonthMap: Record<string, number> = {};
      
      for (let i = 11; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthKey = format(monthDate, 'yyyy-MM');
        signupsByMonthMap[monthKey] = 0;
      }

      profiles.forEach(profile => {
        const monthKey = format(new Date(profile.created_at), 'yyyy-MM');
        if (signupsByMonthMap.hasOwnProperty(monthKey)) {
          signupsByMonthMap[monthKey] += 1;
        }
      });

      const signupsByMonth: MonthlyData[] = Object.entries(signupsByMonthMap)
        .map(([month, value]) => ({ month, value }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // Calculate MRR history (last 12 months)
      const mrrHistory: MonthlyData[] = [];
      for (let i = 11; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthKey = format(monthDate, 'yyyy-MM');
        const monthEnd = endOfMonth(monthDate);

        // Count paying subscriptions created before end of month
        const monthMrr = payingSubscriptions.filter(sub => {
          const createdAt = new Date(sub.created_at);
          return createdAt <= monthEnd;
        }).reduce((sum, sub) => {
          const price = planPrices[sub.plan || ''] || 0;
          return sum + price;
        }, 0);

        mrrHistory.push({ month: monthKey, value: monthMrr });
      }

      // Calculate new users this month
      const currentMonthStart = startOfMonth(new Date());
      const newUsersThisMonth = profiles.filter(p => 
        new Date(p.created_at) >= currentMonthStart
      ).length;

      // Calculate churn rate (simplified - based on cancelled subscriptions this month)
      const cancelledThisMonth = subscriptionHistory.filter(h => {
        const eventDate = new Date(h.created_at || '');
        return eventDate >= currentMonthStart && h.action === 'cancelled';
      }).length;

      const startOfMonthActiveUsers = profiles.filter(p => 
        new Date(p.created_at) < currentMonthStart
      ).length;

      const churnRate = startOfMonthActiveUsers > 0 
        ? (cancelledThisMonth / startOfMonthActiveUsers) * 100 
        : 0;

      // Operational metrics
      const totalInstances = instances.length;
      const connectedInstances = instances.filter(i => i.status === 'connected').length;
      const activeCampaigns = campaigns.filter(c => c.status === 'running' || c.status === 'sending').length;
      const activeAutomations = automations.filter(a => a.is_active).length;

      setMetrics({
        mrr,
        arr,
        arpu,
        revenueByPlan,
        mrrHistory,
        totalUsers,
        payingUsers,
        freeUsers,
        conversionRate,
        signupsByDay,
        signupsByMonth,
        churnRate,
        newUsersThisMonth,
        totalInstances,
        connectedInstances,
        totalContacts: contactsCount,
        totalConversations: conversationsCount,
        activeCampaigns,
        activeAutomations,
        messagesSentToday: 0, // Would need messages table query
      });

    } catch (err) {
      console.error('Error fetching owner metrics:', err);
      setError('Erro ao carregar métricas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, loading, error, refetch: fetchMetrics };
};
