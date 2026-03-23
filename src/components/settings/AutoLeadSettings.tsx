import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Zap, GitBranch } from "lucide-react";

export const AutoLeadSettings = () => {
  const { user } = useAuth();
  const { settings, isLoading, updateSettings } = useUserSettings();

  const [autoCreate, setAutoCreate] = useState(false);
  const [funnelId, setFunnelId] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");

  // Fetch funnels
  const { data: funnels } = useQuery({
    queryKey: ["funnels-for-settings", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("funnels")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name");
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch stages for selected funnel
  const { data: stages } = useQuery({
    queryKey: ["funnel-stages-for-settings", funnelId],
    queryFn: async () => {
      if (!funnelId) return [];
      const { data } = await supabase
        .from("funnel_stages")
        .select("id, name")
        .eq("funnel_id", funnelId)
        .order("display_order");
      return data || [];
    },
    enabled: !!funnelId,
  });

  // Sync state from settings
  useEffect(() => {
    if (settings) {
      setAutoCreate((settings as any).auto_create_leads || false);
      setFunnelId((settings as any).auto_lead_funnel_id || "");
      setStageId((settings as any).auto_lead_stage_id || "");
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({
      auto_create_leads: autoCreate,
      auto_lead_funnel_id: funnelId || null,
      auto_lead_stage_id: stageId || null,
    } as any);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Criação Automática de Leads
          </CardTitle>
          <CardDescription>
            Quando ativado, todo novo contato que enviar uma mensagem no inbox será automaticamente adicionado como lead no funil selecionado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-create-leads" className="text-base font-medium">
                Ativar auto-criação de leads
              </Label>
              <p className="text-sm text-muted-foreground">
                Converte automaticamente novos contatos do WhatsApp em leads
              </p>
            </div>
            <Switch
              id="auto-create-leads"
              checked={autoCreate}
              onCheckedChange={setAutoCreate}
            />
          </div>

          {autoCreate && (
            <div className="space-y-4 pt-4 border-t border-border/50">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Funil de destino
                </Label>
                <Select value={funnelId} onValueChange={(v) => { setFunnelId(v); setStageId(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um funil" />
                  </SelectTrigger>
                  <SelectContent>
                    {funnels?.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!funnels?.length && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum funil encontrado. Crie um funil primeiro.
                  </p>
                )}
              </div>

              {funnelId && stages && stages.length > 0 && (
                <div className="space-y-2">
                  <Label>Estágio inicial (opcional)</Label>
                  <Select value={stageId} onValueChange={setStageId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Primeiro estágio (padrão)" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Se não selecionado, o lead será criado no primeiro estágio do funil.
                  </p>
                </div>
              )}
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={updateSettings.isPending || (autoCreate && !funnelId)}
            className="w-full sm:w-auto"
          >
            {updateSettings.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
            ) : (
              "Salvar configurações"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
