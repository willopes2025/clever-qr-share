import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { QrCode, Trash2, Download, Settings, Check, Power, Pencil, Smartphone, Calendar } from "lucide-react";
import { WARMING_LEVELS, WhatsAppInstance } from "@/hooks/useWhatsAppInstances";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InstancesListViewProps {
  instances: (WhatsAppInstance & { funnel?: { id: string; name: string; color: string } | null })[];
  onQRCode: (instance: WhatsAppInstance) => void;
  onDelete: (instanceName: string) => void;
  onConfigureFunnel: (instance: WhatsAppInstance) => void;
  onSyncHistory: (instance: WhatsAppInstance) => void;
  onEditDevice: (instance: WhatsAppInstance) => void;
}

export const InstancesListView = ({
  instances,
  onQRCode,
  onDelete,
  onConfigureFunnel,
  onSyncHistory,
  onEditDevice,
}: InstancesListViewProps) => {
  const formatPhone = (phone: string | null) => {
    if (!phone) return '-';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 12) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return phone;
  };

  return (
    <div className="border rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-[250px]">Instância</TableHead>
            <TableHead>Número</TableHead>
            <TableHead>Dispositivo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Aquecimento</TableHead>
            <TableHead>Funil</TableHead>
            <TableHead>Conectado em</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {instances.map((instance) => {
            const warmingConfig = WARMING_LEVELS.find(w => w.level === instance.warming_level) || WARMING_LEVELS[0];
            const statusConfig = {
              connected: { color: "bg-accent", text: "Conectado", icon: Check },
              disconnected: { color: "bg-destructive", text: "Desconectado", icon: Power },
              connecting: { color: "bg-muted-foreground", text: "Conectando...", icon: Power },
            };
            const config = statusConfig[instance.status];
            const StatusIcon = config.icon;

            return (
              <TableRow key={instance.id}>
                {/* Instance Name + Avatar */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={instance.profile_picture_url || undefined} />
                      <AvatarFallback className="bg-muted">
                        <Smartphone className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{instance.instance_name}</div>
                      {instance.profile_name && (
                        <div className="text-xs text-muted-foreground">{instance.profile_name}</div>
                      )}
                    </div>
                    {instance.is_business && (
                      <Badge variant="outline" className="text-xs">Business</Badge>
                    )}
                  </div>
                </TableCell>

                {/* Phone Number */}
                <TableCell className="font-mono text-sm">
                  {formatPhone(instance.phone_number)}
                </TableCell>

                {/* Device */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {instance.device_label || '-'}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onEditDevice(instance)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge 
                    variant={instance.status === "connected" ? "default" : "secondary"}
                    className={`gap-1 ${instance.status === "connected" ? "bg-accent text-white" : ""}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {config.text}
                  </Badge>
                </TableCell>

                {/* Warming Level */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={warmingConfig.color}>{warmingConfig.icon}</span>
                    <span className="text-sm">{warmingConfig.name}</span>
                  </div>
                </TableCell>

                {/* Funnel */}
                <TableCell>
                  {instance.funnel ? (
                    <Badge 
                      variant="outline"
                      style={{ borderColor: instance.funnel.color }}
                    >
                      <div 
                        className="h-2 w-2 rounded-full mr-1.5"
                        style={{ backgroundColor: instance.funnel.color }}
                      />
                      {instance.funnel.name}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>

                {/* Connected At */}
                <TableCell>
                  {instance.connected_at ? (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {format(new Date(instance.connected_at), "dd MMM yyyy", { locale: ptBR })}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onConfigureFunnel(instance)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Configurar funil</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onQRCode(instance)}
                          disabled={instance.status === "connected"}
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>QR Code</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onSyncHistory(instance)}
                          disabled={instance.status !== "connected"}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Sincronizar histórico</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => onDelete(instance.instance_name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Excluir</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
