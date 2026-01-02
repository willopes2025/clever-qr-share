import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { QrCode, Trash2, Power, Check, Minus, Plus, GitBranch, Settings, Download, Smartphone, Calendar, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import { WARMING_LEVELS } from "@/hooks/useWhatsAppInstances";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InstanceCardProps {
  name: string;
  status: "connected" | "disconnected" | "connecting";
  warmingLevel: number;
  funnelName?: string | null;
  funnelColor?: string | null;
  phoneNumber?: string | null;
  profileName?: string | null;
  profilePictureUrl?: string | null;
  isBusiness?: boolean;
  deviceLabel?: string | null;
  connectedAt?: string | null;
  onQRCode: () => void;
  onDelete: () => void;
  onWarmingChange: (level: number) => void;
  onConfigureFunnel: () => void;
  onSyncHistory: () => void;
  onEditDevice?: () => void;
}

export const InstanceCard = ({ 
  name, 
  status, 
  warmingLevel = 1,
  funnelName,
  funnelColor,
  phoneNumber,
  profileName,
  profilePictureUrl,
  isBusiness,
  deviceLabel,
  connectedAt,
  onQRCode, 
  onDelete,
  onWarmingChange,
  onConfigureFunnel,
  onSyncHistory,
  onEditDevice,
}: InstanceCardProps) => {
  const statusConfig = {
    connected: { color: "bg-accent", text: "Conectado", icon: Check },
    disconnected: { color: "bg-destructive", text: "Desconectado", icon: Power },
    connecting: { color: "bg-muted-foreground", text: "Conectando...", icon: Power },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const warmingConfig = WARMING_LEVELS.find(w => w.level === warmingLevel) || WARMING_LEVELS[0];

  const handleDecrease = () => {
    if (warmingLevel > 1) {
      onWarmingChange(warmingLevel - 1);
    }
  };

  const handleIncrease = () => {
    if (warmingLevel < 5) {
      onWarmingChange(warmingLevel + 1);
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return null;
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-6 depth-card hover:shadow-hover transition-all">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 flex-1">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profilePictureUrl || undefined} />
              <AvatarFallback className="bg-muted">
                <Smartphone className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg text-foreground truncate">{name}</h3>
                {isBusiness && (
                  <Badge variant="outline" className="text-xs shrink-0">Business</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <div className={`h-2 w-2 rounded-full ${config.color} animate-pulse`} />
                <span className="text-sm text-muted-foreground">{config.text}</span>
                {funnelName && (
                  <Badge 
                    variant="outline" 
                    className="gap-1 text-xs"
                    style={{ borderColor: funnelColor || '#3B82F6' }}
                  >
                    <GitBranch className="h-3 w-3" style={{ color: funnelColor || '#3B82F6' }} />
                    {funnelName}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onConfigureFunnel}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Configurar funil de captura</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Phone & Device Info */}
        <div className="mb-4 p-3 rounded-xl bg-muted/30 space-y-2">
          {phoneNumber && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Número:</span>
              <span className="font-mono">{formatPhone(phoneNumber)}</span>
            </div>
          )}
          {profileName && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Perfil:</span>
              <span>{profileName}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Dispositivo:</span>
            <div className="flex items-center gap-1">
              <span>{deviceLabel || '-'}</span>
              {onEditDevice && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={onEditDevice}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          {connectedAt && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Conectado em:</span>
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <span>{format(new Date(connectedAt), "dd MMM yyyy", { locale: ptBR })}</span>
              </div>
            </div>
          )}
        </div>

        {/* Warming Level Section */}
        <TooltipProvider>
          <div className="mb-4 p-3 rounded-xl bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs font-medium text-muted-foreground cursor-help">
                    Nível de Aquecimento
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-[250px]">
                  <p className="text-xs">
                    Define a proporção de mensagens que esta instância receberá. 
                    Chips mais quentes recebem mais mensagens, protegendo chips novos de banimento.
                  </p>
                </TooltipContent>
              </Tooltip>
              <span className={`text-sm font-medium ${warmingConfig.color}`}>
                {warmingConfig.icon} {warmingConfig.name}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 relative z-50 rounded-lg"
                onClick={handleDecrease}
                disabled={warmingLevel <= 1}
              >
                <Minus className="h-3 w-3" />
              </Button>
              
              <div className="flex-1 flex gap-1">
                {WARMING_LEVELS.map((level) => (
                  <div
                    key={level.level}
                    className={`h-2 flex-1 rounded-full transition-all ${
                      level.level <= warmingLevel 
                        ? level.bgColor 
                        : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
              
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 relative z-50 rounded-lg"
                onClick={handleIncrease}
                disabled={warmingLevel >= 5}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Peso: {warmingLevel}x na distribuição de mensagens
            </p>
          </div>
        </TooltipProvider>

        <div className="flex gap-2 relative z-50">
          <Button
            variant="outline"
            size="sm"
            onClick={onQRCode}
            disabled={status === "connected"}
            className="flex-1 relative z-50 rounded-xl"
          >
            <QrCode className="h-4 w-4 mr-2" />
            {status === "connected" ? "Conectado" : "Ver QR Code"}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onSyncHistory}
                disabled={status !== "connected"}
                className="relative z-50 rounded-xl"
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Sincronizar histórico de mensagens</p>
            </TooltipContent>
          </Tooltip>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            className="relative z-50 rounded-xl"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};
