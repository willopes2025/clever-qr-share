import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Globe, Users, Loader2, LogIn, LogOut, Smartphone, CheckCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  status: string;
  phone_number?: string | null;
}

interface WarmingPoolEntry {
  id: string;
  user_id: string;
  instance_id: string;
  phone_number: string;
  is_active: boolean;
  joined_at: string;
  total_pairs_made: number;
  instance?: WhatsAppInstance;
}

interface PoolStats {
  totalActive: number;
}

interface WarmingPoolManagerProps {
  instances: WhatsAppInstance[];
  poolEntries: WarmingPoolEntry[];
  poolStats: PoolStats;
  onJoinPool: (instanceId: string, phoneNumber: string) => void;
  onLeavePool: (entryId: string) => void;
  isJoining?: boolean;
  isLeaving?: boolean;
}

export function WarmingPoolManager({
  instances,
  poolEntries,
  poolStats,
  onJoinPool,
  onLeavePool,
  isJoining,
  isLeaving,
}: WarmingPoolManagerProps) {
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");

  // Filtrar instâncias conectadas que ainda não estão no pool
  const connectedInstances = instances.filter(i => i.status === 'connected');
  const poolInstanceIds = poolEntries.map(e => e.instance_id);
  const availableInstances = connectedInstances.filter(i => !poolInstanceIds.includes(i.id));

  const handleJoinPool = () => {
    if (!selectedInstanceId || !phoneNumber.trim()) return;
    onJoinPool(selectedInstanceId, phoneNumber.trim());
    setSelectedInstanceId("");
    setPhoneNumber("");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <CardTitle>Pool de Aquecimento Comunitário</CardTitle>
        </div>
        <CardDescription>
          Participe do pool e aqueça seu chip trocando mensagens com outros usuários da plataforma automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Estatísticas do Pool */}
        <div className="flex items-center justify-center p-4 bg-primary/10 rounded-lg">
          <div className="flex items-center gap-2 text-center">
            <Users className="h-6 w-6 text-primary" />
            <div>
              <p className="text-2xl font-bold text-primary">{poolStats.totalActive}</p>
              <p className="text-sm text-muted-foreground">instâncias ativas no pool</p>
            </div>
          </div>
        </div>

        {/* Minhas entradas no pool */}
        {poolEntries.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Minhas Instâncias no Pool</Label>
            {poolEntries.map((entry) => (
              <div 
                key={entry.id} 
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                    <Smartphone className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {entry.instance?.instance_name || 'Instância'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      📱 {entry.phone_number}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {entry.total_pairs_made} pareamentos
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Desde {formatDate(entry.joined_at)}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onLeavePool(entry.id)}
                  disabled={isLeaving}
                >
                  {isLeaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <LogOut className="h-4 w-4 mr-1" />
                      Sair
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Adicionar nova instância ao pool */}
        {availableInstances.length > 0 ? (
          <div className="space-y-3 pt-2 border-t">
            <Label className="text-sm font-medium">Adicionar Instância ao Pool</Label>
            
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Selecionar Instância</Label>
              <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha uma instância conectada" />
                </SelectTrigger>
                <SelectContent>
                  {availableInstances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        {instance.instance_name}
                        {instance.phone_number && (
                          <span className="text-muted-foreground text-xs">
                            ({instance.phone_number})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Número do WhatsApp</Label>
              <Input
                placeholder="5511999887766"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
              />
              <p className="text-xs text-muted-foreground">
                Número completo com DDD (apenas números)
              </p>
            </div>

            <Button 
              onClick={handleJoinPool}
              disabled={!selectedInstanceId || !phoneNumber.trim() || isJoining}
              className="w-full"
            >
              {isJoining ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Entrar no Pool Comunitário
                </>
              )}
            </Button>
          </div>
        ) : connectedInstances.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Você precisa ter pelo menos uma instância conectada para participar do pool.
            </AlertDescription>
          </Alert>
        ) : poolEntries.length > 0 ? (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700 dark:text-green-400">
              Todas as suas instâncias conectadas já estão no pool!
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Informações sobre o pool */}
        <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
          <p>• Instâncias no pool são pareadas automaticamente com outras da plataforma</p>
          <p>• Mensagens são trocadas para simular uso real e aquecer o chip</p>
          <p>• Você pode sair a qualquer momento</p>
        </div>
      </CardContent>
    </Card>
  );
}
