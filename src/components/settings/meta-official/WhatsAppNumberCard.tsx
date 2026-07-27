import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Activity, AlertTriangle, CheckCircle2, Phone, Building2, Signal, Gauge, Trash2, Loader2, Settings2, RefreshCw, KeyRound } from "lucide-react";
import type { MetaWhatsAppNumber } from "@/hooks/useMetaWhatsAppNumbers";
import { MetaNumberConfigDialog } from "./MetaNumberConfigDialog";
import { MetaNumberTokenDialog } from "./MetaNumberTokenDialog";
import { toast } from "sonner";

interface WhatsAppNumberCardProps {
  number: MetaWhatsAppNumber;
  onToggleActive: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

const getStatusConfig = (status: string | null) => {
  switch (status) {
    case "connected":
      return { label: "Conectado", className: "bg-green-500/15 text-green-400 border-green-500/30" };
    case "pending":
      return { label: "Pendente", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" };
    case "restricted":
      return { label: "Restrito", className: "bg-red-500/15 text-red-400 border-red-500/30" };
    default:
      return { label: status || "Desconhecido", className: "bg-muted text-muted-foreground" };
  }
};

const getQualityConfig = (quality: string | null) => {
  switch (quality?.toUpperCase()) {
    case "GREEN":
      return { label: "Alta", className: "text-green-400" };
    case "YELLOW":
      return { label: "Média", className: "text-yellow-400" };
    case "RED":
      return { label: "Baixa", className: "text-red-400" };
    default:
      return null;
  }
};

type MetaNumberHealth = {
  healthStatus: "ok" | "warning" | "error";
  conclusion: string;
  counters: {
    events_last_24h: number;
    inbound_messages_last_24h: number;
    status_events_last_24h: number;
    conversations: number;
    failed_events: number;
  };
  timeline: {
    latest_event: { ago: string | null; event_type: string | null; received_at: string } | null;
    latest_message_event: { ago: string | null; received_at: string } | null;
    latest_status_event: { ago: string | null; received_at: string } | null;
    latest_admin_event: { ago: string | null; event_type: string | null; received_at: string } | null;
    latest_inbound_message: { ago: string | null; status: string | null; message_type: string | null; content_preview: string } | null;
    latest_outbound_message: { ago: string | null; status: string | null; message_type: string | null; content_preview: string } | null;
  };
};

const getHealthConfig = (status: MetaNumberHealth["healthStatus"] | undefined) => {
  switch (status) {
    case "ok":
      return { label: "Saudável", icon: CheckCircle2, className: "border-green-500/30 bg-green-500/10 text-green-300" };
    case "warning":
      return { label: "Atenção", icon: AlertTriangle, className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300" };
    case "error":
      return { label: "Falha", icon: AlertTriangle, className: "border-red-500/30 bg-red-500/10 text-red-300" };
    default:
      return { label: "Não verificado", icon: Activity, className: "border-border bg-muted/30 text-muted-foreground" };
  }
};

export const WhatsAppNumberCard = ({
  number,
  onToggleActive,
  onDelete,
  isUpdating,
  isDeleting,
}: WhatsAppNumberCardProps) => {
  const [configOpen, setConfigOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [health, setHealth] = useState<MetaNumberHealth | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const statusConfig = getStatusConfig(number.status);
  const qualityConfig = getQualityConfig(number.quality_rating);
  const healthConfig = getHealthConfig(health?.healthStatus);
  const HealthIcon = healthConfig.icon;

  const handleCheckHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-number-health', {
        body: {
          metaNumberId: number.id,
          phoneNumberId: number.phone_number_id,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Não foi possível verificar o número');

      setHealth(data as MetaNumberHealth);
      toast.success("Diagnóstico atualizado");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao verificar conexão";
      toast.error(message);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  return (
    <Card className={`transition-all duration-200 ${number.is_active ? "border-primary/20 bg-card/80" : "border-border/30 bg-muted/20 opacity-70"}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Info */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Header row */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-semibold truncate">
                  {number.display_name || "Sem nome"}
                </span>
              </div>
              <Badge variant="outline" className={statusConfig.className}>
                {statusConfig.label}
              </Badge>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
              {number.phone_number && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span className="font-mono text-xs">{number.phone_number}</span>
                </div>
              )}

              {number.waba_id && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="text-xs">WABA: {number.waba_id}</span>
                </div>
              )}

              {qualityConfig && (
                <div className="flex items-center gap-1.5">
                  <Signal className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className={`text-xs font-medium ${qualityConfig.className}`}>
                    Qualidade: {qualityConfig.label}
                  </span>
                </div>
              )}

              {number.messaging_limit && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5" />
                  <span className="text-xs">Limite: {number.messaging_limit}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={handleCheckHealth}
              disabled={isCheckingHealth}
              title="Verificar conexão Meta → CRM"
            >
              {isCheckingHealth ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => setConfigOpen(true)}
              title="Configurar número"
            >
              <Settings2 className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {number.is_active ? "Ativo" : "Inativo"}
              </span>
              <Switch
                checked={number.is_active}
                onCheckedChange={(checked) => onToggleActive(number.id, checked)}
                disabled={isUpdating}
              />
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover número</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja remover o número{" "}
                    <strong>{number.display_name || number.phone_number}</strong>?
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(number.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {(health || isCheckingHealth) && (
          <div className={`mt-4 rounded-lg border p-3 text-sm ${healthConfig.className}`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  {isCheckingHealth ? <Loader2 className="h-4 w-4 animate-spin" /> : <HealthIcon className="h-4 w-4" />}
                  <span>Diagnóstico Meta → CRM: {healthConfig.label}</span>
                </div>
                {health?.conclusion && (
                  <p className="max-w-3xl text-xs leading-relaxed text-current opacity-90">
                    {health.conclusion}
                  </p>
                )}
              </div>

              {health && (
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:min-w-[460px]">
                  <div className="rounded-md bg-background/40 p-2">
                    <div className="text-muted-foreground">Eventos 24h</div>
                    <div className="font-semibold">{health.counters.events_last_24h}</div>
                  </div>
                  <div className="rounded-md bg-background/40 p-2">
                    <div className="text-muted-foreground">Inbound 24h</div>
                    <div className="font-semibold">{health.counters.inbound_messages_last_24h}</div>
                  </div>
                  <div className="rounded-md bg-background/40 p-2">
                    <div className="text-muted-foreground">Status 24h</div>
                    <div className="font-semibold">{health.counters.status_events_last_24h}</div>
                  </div>
                  <div className="rounded-md bg-background/40 p-2">
                    <div className="text-muted-foreground">Falhas</div>
                    <div className="font-semibold">{health.counters.failed_events}</div>
                  </div>
                </div>
              )}
            </div>

            {health && (
              <div className="mt-3 grid gap-2 text-xs md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md bg-background/40 p-2">
                  <div className="text-muted-foreground">Último evento</div>
                  <div className="font-medium">{health.timeline.latest_event?.ago || "Sem registro"}</div>
                  <div className="text-muted-foreground">{health.timeline.latest_event?.event_type || "—"}</div>
                </div>
                <div className="rounded-md bg-background/40 p-2">
                  <div className="text-muted-foreground">Última mensagem recebida</div>
                  <div className="font-medium">{health.timeline.latest_inbound_message?.ago || "Sem registro"}</div>
                  <div className="truncate text-muted-foreground">{health.timeline.latest_inbound_message?.content_preview || health.timeline.latest_inbound_message?.message_type || "—"}</div>
                </div>
                <div className="rounded-md bg-background/40 p-2">
                  <div className="text-muted-foreground">Última mensagem enviada</div>
                  <div className="font-medium">{health.timeline.latest_outbound_message?.ago || "Sem registro"}</div>
                  <div className="truncate text-muted-foreground">{health.timeline.latest_outbound_message?.status || "—"}</div>
                </div>
                <div className="rounded-md bg-background/40 p-2">
                  <div className="text-muted-foreground">Último evento administrativo</div>
                  <div className="font-medium">{health.timeline.latest_admin_event?.ago || "Sem registro"}</div>
                  <div className="truncate text-muted-foreground">{health.timeline.latest_admin_event?.event_type || "—"}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <MetaNumberConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        number={number}
      />
    </Card>
  );
};
