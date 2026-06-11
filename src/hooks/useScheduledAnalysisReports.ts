import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

export type ScheduledFrequency = "daily" | "weekly" | "biweekly" | "monthly";

export interface ScheduledAnalysisReport {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  frequency: ScheduledFrequency;
  send_time: string; // HH:MM:SS
  recipient_user_ids: string[];
  include_campaigns: boolean;
  include_sla: boolean;
  transcribe_audios: boolean;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduleInput {
  name: string;
  frequency: ScheduledFrequency;
  send_time: string;
  recipient_user_ids: string[];
  include_campaigns: boolean;
  include_sla: boolean;
  transcribe_audios: boolean;
  is_active: boolean;
}

function computeNextRunAt(frequency: ScheduledFrequency, sendTime: string): string {
  const days = frequency === "daily" ? 1 : frequency === "weekly" ? 7 : frequency === "biweekly" ? 15 : 30;
  const [hh, mm] = sendTime.split(":").map((n) => parseInt(n, 10));
  // First run = today at send_time in local tz; if past, push by `days`.
  const now = new Date();
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + days);
  }
  return target.toISOString();
}

export function useScheduledAnalysisReports() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["scheduled-analysis-reports", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from("scheduled_analysis_reports" as any)
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ScheduledAnalysisReport[];
    },
    enabled: !!organization?.id,
  });

  const create = useMutation({
    mutationFn: async (input: ScheduleInput) => {
      if (!user?.id || !organization?.id) throw new Error("Sem organização");
      const next_run_at = computeNextRunAt(input.frequency, input.send_time);
      const { data, error } = await supabase
        .from("scheduled_analysis_reports" as any)
        .insert({
          organization_id: organization.id,
          user_id: user.id,
          ...input,
          next_run_at,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-analysis-reports"] });
      toast.success("Agendamento criado");
    },
    onError: (e: any) => toast.error("Erro ao criar agendamento: " + e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<ScheduleInput> }) => {
      const patch: any = { ...input };
      if (input.frequency && input.send_time) {
        patch.next_run_at = computeNextRunAt(input.frequency, input.send_time);
      }
      const { error } = await supabase
        .from("scheduled_analysis_reports" as any)
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-analysis-reports"] });
      toast.success("Agendamento atualizado");
    },
    onError: (e: any) => toast.error("Erro ao atualizar: " + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("scheduled_analysis_reports" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-analysis-reports"] });
      toast.success("Agendamento removido");
    },
    onError: (e: any) => toast.error("Erro ao remover: " + e.message),
  });

  const runNow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke("send-scheduled-analysis", {
        body: { schedule_id: id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Envio iniciado. O PDF será entregue em alguns minutos.");
      qc.invalidateQueries({ queryKey: ["scheduled-analysis-reports"] });
    },
    onError: (e: any) => toast.error("Erro ao disparar: " + e.message),
  });

  return {
    schedules: list.data || [],
    isLoading: list.isLoading,
    create,
    update,
    remove,
    runNow,
  };
}
