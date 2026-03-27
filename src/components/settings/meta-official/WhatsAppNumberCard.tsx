import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { Phone, Building2, Signal, Gauge, Trash2, Loader2, Settings2 } from "lucide-react";
import type { MetaWhatsAppNumber } from "@/hooks/useMetaWhatsAppNumbers";
import { MetaNumberConfigDialog } from "./MetaNumberConfigDialog";

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

export const WhatsAppNumberCard = ({
  number,
  onToggleActive,
  onDelete,
  isUpdating,
  isDeleting,
}: WhatsAppNumberCardProps) => {
  const [configOpen, setConfigOpen] = useState(false);
  const statusConfig = getStatusConfig(number.status);
  const qualityConfig = getQualityConfig(number.quality_rating);

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
      </CardContent>
    </Card>
  );
};
