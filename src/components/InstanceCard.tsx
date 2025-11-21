import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode, Trash2, Power, Check } from "lucide-react";
import { motion } from "framer-motion";

interface InstanceCardProps {
  name: string;
  status: "connected" | "disconnected" | "connecting";
  onQRCode: () => void;
  onDelete: () => void;
}

export const InstanceCard = ({ name, status, onQRCode, onDelete }: InstanceCardProps) => {
  const statusConfig = {
    connected: { color: "bg-whatsapp", text: "Conectado", icon: Check },
    disconnected: { color: "bg-destructive", text: "Desconectado", icon: Power },
    connecting: { color: "bg-muted-foreground", text: "Conectando...", icon: Power },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

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

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onQRCode}
            disabled={status === "connected"}
            className="flex-1"
          >
            <QrCode className="h-4 w-4 mr-2" />
            {status === "connected" ? "Conectado" : "Ver QR Code"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};
