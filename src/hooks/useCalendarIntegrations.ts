import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/hooks/use-toast";

export interface CalendarIntegration {
  id: string;
  user_id: string;
  provider: string;
  user_uri: string | null;
  organization_uri: string | null;
  webhook_subscription_id: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendlyEventType {
  uri: string;
  name: string;
  duration: number;
  scheduling_url: string;
  active: boolean;
}

export interface CalendlyEvent {
  id: string;
  event_type: string;
  event_name: string | null;
  invitee_name: string | null;
  invitee_email: string | null;
  invitee_phone: string | null;
  event_start_time: string | null;
  event_end_time: string | null;
  location: string | null;
  cancel_reason: string | null;
  canceled_at: string | null;
  created_at: string;
}

export const useCalendarIntegrations = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch integration status
  const { data: integration, isLoading: isLoadingIntegration } = useQuery({
    queryKey: ["calendar-integration", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("calendar_integrations")
        .select("*")
        .eq("user_id", user.id)
        .eq("provider", "calendly")
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data as CalendarIntegration | null;
    },
    enabled: !!user?.id,
  });

  // Fetch recent events
  const { data: events, isLoading: isLoadingEvents } = useQuery({
    queryKey: ["calendly-events", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("calendly_events")
        .select("*")
        .eq("user_id", user.id)
        .order("event_start_time", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as CalendlyEvent[];
    },
    enabled: !!user?.id && !!integration,
  });

  // Connect Calendly
  const connectCalendly = useMutation({
    mutationFn: async (apiToken: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase.functions.invoke("calendly-integration", {
        body: { 
          action: "setup", 
          userId: user.id, 
          apiToken 
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Erro ao conectar Calendly");
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-integration"] });
      toast({
        title: "Calendly conectado",
        description: "Sua conta do Calendly foi conectada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao conectar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Register webhook
  const registerWebhook = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase.functions.invoke("calendly-integration", {
        body: { 
          action: "register-webhook", 
          userId: user.id,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Erro ao registrar webhook");
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-integration"] });
      toast({
        title: "Webhook registrado",
        description: "Você receberá notificações de novos agendamentos.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao registrar webhook",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Disconnect Calendly
  const disconnectCalendly = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase.functions.invoke("calendly-integration", {
        body: { 
          action: "disconnect", 
          userId: user.id,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Erro ao desconectar");
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-integration"] });
      queryClient.invalidateQueries({ queryKey: ["calendly-events"] });
      toast({
        title: "Calendly desconectado",
        description: "Sua integração foi removida.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao desconectar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch event types
  const fetchEventTypes = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase.functions.invoke("calendly-integration", {
        body: { 
          action: "list-event-types", 
          userId: user.id,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Erro ao buscar tipos de eventos");
      
      return data.eventTypes as CalendlyEventType[];
    },
  });

  // Check availability
  const checkAvailability = useMutation({
    mutationFn: async (date: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase.functions.invoke("calendly-integration", {
        body: { 
          action: "get-availability", 
          userId: user.id,
          date,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Erro ao verificar disponibilidade");
      
      return data;
    },
  });

  return {
    integration,
    isLoadingIntegration,
    events,
    isLoadingEvents,
    isConnected: !!integration?.is_active,
    connectCalendly,
    registerWebhook,
    disconnectCalendly,
    fetchEventTypes,
    checkAvailability,
  };
};
