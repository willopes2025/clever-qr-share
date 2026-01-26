import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MessageSquare,
  Check,
  Loader2,
  Zap,
  Phone,
  Building2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Settings,
} from "lucide-react";
import { useFacebookLogin } from "@/hooks/useFacebookLogin";
import { useIntegrations } from "@/hooks/useIntegrations";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Configuration ID from Meta Developers - Embedded Signup Configuration
// User needs to update this with their actual config ID
const DEFAULT_CONFIG_ID = "";

interface MetaEmbeddedSignupProps {
  onConnected?: () => void;
  onShowManualConfig?: () => void;
}

export const MetaEmbeddedSignup = ({ onConnected, onShowManualConfig }: MetaEmbeddedSignupProps) => {
  const { isLoading, launchEmbeddedSignup, isSdkLoaded } = useFacebookLogin();
  const { getIntegration, refetch } = useIntegrations();
  const [configId, setConfigId] = useState(DEFAULT_CONFIG_ID);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const integration = getIntegration('meta_whatsapp');
  const credentials = integration?.credentials as Record<string, string> | undefined;
  
  const isConnected = integration?.is_active && credentials?.phone_number_id;
  const displayPhone = credentials?.display_phone_number;
  const businessName = credentials?.business_name;

  useEffect(() => {
    // Check if SDK is available
    if (!isSdkLoaded()) {
      console.log('[EMBEDDED-SIGNUP] Waiting for Facebook SDK...');
    }
  }, [isSdkLoaded]);

  const handleConnect = async () => {
    setError(null);

    if (!configId) {
      setError('Configuration ID é obrigatório. Configure abaixo ou use a configuração manual.');
      setShowAdvanced(true);
      return;
    }

    if (!isSdkLoaded()) {
      setError('Facebook SDK ainda não carregou. Aguarde alguns segundos e tente novamente.');
      return;
    }

    const result = await launchEmbeddedSignup(configId);
    
    if (result.success) {
      await refetch();
      onConnected?.();
    } else {
      setError(result.error || 'Erro desconhecido ao conectar');
    }
  };

  if (isConnected) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Check className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <CardTitle className="text-xl">WhatsApp Conectado</CardTitle>
                <CardDescription>
                  Conta conectada via Embedded Signup
                </CardDescription>
              </div>
            </div>
            <Badge className="bg-green-500">
              <Check className="h-3 w-3 mr-1" /> Ativo
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{displayPhone || 'Número não disponível'}</p>
                <p className="text-xs text-muted-foreground">Número conectado</p>
              </div>
            </div>
            
            {businessName && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{businessName}</p>
                  <p className="text-xs text-muted-foreground">Conta Business</p>
                </div>
              </div>
            )}
          </div>

          <Alert className="bg-blue-500/10 border-blue-500/30">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-blue-200">
              Sua conta WhatsApp Business está conectada e pronta para receber e enviar mensagens.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/20 to-blue-500/20">
            <Zap className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <CardTitle className="text-xl">Conexão Rápida</CardTitle>
            <CardDescription>
              Conecte seu WhatsApp Business em poucos cliques usando Login for Business
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert className="bg-red-500/10 border-red-500/30">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-200">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <Button
            onClick={handleConnect}
            disabled={isLoading || !isSdkLoaded()}
            className="w-full h-12 text-lg bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <MessageSquare className="h-5 w-5 mr-2" />
                Conectar WhatsApp Business
              </>
            )}
          </Button>

          {!isSdkLoaded() && (
            <p className="text-xs text-muted-foreground text-center">
              Carregando Facebook SDK...
            </p>
          )}
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>Você será redirecionado para autorizar o acesso à sua conta Meta</p>
        </div>

        {/* Advanced Settings */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configurações Avançadas
              </span>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="config_id">Configuration ID (Embedded Signup)</Label>
              <Input
                id="config_id"
                value={configId}
                onChange={(e) => setConfigId(e.target.value)}
                placeholder="Ex: 123456789012345"
              />
              <p className="text-xs text-muted-foreground">
                ID da configuração de Embedded Signup criada no Meta Developers. 
                <a 
                  href="https://developers.facebook.com/docs/whatsapp/embedded-signup" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-1 underline hover:text-primary"
                >
                  Saiba mais →
                </a>
              </p>
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onShowManualConfig}
                className="w-full"
              >
                <Settings className="h-4 w-4 mr-2" />
                Usar Configuração Manual
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Configure manualmente com Access Token e Phone Number ID
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
