import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BuyerReportObjective {
  id: string;
  organization_id: string;
  funnel_id: string;
  created_by: string;
  name: string;
  description: string | null;
  prompt: string;
  stage_ids: string[];
  min_score: number;
  max_leads: number;
  lookback_days: number;
  schedule_time: string;
  schedule_days: number[];
  enabled: boolean;
  manager_user_ids: string[];
  send_to_assignee_whatsapp: boolean;
  whatsapp_instance_id: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuyerReportRun {
  id: string;
  objective_id: string;
  organization_id: string;
  triggered_by: string | null;
  executed_at: string;
  leads_count: number;
  pdf_storage_path: string | null;
  email_status: string | null;
  whatsapp_status: string | null;
  payload: any;
  error: string | null;
  created_at: string;
}

export function useBuyerReportObjectives() {
  const qc = useQueryClient();

  const { data: objectives = [], isLoading } = useQuery({
    queryKey: ['buyer-report-objectives'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('buyer_report_objectives' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as BuyerReportObjective[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<BuyerReportObjective> & { organization_id: string }) => {
      const isUpdate = !!input.id;
      const payload = { ...input };
      if (!isUpdate) {
        const { data: u } = await supabase.auth.getUser();
        (payload as any).created_by = u.user?.id;
      }
      const { data, error } = isUpdate
        ? await supabase.from('buyer_report_objectives' as any).update(payload).eq('id', input.id!).select().maybeSingle()
        : await supabase.from('buyer_report_objectives' as any).insert(payload).select().maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['buyer-report-objectives'] });
      toast.success('Objetivo salvo');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('buyer_report_objectives' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['buyer-report-objectives'] });
      toast.success('Objetivo removido');
    },
    onError: (e: any) => toast.error(e.message || 'Erro'),
  });

  const generatePreview = useMutation({
    mutationFn: async (objectiveId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-buyer-report', {
        body: { objective_id: objectiveId },
      });
      if (error) throw error;
      if (data?.pdf_url) window.open(data.pdf_url, '_blank');
      return data;
    },
    onSuccess: (d: any) => toast.success(`Relatório gerado: ${d.leads_count} leads quentes`),
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar'),
  });

  const runNow = useMutation({
    mutationFn: async (objectiveId: string) => {
      const { data, error } = await supabase.functions.invoke('dispatch-buyer-reports', {
        body: { objective_id: objectiveId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Disparo iniciado — vai chegar nos destinatários em alguns minutos');
      qc.invalidateQueries({ queryKey: ['buyer-report-runs'] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro'),
  });

  return { objectives, isLoading, upsert, remove, generatePreview, runNow };
}

export function useBuyerReportRuns(objectiveId?: string) {
  return useQuery({
    queryKey: ['buyer-report-runs', objectiveId],
    queryFn: async () => {
      let q = supabase.from('buyer_report_runs' as any).select('*').order('executed_at', { ascending: false }).limit(50);
      if (objectiveId) q = q.eq('objective_id', objectiveId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as BuyerReportRun[];
    },
  });
}

export async function downloadBuyerReport(path: string) {
  const { data, error } = await supabase.storage.from('buyer-reports').createSignedUrl(path, 60 * 60);
  if (error) {
    toast.error('Não foi possível gerar o link');
    return;
  }
  window.open(data.signedUrl, '_blank');
}
