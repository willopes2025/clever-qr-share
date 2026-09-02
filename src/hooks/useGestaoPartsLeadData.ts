import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { callGestaoParts } from "./useGestaoParts";

export interface GestaoPartsLeadData {
  id: string;
  contact_id: string;
  deal_id: string | null;
  lookup_phone: string | null;
  lookup_document: string | null;
  erp_codigo: string | null;
  erp_nome: string | null;
  pessoa: Record<string, unknown> | null;
  pedidos: Array<Record<string, unknown>>;
  financeiro: Array<Record<string, unknown>>;
  credito: Record<string, unknown> | null;
  pedidos_count: number;
  pedidos_total: number;
  last_synced_at: string;
  parcial?: boolean;
}

/** Snapshot do ERP salvo no cartão do lead (leitura local, sem chamar o ERP) */
export const useGestaoPartsLeadData = (contactId?: string) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["gestao-parts-lead-data", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gestao_parts_lead_data")
        .select("*")
        .eq("contact_id", contactId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as GestaoPartsLeadData) ?? null;
    },
    enabled: !!contactId,
    staleTime: 60_000,
  });

  const sync = useMutation({
    mutationFn: async (vars: { telefone?: string; documento?: string; dealId?: string | null; dias?: number }) => {
      return callGestaoParts<GestaoPartsLeadData>("lead_sync", {
        contact_id: contactId,
        deal_id: vars.dealId ?? null,
        telefone: vars.telefone || "",
        documento: vars.documento || "",
        ...(vars.dias ? { dias: vars.dias } : {}),
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["gestao-parts-lead-data", contactId], data);
      queryClient.invalidateQueries({ queryKey: ["gestao-parts-lead-data", contactId] });
      const count = data?.pedidos_count ?? 0;
      if (data?.parcial) {
        toast.warning(`Resultado parcial do ERP: ${count} pedido(s). Tente novamente para completar.`);
        return;
      }
      toast.success(count > 0 ? `${count} pedido(s) encontrados no ERP` : "Consulta concluída: nenhum pedido encontrado");
    },

    onError: (error: Error) => {
      toast.error("Erro ao consultar ERP: " + error.message);
    },
  });

  return { data: query.data ?? null, isLoading: query.isLoading, sync };
};
