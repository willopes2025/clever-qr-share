import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface UserPerformanceItem {
  user_id: string;
  name: string;
  ranking: number;
  overall_score: number;
  textual_quality_score: number;
  communication_score: number;
  sales_score: number;
  efficiency_score: number;
  audio_analysis_score: number;
  messages_sent: number;
  messages_received: number;
  conversations_handled: number;
  avg_first_response_seconds: number;
  strengths: string[];
  improvements: string[];
  coaching_tips: string[];
  highlighted_message?: string;
}

export interface FunnelBottleneckStage {
  stage_id: string;
  name: string;
  conversion_rate: number;
  avg_hours: number;
  lost_count: number;
  note?: string;
}

export interface FunnelInsight {
  funnel_id: string;
  name: string;
  total_deals: number;
  won_count: number;
  lost_count: number;
  won_rate: number;
  avg_days_to_close: number;
  bottleneck_stages: FunnelBottleneckStage[];
  suggestions: string[];
}

export interface CampaignInsight {
  campaign_id: string;
  name: string;
  sent: number;
  delivered: number;
  failed: number;
  reply_rate: number;
  best_hours: number[];
  template_performance: Array<{
    template_id?: string;
    name: string;
    reply_rate: number;
    suggestion?: string;
  }>;
  suggestions: string[];
}

export interface SLAUserItem {
  user_id: string;
  name: string;
  avg_first_response_seconds: number;
  unanswered_count: number;
  overdue_tasks_count: number;
}

export interface AnalysisReport {
  id: string;
  user_id: string;
  created_at: string;
  period_start: string;
  period_end: string;
  overall_score: number;
  textual_quality_score: number;
  communication_score: number;
  sales_score: number;
  efficiency_score: number;
  audio_analysis_score: number;
  total_conversations: number;
  total_messages_sent: number;
  total_messages_received: number;
  total_audios_analyzed: number;
  executive_summary: string;
  strengths: Array<{ title: string; description: string; example: string }>;
  improvements: Array<{ title: string; description: string; suggestion: string; example: string }>;
  recommendations: string[];
  highlighted_examples: Array<{ type: 'positive' | 'negative'; context: string; message: string; reason: string }>;
  conversation_details: Array<{ contact: string; score: number; summary: string; feedback: string }>;
  status: 'processing' | 'completed' | 'error';
  error_message: string | null;
  user_performance: UserPerformanceItem[];
  funnel_performance: { funnels?: FunnelInsight[] };
  campaign_performance: { campaigns?: CampaignInsight[] };
  sla_performance: {
    avg_first_response_seconds?: number;
    unanswered_count?: number;
    overdue_tasks_count?: number;
    by_user?: SLAUserItem[];
    summary?: string;
  };
  analysis_scope: {
    user_ids?: string[];
    funnel_ids?: string[];
    include_campaigns?: boolean;
    include_sla?: boolean;
  };
}

export function useAnalysisReports() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: reports, isLoading, refetch } = useQuery({
    queryKey: ['analysis-reports', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('conversation_analysis_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((report: any) => ({
        ...report,
        strengths: Array.isArray(report.strengths) ? report.strengths : [],
        improvements: Array.isArray(report.improvements) ? report.improvements : [],
        recommendations: Array.isArray(report.recommendations) ? report.recommendations : [],
        highlighted_examples: Array.isArray(report.highlighted_examples) ? report.highlighted_examples : [],
        conversation_details: Array.isArray(report.conversation_details) ? report.conversation_details : [],
        user_performance: Array.isArray(report.user_performance) ? report.user_performance : [],
        funnel_performance: (report.funnel_performance && typeof report.funnel_performance === 'object') ? report.funnel_performance : {},
        campaign_performance: (report.campaign_performance && typeof report.campaign_performance === 'object') ? report.campaign_performance : {},
        sla_performance: (report.sla_performance && typeof report.sla_performance === 'object') ? report.sla_performance : {},
        analysis_scope: (report.analysis_scope && typeof report.analysis_scope === 'object') ? report.analysis_scope : {},
      })) as AnalysisReport[];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    const processingReports = reports?.filter(r => r.status === 'processing');
    if (!processingReports?.length) return;

    const interval = setInterval(() => {
      refetch();
    }, 15000);

    return () => clearInterval(interval);
  }, [reports, refetch]);

  interface GenerateOptions {
    periodStart: string;
    periodEnd: string;
    transcribeAudios?: boolean;
    tzOffsetMinutes?: number;
    userIds?: string[];
    funnelIds?: string[];
    includeCampaigns?: boolean;
    includeSla?: boolean;
  }

  const generateReport = useCallback(async (opts: GenerateOptions) => {
    if (!user?.id) {
      toast.error('Você precisa estar logado para gerar relatórios');
      return null;
    }

    setIsGenerating(true);

    try {
      const response = await supabase.functions.invoke('analyze-conversations', {
        body: {
          periodStart: opts.periodStart,
          periodEnd: opts.periodEnd,
          transcribeAudios: opts.transcribeAudios ?? true,
          tzOffsetMinutes: opts.tzOffsetMinutes,
          userIds: opts.userIds ?? [],
          funnelIds: opts.funnelIds ?? [],
          includeCampaigns: opts.includeCampaigns ?? true,
          includeSla: opts.includeSla ?? true,
        },
      });

      if (response.error) throw response.error;

      const { reportId, success, error } = response.data;
      if (!success) throw new Error(error || 'Erro ao gerar relatório');

      toast.success('Relatório gerado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['analysis-reports'] });

      return reportId;
    } catch (error: any) {
      console.error('Error generating report:', error);
      const isTimeoutError = /failed to fetch|connection|timeout|aborted|failed to send/i.test(error.message || '');

      if (isTimeoutError) {
        toast.info('A análise está sendo processada em segundo plano. A página será atualizada automaticamente.', {
          duration: 8000,
        });
      } else {
        toast.error(error.message || 'Erro ao gerar relatório');
      }

      queryClient.invalidateQueries({ queryKey: ['analysis-reports'] });
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [user?.id, queryClient]);

  const deleteReport = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from('conversation_analysis_reports')
        .delete()
        .eq('id', reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Relatório excluído');
      queryClient.invalidateQueries({ queryKey: ['analysis-reports'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir relatório: ' + error.message);
    },
  });

  return {
    reports,
    isLoading,
    isGenerating,
    generateReport,
    deleteReport,
    refetch,
  };
}
