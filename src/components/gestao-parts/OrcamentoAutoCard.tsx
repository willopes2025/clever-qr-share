import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, PlayCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Config {
  auto_send_enabled: boolean;
  activated_at: string | null;
  dry_run: boolean;
  batch_size: number;
  message_template: string | null;
  last_run_at: string | null;
  last_run_summary: Record<string, unknown> | null;
  consecutive_failures: number;
}

/** Controle do job de 15 minutos: começa desligado e sem efeito retroativo */
export const OrcamentoAutoCard = () => {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [template, setTemplate] = useState("");
  const [batchSize, setBatchSize] = useState(20);

  const load = async () => {
    const { data, error } = await supabase
      .from("gestao_parts_orcamento_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) toast.error(error.message);
    if (data) {
      setConfig(data as unknown as Config);
      setTemplate((data as unknown as Config).message_template || "");
      setBatchSize((data as unknown as Config).batch_size ?? 20);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const update = async (patch: Record<string, unknown>) => {
    setSaving(true);
    const { error } = await supabase
      .from("gestao_parts_orcamento_config")
      .update(patch)
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
  };

  const toggleAuto = async (enabled: boolean) => {
    // Ao ligar, o corte passa a ser agora: nada anterior é processado
    await update(
      enabled
        ? { auto_send_enabled: true, activated_at: new Date().toISOString(), consecutive_failures: 0 }
        : { auto_send_enabled: false },
    );
    toast.success(enabled ? "Envio automático ativado a partir de agora" : "Envio automático desativado");
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("gestao-parts-orcamentos-job", {
        body: { force: true },
      });
      if (error) throw error;
      if (data?.skipped) toast.info(String(data.skipped));
      else toast.success(`Enviados: ${data?.enviados ?? 0} · Ignorados: ${data?.ignorados ?? 0} · Falhas: ${data?.falhas ?? 0}`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const summary = config?.last_run_summary as Record<string, number> | null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Envio automático de orçamentos</CardTitle>
            <CardDescription>
              Verifica novos orçamentos a cada 10 minutos e envia uma única vez por cliente
            </CardDescription>

          </div>
          <Badge variant={config?.auto_send_enabled ? "default" : "outline"}>
            {config?.auto_send_enabled ? "Ativo" : "Desligado"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label>Ativar rotina de 10 minutos</Label>
            <p className="text-xs text-muted-foreground">
              Só processa orçamentos emitidos após a ativação
              {config?.activated_at ? ` (${new Date(config.activated_at).toLocaleString("pt-BR")})` : ""}
            </p>
          </div>
          <Switch checked={!!config?.auto_send_enabled} disabled={saving} onCheckedChange={toggleAuto} />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label>Modo teste (não envia mensagem)</Label>
            <p className="text-xs text-muted-foreground">Registra os orçamentos processados sem disparar WhatsApp</p>
          </div>
          <Switch
            checked={!!config?.dry_run}
            disabled={saving}
            onCheckedChange={(v) => update({ dry_run: v })}
          />
        </div>

        {(config?.consecutive_failures ?? 0) >= 5 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Rotina pausada após falhas consecutivas. Corrija a causa e reative o envio automático.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-[160px_1fr] sm:items-end">
          <div className="space-y-1.5">
            <Label>Máximo por execução</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={saving} onClick={() => update({ batch_size: batchSize, message_template: template || null })}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
            <Button variant="outline" disabled={running} onClick={runNow}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
              Executar agora
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Modelo da mensagem</Label>
          <Textarea
            rows={6}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="Use {{cliente}}, {{numero}}, {{data}}, {{itens}}, {{total}}, {{vendedor}}"
            className="text-xs font-mono"
          />
          <p className="text-[11px] text-muted-foreground">
            Variáveis: {"{{cliente}} {{numero}} {{data}} {{itens}} {{total}} {{vendedor}}"}

          </p>
        </div>

        {config?.last_run_at && (
          <p className="text-[11px] text-muted-foreground">
            Última execução: {new Date(config.last_run_at).toLocaleString("pt-BR")}
            {summary ? ` · enviados ${summary.enviados ?? 0}, ignorados ${summary.ignorados ?? 0}, falhas ${summary.falhas ?? 0}` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
