import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Json } from "@/integrations/supabase/types";

export interface WidgetConfig {
  id: string;
  widget_key: string;
  size: 'small' | 'medium' | 'large';
  position: number;
}

export interface AvailableWidget {
  id: string;
  widget_key: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  size_options: string[];
  default_size: string;
  admin_only: boolean;
  member_only: boolean;
  display_order: number;
  widget_type: 'kpi' | 'bar_chart' | 'pie_chart' | 'area_chart' | 'progress';
}

export interface DashboardConfig {
  id: string;
  user_id: string;
  config_type: string;
  name: string;
  widgets: WidgetConfig[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const useDashboardConfig = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [availableWidgets, setAvailableWidgets] = useState<AvailableWidget[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAvailableWidgets = useCallback(async () => {
    const { data, error } = await supabase
      .from('available_widgets')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) {
      console.error('Error fetching widgets:', error);
      return;
    }

    // Cast widget_type to the expected union type
    const widgets = (data || []).map(w => ({
      ...w,
      widget_type: (w.widget_type || 'kpi') as 'kpi' | 'bar_chart' | 'pie_chart' | 'area_chart' | 'progress'
    }));
    setAvailableWidgets(widgets);
  }, []);

  const fetchConfig = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('dashboard_configs')
      .select('*')
      .eq('user_id', user.id)
      .eq('config_type', 'personal')
      .maybeSingle();

    if (error) {
      console.error('Error fetching config:', error);
      setLoading(false);
      return;
    }

    if (data) {
      const rawWidgets = data.widgets;
      const widgets = Array.isArray(rawWidgets) 
        ? (rawWidgets as unknown as WidgetConfig[]) 
        : [];
      setConfig({
        ...data,
        widgets
      });
    } else {
      setConfig(null);
    }

    setLoading(false);
  }, [user?.id]);

  const saveConfig = useCallback(async (widgets: WidgetConfig[]) => {
    if (!user?.id) return;

    const widgetsJson = widgets as unknown as Json;

    if (config?.id) {
      const { error } = await supabase
        .from('dashboard_configs')
        .update({ widgets: widgetsJson, updated_at: new Date().toISOString() })
        .eq('id', config.id);

      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        return false;
      }
    } else {
      const { data, error } = await supabase
        .from('dashboard_configs')
        .insert({
          user_id: user.id,
          config_type: 'personal',
          name: 'Meu Dashboard',
          widgets: widgetsJson,
          is_default: true
        })
        .select()
        .single();

      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        return false;
      }

      if (data) {
        setConfig({ ...data, widgets });
      }
    }

    toast({ title: "Dashboard salvo", description: "Suas configurações foram atualizadas" });
    return true;
  }, [user?.id, config?.id, toast]);

  const addWidgets = useCallback(async (widgets: AvailableWidget[]) => {
    const currentWidgets = config?.widgets || [];
    const newWidgetConfigs: WidgetConfig[] = widgets.map((widget, index) => ({
      id: crypto.randomUUID(),
      widget_key: widget.widget_key,
      size: widget.default_size as 'small' | 'medium' | 'large',
      position: currentWidgets.length + index
    }));

    const allWidgets = [...currentWidgets, ...newWidgetConfigs];
    await saveConfig(allWidgets);
    setConfig(prev => prev ? { ...prev, widgets: allWidgets } : null);
  }, [config, saveConfig]);

  const removeWidget = useCallback(async (widgetId: string) => {
    const newWidgets = (config?.widgets || []).filter(w => w.id !== widgetId);
    await saveConfig(newWidgets);
    setConfig(prev => prev ? { ...prev, widgets: newWidgets } : null);
  }, [config, saveConfig]);

  const updateWidgetSize = useCallback(async (widgetId: string, size: 'small' | 'medium' | 'large') => {
    const newWidgets = (config?.widgets || []).map(w => 
      w.id === widgetId ? { ...w, size } : w
    );
    await saveConfig(newWidgets);
    setConfig(prev => prev ? { ...prev, widgets: newWidgets } : null);
  }, [config, saveConfig]);

  const resetDashboard = useCallback(async () => {
    await saveConfig([]);
    setConfig(prev => prev ? { ...prev, widgets: [] } : null);
  }, [saveConfig]);

  useEffect(() => {
    fetchAvailableWidgets();
    fetchConfig();
  }, [fetchAvailableWidgets, fetchConfig]);

  return {
    config,
    availableWidgets,
    loading,
    addWidgets,
    removeWidget,
    updateWidgetSize,
    resetDashboard,
    refetch: fetchConfig
  };
};

export const groupWidgetsByCategory = (widgets: AvailableWidget[]) => {
  const categories: Record<string, AvailableWidget[]> = {};
  widgets.forEach(widget => {
    if (!categories[widget.category]) categories[widget.category] = [];
    categories[widget.category].push(widget);
  });
  return categories;
};

export const categoryLabels: Record<string, string> = {
  performance: '📊 Performance Home Office',
  atendimento: '💬 Mensagens e Atendimento',
  vendas: '💰 Vendas e Funil',
  leads: '👥 Leads',
  whatsapp: '📱 WhatsApp',
  automacao: '🤖 Automação',
  financeiro: '💵 Financeiro',
  tarefas: '✅ Tarefas',
  alertas: '🚨 Alertas',
  equipe: '👔 Equipe'
};
