import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOrganization } from './useOrganization';
import { format } from 'date-fns';

interface PerformanceMetrics {
  id: string;
  user_id: string;
  metric_date: string;
  total_work_seconds: number;
  total_break_seconds: number;
  total_lunch_seconds: number;
  messages_sent: number;
  messages_received: number;
  conversations_handled: number;
  conversations_resolved: number;
  deals_created: number;
  deals_won: number;
  deals_value: number;
  tasks_completed: number;
  avg_response_time_seconds: number | null;
  first_activity_at: string | null;
  last_activity_at: string | null;
}

export const usePerformanceMetrics = (userId?: string) => {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [todayMetrics, setTodayMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const targetUserId = userId || user?.id;

  const fetchTodayMetrics = useCallback(async () => {
    if (!targetUserId) return;

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('user_performance_metrics')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('metric_date', today)
        .maybeSingle();

      if (error) throw error;
      setTodayMetrics(data);
    } catch (err) {
      console.error('Error fetching metrics:', err);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  // Increment a metric
  const incrementMetric = useCallback(async (
    metric: keyof Pick<PerformanceMetrics, 
      'messages_sent' | 'messages_received' | 'conversations_handled' | 
      'conversations_resolved' | 'deals_created' | 'deals_won' | 'tasks_completed'
    >,
    value: number = 1
  ) => {
    if (!user) return;

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data: existing } = await supabase
        .from('user_performance_metrics')
        .select('*')
        .eq('user_id', user.id)
        .eq('metric_date', today)
        .maybeSingle();

      if (existing) {
        const currentValue = (existing[metric] as number) || 0;
        await supabase
          .from('user_performance_metrics')
          .update({ 
            [metric]: currentValue + value,
            last_activity_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('user_performance_metrics')
          .insert({
            user_id: user.id,
            organization_id: organization?.id || null,
            metric_date: today,
            [metric]: value,
            first_activity_at: new Date().toISOString(),
            last_activity_at: new Date().toISOString()
          });
      }

      // Refresh metrics
      fetchTodayMetrics();
    } catch (err) {
      console.error('Error incrementing metric:', err);
    }
  }, [user, organization, fetchTodayMetrics]);

  // Add deals value
  const addDealsValue = useCallback(async (value: number) => {
    if (!user) return;

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data: existing } = await supabase
        .from('user_performance_metrics')
        .select('*')
        .eq('user_id', user.id)
        .eq('metric_date', today)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('user_performance_metrics')
          .update({ 
            deals_value: Number(existing.deals_value || 0) + value,
            last_activity_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('user_performance_metrics')
          .insert({
            user_id: user.id,
            organization_id: organization?.id || null,
            metric_date: today,
            deals_value: value,
            first_activity_at: new Date().toISOString(),
            last_activity_at: new Date().toISOString()
          });
      }

      fetchTodayMetrics();
    } catch (err) {
      console.error('Error adding deals value:', err);
    }
  }, [user, organization, fetchTodayMetrics]);

  useEffect(() => {
    fetchTodayMetrics();
  }, [fetchTodayMetrics]);

  return {
    todayMetrics,
    loading,
    incrementMetric,
    addDealsValue,
    refetch: fetchTodayMetrics,
  };
};
