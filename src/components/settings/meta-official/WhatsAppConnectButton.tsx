import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Loader2, Zap, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import { useFacebookLogin } from "@/hooks/useFacebookLogin";
import { useMetaWhatsAppNumbers } from "@/hooks/useMetaWhatsAppNumbers";

const DEFAULT_CONFIG_ID = "25553459117680213";

interface WhatsAppConnectButtonProps {
  onConnected?: () => void;
}

export const WhatsAppConnectButton = ({ onConnected }: WhatsAppConnectButtonProps) => {
  const { isLoading, launchEmbeddedSignup, isSdkLoaded } = useFacebookLogin();
  const { addNumber, metaNumbers } = useMetaWhatsAppNumbers();
  const [error, setError] = useState<string | null>(null);

  const hasConnectedNumbers = metaNumbers && metaNumbers.some(n => n.is_active);

  const handleConnect = async () => {
    setError(null);

    if (!isSdkLoaded()) {
      setError("Facebook SDK ainda não carregou. Aguarde alguns segundos e tente novamente.");
      return;
    }

    const result = await launchEmbeddedSignup(DEFAULT_CONFIG_ID);

    if (result.success && result.phoneNumberId) {
      // Save number to meta_whatsapp_numbers table
      await addNumber.mutateAsync({
        phoneNumberId: result.phoneNumberId,
        displayName: result.businessName || undefined,
        phoneNumber: result.displayPhoneNumber || undefined,
        wabaId: result.wabaId || undefined,
      });
      onConnected?.();
    } else if (!result.success) {
      setError(result.error || "Erro desconhecido ao conectar");
    }
  };

  return (
    <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20">
              <Zap className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <CardTitle className="text-xl">WhatsApp Oficial (Meta)</CardTitle>
              <CardDescription>
                Conecte seu número oficial do WhatsApp Business para envio e recebimento de mensagens
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={hasConnectedNumbers ? "default" : "outline"}
            className={hasConnectedNumbers ? "bg-green-500/90 text-white" : ""}
          >
            {hasConnectedNumbers ? (
              <><Wifi className="h-3 w-3 mr-1" /> Ativo</>
            ) : (
              <><WifiOff className="h-3 w-3 mr-1" /> Desconectado</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert className="bg-destructive/10 border-destructive/30">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleConnect}
          disabled={isLoading || !isSdkLoaded()}
          size="lg"
          className="w-full h-12 text-base bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white shadow-lg shadow-green-500/20"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Conectando com a Meta...
            </>
          ) : (
            <>
              <MessageSquare className="h-5 w-5 mr-2" />
              {hasConnectedNumbers ? "Conectar outro número" : "Conectar WhatsApp"}
            </>
          )}
        </Button>

        {!isSdkLoaded() && (
          <p className="text-xs text-muted-foreground text-center animate-pulse">
            Carregando Facebook SDK...
          </p>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Você será redirecionado para o Facebook para autorizar o acesso à sua conta Meta Business
        </p>
      </CardContent>
    </Card>
  );
};
