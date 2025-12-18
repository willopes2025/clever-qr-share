import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode, Trash2, Power, Check, Minus, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { WARMING_LEVELS } from "@/hooks/useWhatsAppInstances";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface InstanceCardProps {
  name: string;
  status: "connected" | "disconnected" | "connecting";
  warmingLevel: number;
  onQRCode: () => void;
  onDelete: () => void;
  onWarmingChange: (level: number) => void;
}

export const InstanceCard = ({ 
  name, 
  status, 
  warmingLevel = 1,
  onQRCode, 
  onDelete,
  onWarmingChange 
}: InstanceCardProps) => {
  const statusConfig = {
    connected: { color: "bg-whatsapp", text: "Conectado", icon: Check },
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-6 shadow-medium hover:shadow-large transition-all">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">{name}</h3>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${config.color} animate-pulse`} />
              <span className="text-sm text-muted-foreground">{config.text}</span>
            </div>
          </div>
          <Badge variant={status === "connected" ? "default" : "secondary"} className="gap-1">
            <StatusIcon className="h-3 w-3" />
            {config.text}
          </Badge>
        </div>

        {/* Warming Level Section */}
        <TooltipProvider>
          <div className="mb-4 p-3 rounded-lg bg-muted/50 border">
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
                className="h-7 w-7 relative z-50"
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
                className="h-7 w-7 relative z-50"
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
            className="flex-1 relative z-50"
          >
            <QrCode className="h-4 w-4 mr-2" />
            {status === "connected" ? "Conectado" : "Ver QR Code"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            className="relative z-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};
