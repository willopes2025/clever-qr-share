import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface MetaTemplate {
  id: string;
  user_id: string;
  meta_template_id: string | null;
  waba_id: string | null;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  status: "draft" | "pending" | "approved" | "rejected" | "paused" | "disabled";
  rejection_reason: string | null;
  header_type: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION" | "NONE" | null;
  header_content: string | null;
  header_example: string | null;
  body_text: string;
  body_examples: string[];
  footer_text: string | null;
  buttons: Array<{
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
    text: string;
    url?: string;
    phone_number?: string;
  }>;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateData {
  name: string;
  language?: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  header_type?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION" | "NONE";
  header_content?: string;
  header_example?: string;
  body_text: string;
  body_examples?: string[];
  footer_text?: string;
  buttons?: Array<{
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

async function invokeTemplateManager(action: string, data?: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const response = await supabase.functions.invoke("meta-whatsapp-template-manager", {
    body: { action, ...data },
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  if (response.data?.error) {
    throw new Error(response.data.error);
  }

  return response.data;
}

export function useMetaTemplates() {
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading, refetch } = useQuery({
    queryKey: ["meta-templates"],
    queryFn: async () => {
      const result = await invokeTemplateManager("list");
      return (result.templates || []) as MetaTemplate[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ templateData, submitToMeta }: { templateData: CreateTemplateData; submitToMeta: boolean }) => {
      const action = submitToMeta ? "create" : "save_draft";
      return invokeTemplateManager(action, { templateData });
    },
    onSuccess: (_, { submitToMeta }) => {
      queryClient.invalidateQueries({ queryKey: ["meta-templates"] });
      toast.success(
        submitToMeta 
          ? "Template enviado para aprovação do Meta" 
          : "Rascunho salvo com sucesso"
      );
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return invokeTemplateManager("delete", { templateId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-templates"] });
      toast.success("Template excluído");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      return invokeTemplateManager("sync");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["meta-templates"] });
      toast.success(`Sincronizado: ${data.synced} templates (${data.updated} atualizados, ${data.added} adicionados)`);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao sincronizar: ${error.message}`);
    },
  });

  return {
    templates,
    isLoading,
    refetch,
    createTemplate: createMutation.mutate,
    isCreating: createMutation.isPending,
    deleteTemplate: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    syncTemplates: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
  };
}
