import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

export interface CreateApiKeyResponse {
  key: string;
  prefix: string;
  id: string;
  name: string;
  created_at: string;
  expires_at: string | null;
}

function getKeyStatus(key: ApiKey): "active" | "expired" | "revoked" {
  if (key.revoked_at) return "revoked";
  if (key.expires_at && new Date(key.expires_at) <= new Date()) return "expired";
  return "active";
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "nunca";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

export function useApiKeys() {
  const queryClient = useQueryClient();

  const keysQuery = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-create-api-key", {
        method: "GET",
      });
      if (error) throw error;
      return (data?.data ?? []) as ApiKey[];
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const createMutation = useMutation({
    mutationFn: async (params: { name: string; expires_at?: string | null }) => {
      const { data, error } = await supabase.functions.invoke("admin-create-api-key", {
        body: { name: params.name, expires_at: params.expires_at ?? null },
      });
      if (error) throw error;
      return data as CreateApiKeyResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { data, error } = await supabase.functions.invoke("admin-create-api-key", {
        body: { key_id: keyId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async (params: { keyId: string; name: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-create-api-key", {
        body: { key_id: params.keyId, name: params.name },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { data, error } = await supabase.functions.invoke("admin-create-api-key", {
        method: "DELETE",
        body: { key_id: keyId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const keys = (keysQuery.data ?? []).map((k) => ({
    ...k,
    status: getKeyStatus(k),
    lastUsedFormatted: formatRelativeTime(k.last_used_at),
    createdFormatted: new Date(k.created_at).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  return {
    keys,
    isLoading: keysQuery.isLoading,
    error: keysQuery.error,
    createKey: createMutation,
    revokeKey: revokeMutation,
    renameKey: renameMutation,
    deleteKey: deleteMutation,
  };
}
