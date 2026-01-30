import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

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
      
      // Type cast the data properly
      return (data || []).map(report => ({
        ...report,
        strengths: Array.isArray(report.strengths) ? report.strengths : [],
        improvements: Array.isArray(report.improvements) ? report.improvements : [],
        recommendations: Array.isArray(report.recommendations) ? report.recommendations : [],
        highlighted_examples: Array.isArray(report.highlighted_examples) ? report.highlighted_examples : [],
        conversation_details: Array.isArray(report.conversation_details) ? report.conversation_details : [],
      })) as AnalysisReport[];
    },
    enabled: !!user?.id,
  });

  // Polling automático para relatórios em processamento
  useEffect(() => {
    const processingReports = reports?.filter(r => r.status === 'processing');
    if (!processingReports?.length) return;
    
    const interval = setInterval(() => {
      refetch();
    }, 15000); // 15 segundos
    
    return () => clearInterval(interval);
  }, [reports, refetch]);

  const generateReport = useCallback(async (periodStart: string, periodEnd: string, transcribeAudios = true, tzOffsetMinutes?: number) => {
    if (!user?.id) {
      toast.error('Você precisa estar logado para gerar relatórios');
      return null;
    }

    setIsGenerating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Sessão não encontrada');
      }

      const response = await supabase.functions.invoke('analyze-conversations', {
        body: { periodStart, periodEnd, transcribeAudios, tzOffsetMinutes },
      });

      if (response.error) {
        throw response.error;
      }

      const { reportId, success, error } = response.data;

      if (!success) {
        throw new Error(error || 'Erro ao gerar relatório');
      }

      toast.success('Relatório gerado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['analysis-reports'] });
      
      return reportId;
    } catch (error: any) {
      console.error('Error generating report:', error);
      
      const isTimeoutError = /failed to fetch|connection|timeout|aborted|failed to send/i.test(
        error.message || ''
      );
      
      if (isTimeoutError) {
        toast.info('A análise está sendo processada em segundo plano. A página será atualizada automaticamente.', {
          duration: 8000,
        });
      } else {
        toast.error(error.message || 'Erro ao gerar relatório');
      }
      
      // Sempre invalidar cache - relatório pode ter sido criado mesmo com erro
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
