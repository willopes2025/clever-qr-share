import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WebhookConfig {
  id: string;
  name: string;
  target_url: string | null;
  is_active: boolean;
  events: string[];
  last_sent_at: string | null;
  last_received_at: string | null;
  created_at: string;
}

export interface WebhookLogEntry {
  id: string;
  connection_id: string;
  direction: string;
  action: string | null;
  event_type: string | null;
  status: string;
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown> | null;
  response_status: number | null;
  error_message: string | null;
  signature: string | null;
  attempt: number;
  created_at: string;
}

export const WEBHOOK_EVENTS = [
  { value: "contact.created", label: "Contato criado" },
  { value: "contact.updated", label: "Contato atualizado" },
  { value: "contact.deleted", label: "Contato deletado" },
  { value: "lead.created", label: "Lead criado" },
  { value: "lead.updated", label: "Lead atualizado" },
  { value: "lead.stage_changed", label: "Lead mudou de estagio" },
  { value: "lead.deleted", label: "Lead deletado" },
] as const;

export function useWebhookConfig() {
  const queryClient = useQueryClient();

  const connectionsQuery = useQuery({
    queryKey: ["webhook-config"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-webhook-config");
      if (error) throw error;
      return (data?.data ?? []) as WebhookConfig[];
    },
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async (params: {
      name: string;
      target_url: string;
      events: string[];
    }) => {
      const { data, error } = await supabase.functions.invoke("admin-webhook-config", {
        body: params,
      });
      if (error) throw error;
      return data as WebhookConfig & { hmac_secret: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhook-config"] }),
  });

  const updateMutation = useMutation({
    mutationFn: async (params: {
      id: string;
      name?: string;
      target_url?: string;
      events?: string[];
      is_active?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("admin-webhook-config", {
        body: params,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhook-config"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("admin-webhook-config", {
        body: { id },
        method: "DELETE",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhook-config"] }),
  });

  const regenerateSecretMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("admin-webhook-config", {
        body: { id, action: "regenerate-secret" },
      });
      if (error) throw error;
      return data as { hmac_secret: string };
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("admin-webhook-config", {
        body: { id, action: "test" },
      });
      if (error) throw error;
      return data;
    },
  });

  return {
    connections: connectionsQuery.data ?? [],
    isLoading: connectionsQuery.isLoading,
    createConnection: createMutation,
    updateConnection: updateMutation,
    deleteConnection: deleteMutation,
    regenerateSecret: regenerateSecretMutation,
    testWebhook: testMutation,
  };
}

export function useWebhookLogs(connectionId?: string) {
  return useQuery({
    queryKey: ["webhook-logs", connectionId],
    queryFn: async () => {
      let query = supabase
        .from("webhook_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (connectionId) {
        query = query.eq("connection_id", connectionId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as WebhookLogEntry[];
    },
    refetchInterval: 30000,
  });
}
