import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface UserSettings {
  id: string;
  user_id: string;
  message_interval_min: number;
  message_interval_max: number;
  daily_limit: number;
  allowed_start_hour: number;
  allowed_end_hour: number;
  allowed_days: string[];
  stop_on_error: boolean;
  notify_on_complete: boolean;
  auto_retry: boolean;
  max_retries: number;
  email_notifications: boolean;
  timezone: string;
  created_at: string;
  updated_at: string;
}

const defaultSettings: Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  message_interval_min: 3,
  message_interval_max: 10,
  daily_limit: 1000,
  allowed_start_hour: 8,
  allowed_end_hour: 20,
  allowed_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  stop_on_error: false,
  notify_on_complete: true,
  auto_retry: true,
  max_retries: 3,
  email_notifications: true,
  timezone: 'America/Sao_Paulo',
};

export const useUserSettings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["user-settings", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      // Return existing settings or default values
      if (data) return data as UserSettings;
      
      return {
        ...defaultSettings,
        user_id: user.id,
      } as Partial<UserSettings>;
    },
    enabled: !!user?.id,
  });

  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<UserSettings>) => {
      if (!user?.id) throw new Error("User not authenticated");

      // Check if settings exist
      const { data: existing } = await supabase
        .from("user_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from("user_settings")
          .update(newSettings)
          .eq("user_id", user.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from("user_settings")
          .insert({
            user_id: user.id,
            ...defaultSettings,
            ...newSettings,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-settings"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error) => {
      console.error("Error updating settings:", error);
      toast.error("Erro ao salvar configurações");
    },
  });

  return {
    settings,
    isLoading,
    updateSettings,
    defaultSettings,
  };
};
