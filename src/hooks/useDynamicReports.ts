import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useOrganization } from "./useOrganization";
import { toast } from "sonner";

export type ReportSource = "contacts" | "deals" | "form_submissions" | "tags_stage";

export interface PeriodConfig {
  preset:
    | "today" | "yesterday" | "tomorrow"
    | "last_3d" | "last_7d" | "last_30d"
    | "next_7d" | "this_month" | "last_month"
    | "custom";
  custom_start?: string;
  custom_end?: string;
}

export interface FilterConfig {
  field_key?: string;
  form_id?: string;
  funnel_id?: string;
  stage_id?: string;
  tag_ids?: string[];
  deal_funnel_id?: string;
}

export interface ScheduleConfig {
  enabled: boolean;
  frequency?: "daily" | "weekly" | "monthly";
  hour?: number;
  minute?: number;
  weekdays?: number[];
  monthday?: number;
}

export interface DynamicReport {
  id: string;
  user_id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  source: ReportSource;
  filter_config: FilterConfig;
  period_config: PeriodConfig;
  columns: string[];
  schedule_config: ScheduleConfig;
  created_at: string;
  updated_at: string;
}

export interface Recipient {
  id: string;
  report_id: string;
  user_id: string;
  channels: ("bell" | "whatsapp")[];
}

export interface DynamicReportRun {
  id: string;
  report_id: string;
  triggered_by: string | null;
  executed_at: string;
  period_start: string | null;
  period_end: string | null;
  row_count: number;
  pdf_storage_path: string | null;
  status: "success" | "failed";
  error: string | null;
  delivery_log: any[];
}

export const useDynamicReports = () => {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const reportsQuery = useQuery({
    queryKey: ["dynamic-reports", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dynamic_reports" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DynamicReport[];
    },
    enabled: !!user?.id,
  });

  const runsQuery = useQuery({
    queryKey: ["dynamic-report-runs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dynamic_report_runs" as any)
        .select("*")
        .order("executed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as DynamicReportRun[];
    },
    enabled: !!user?.id,
  });

  const saveReport = useMutation({
    mutationFn: async (input: {
      id?: string;
      name: string;
      description?: string;
      source: ReportSource;
      filter_config: FilterConfig;
      period_config: PeriodConfig;
      columns: string[];
      schedule_config: ScheduleConfig;
      recipients: { user_id: string; channels: ("bell" | "whatsapp")[] }[];
    }) => {
      if (!user?.id) throw new Error("Não autenticado");
      const payload = {
        user_id: user.id,
        organization_id: organization?.id ?? null,
        name: input.name,
        description: input.description ?? null,
        source: input.source,
        filter_config: input.filter_config,
        period_config: input.period_config,
        columns: input.columns,
        schedule_config: input.schedule_config,
      };
      let reportId = input.id;
      if (reportId) {
        const { error } = await supabase.from("dynamic_reports" as any).update(payload).eq("id", reportId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("dynamic_reports" as any).insert(payload).select("id").single();
        if (error) throw error;
        reportId = (data as any).id;
      }
      // reset recipients
      await supabase.from("dynamic_report_recipients" as any).delete().eq("report_id", reportId!);
      if (input.recipients.length) {
        const { error: recErr } = await supabase.from("dynamic_report_recipients" as any).insert(
          input.recipients.map((r) => ({ report_id: reportId, user_id: r.user_id, channels: r.channels }))
        );
        if (recErr) throw recErr;
      }
      return reportId!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dynamic-reports"] });
      toast.success("Relatório salvo");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const deleteReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dynamic_reports" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dynamic-reports"] });
      toast.success("Relatório excluído");
    },
  });

  const previewReport = useMutation({
    mutationFn: async (input: {
      source: ReportSource;
      filter_config: FilterConfig;
      period_config: PeriodConfig;
      columns: string[];
      report_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("run-dynamic-report", {
        body: { mode: "preview", ...input },
      });
      if (error) throw error;
      return data as { row_count: number; preview: any[]; period: { start: string; end: string } };
    },
  });

  const runNow = useMutation({
    mutationFn: async (reportId: string) => {
      const { data, error } = await supabase.functions.invoke("run-dynamic-report", {
        body: { mode: "run", report_id: reportId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dynamic-report-runs"] });
      toast.success("Relatório gerado e enviado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao gerar relatório"),
  });

  const getReportRecipients = async (reportId: string): Promise<Recipient[]> => {
    const { data, error } = await supabase.from("dynamic_report_recipients" as any).select("*").eq("report_id", reportId);
    if (error) throw error;
    return (data ?? []) as unknown as Recipient[];
  };

  const getPdfUrl = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage.from("dynamic-reports").createSignedUrl(path, 60 * 60);
    if (error) return null;
    return data?.signedUrl ?? null;
  };

  return {
    reports: reportsQuery.data ?? [],
    runs: runsQuery.data ?? [],
    isLoading: reportsQuery.isLoading,
    saveReport,
    deleteReport,
    previewReport,
    runNow,
    getReportRecipients,
    getPdfUrl,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ["dynamic-reports"] });
      queryClient.invalidateQueries({ queryKey: ["dynamic-report-runs"] });
    },
  };
};
