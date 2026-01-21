import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cloud, Plus, Settings, Trash2, AlertCircle, CheckCircle, ExternalLink, TestTube, Loader2, ShieldCheck, ShieldAlert, ShieldX, Send, MessageSquare } from "lucide-react";
import { useMetaWhatsAppNumbers, MetaWhatsAppNumber } from "@/hooks/useMetaWhatsAppNumbers";
import { MetaWebhookConfigDialog } from "./MetaWebhookConfigDialog";
import { AddMetaNumberDialog } from "./AddMetaNumberDialog";
import { MetaWebhookEventsPanel } from "./MetaWebhookEventsPanel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WebhookStatus {
  success: boolean;
  webhookStatus: 'active' | 'not_configured' | 'partial' | 'error';
  details: {
    callbackUrl?: string;
    fields?: string[];
    lastVerified: string;
    appInfo?: {
      id: string;
      name: string;
    };
  };
  missingFields: string[];
  message: string;
}

interface MetaWhatsAppSectionProps {
  webhookConfigured?: boolean;
}

export const MetaWhatsAppSection = ({ webhookConfigured = false }: MetaWhatsAppSectionProps) => {
  const { metaNumbers, isLoading, deleteNumber } = useMetaWhatsAppNumbers();
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [numberToDelete, setNumberToDelete] = useState<MetaWhatsAppNumber | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSendingReal, setIsSendingReal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [webhookVerificationStatus, setWebhookVerificationStatus] = useState<WebhookStatus | null>(null);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('hello_world');
  const navigate = useNavigate();

  const handleVerifyWebhook = async () => {
    try {
      setIsVerifying(true);
      setWebhookVerificationStatus(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado para verificar");
        return;
      }

      const { data, error } = await supabase.functions.invoke('verify-meta-webhook', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Verify webhook error:', error);
        toast.error("Erro ao verificar webhook: " + error.message);
        return;
      }

      setWebhookVerificationStatus(data as WebhookStatus);

      if (data.webhookStatus === 'active') {
        toast.success("Webhook configurado corretamente!");
      } else if (data.webhookStatus === 'partial') {
        toast.warning("Webhook parcialmente configurado");
      } else if (data.webhookStatus === 'error') {
        toast.error(data.message || "Erro ao verificar webhook");
      } else {
        toast.error("Webhook não configurado");
      }

    } catch (err) {
      console.error('Verify webhook error:', err);
      toast.error("Erro ao verificar webhook");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSimulatedTest = async () => {
    try {
      setIsTesting(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado para testar");
        return;
      }

      const { data, error } = await supabase.functions.invoke('meta-whatsapp-test-event', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          testPhoneNumber: testPhoneNumber.replace(/\D/g, '')
        }
      });

      if (error) {
        console.error('Test error:', error);
        toast.error("Erro ao criar mensagem de teste: " + error.message);
        return;
      }

      toast.success("Mensagem simulada criada! Abrindo Inbox...");
      
      setTimeout(() => {
        navigate('/inbox');
      }, 1000);

    } catch (err) {
      console.error('Test error:', err);
      toast.error("Erro ao criar mensagem de teste");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSendRealMessage = async () => {
    try {
      setIsSendingReal(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado para enviar");
        return;
      }

      const { data, error } = await supabase.functions.invoke('meta-whatsapp-send', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          to: testPhoneNumber.replace(/\D/g, ''),
          type: 'template',
          template: {
            name: selectedTemplate,
            language: { code: 'pt_BR' }
          }
        }
      });

      if (error) {
        console.error('Send error:', error);
        toast.error("Erro ao enviar mensagem: " + error.message);
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || "Erro ao enviar mensagem");
        return;
      }

      toast.success("Mensagem enviada com sucesso!");

    } catch (err) {
      console.error('Send error:', err);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setIsSendingReal(false);
    }
  };

  const handleDeleteClick = (number: MetaWhatsAppNumber) => {
    setNumberToDelete(number);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (numberToDelete) {
      await deleteNumber.mutateAsync(numberToDelete.id);
      setDeleteConfirmOpen(false);
      setNumberToDelete(null);
    }
  };

  const formatPhoneNumber = (phone: string | null) => {
    if (!phone) return "Não definido";
    // Remove non-digits
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 13) {
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    if (digits.length === 12) {
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
    }
    return phone;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-blue-500" />
          <h2 className="text-xl font-semibold">WhatsApp API (Meta)</h2>
          <Badge variant="outline" className="text-blue-500 border-blue-500/50">
            Business API
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleVerifyWebhook}
            disabled={isVerifying}
            className="gap-1.5"
          >
            {isVerifying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Verificar Webhook
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWebhookDialogOpen(true)}
            className="gap-1.5"
          >
            <Settings className="h-4 w-4" />
            Configurar Webhook
          </Button>
          <Button
            size="sm"
            onClick={() => setAddDialogOpen(true)}
            className="gap-1.5 bg-blue-500 hover:bg-blue-600"
          >
            <Plus className="h-4 w-4" />
            Adicionar Número
          </Button>
        </div>
      </div>

      {/* Webhook Verification Status */}
      {webhookVerificationStatus && (
        <Alert className={
          webhookVerificationStatus.webhookStatus === 'active' 
            ? 'bg-green-500/10 border-green-500/30'
            : webhookVerificationStatus.webhookStatus === 'partial'
            ? 'bg-yellow-500/10 border-yellow-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }>
          <div className="flex items-start gap-3">
            {webhookVerificationStatus.webhookStatus === 'active' ? (
              <ShieldCheck className="h-5 w-5 text-green-500 mt-0.5" />
            ) : webhookVerificationStatus.webhookStatus === 'partial' ? (
              <ShieldAlert className="h-5 w-5 text-yellow-500 mt-0.5" />
            ) : (
              <ShieldX className="h-5 w-5 text-red-500 mt-0.5" />
            )}
            <AlertDescription className="text-sm flex-1">
              <p className="font-medium mb-1">
                {webhookVerificationStatus.webhookStatus === 'active' && 'Webhook Ativo'}
                {webhookVerificationStatus.webhookStatus === 'partial' && 'Webhook Parcialmente Configurado'}
                {webhookVerificationStatus.webhookStatus === 'not_configured' && 'Webhook Não Configurado'}
                {webhookVerificationStatus.webhookStatus === 'error' && 'Erro na Verificação'}
              </p>
              <p className="text-muted-foreground">{webhookVerificationStatus.message}</p>
              
              {webhookVerificationStatus.details.fields && webhookVerificationStatus.details.fields.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-muted-foreground">Campos ativos: </span>
                  <span className="text-xs font-mono">{webhookVerificationStatus.details.fields.join(', ')}</span>
                </div>
              )}
              
              {webhookVerificationStatus.missingFields.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-red-500">Campos faltando: </span>
                  <span className="text-xs font-mono text-red-500">{webhookVerificationStatus.missingFields.join(', ')}</span>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground mt-2">
                Verificado em: {new Date(webhookVerificationStatus.details.lastVerified).toLocaleString('pt-BR')}
              </p>
            </AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWebhookVerificationStatus(null)}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse bg-muted/50">
              <CardContent className="p-6">
                <div className="h-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : metaNumbers && metaNumbers.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metaNumbers.map((number) => (
            <Card key={number.id} className="glass-card border-blue-500/30 hover:border-blue-500/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium">
                    {number.display_name || "Meta WhatsApp"}
                  </CardTitle>
                  <Badge 
                    variant={webhookConfigured ? "default" : "secondary"}
                    className={webhookConfigured 
                      ? "bg-green-500/90 text-white" 
                      : "bg-yellow-500/90 text-white"
                    }
                  >
                    {webhookConfigured ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Ativo
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Configurar
                      </>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-mono text-sm">{formatPhoneNumber(number.phone_number)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Phone Number ID</p>
                  <p className="font-mono text-xs text-muted-foreground">{number.phone_number_id}</p>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setWebhookDialogOpen(true)}
                    className="text-xs gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Ver instruções
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(number)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="glass-card border-dashed border-2 border-muted-foreground/30">
          <CardContent className="py-8 text-center">
            <Cloud className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">
              Nenhum número Meta WhatsApp API configurado.
            </p>
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="bg-blue-500 hover:bg-blue-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Número
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Webhook Events Panel and Test Button */}
      <div className="grid md:grid-cols-2 gap-4">
        <MetaWebhookEventsPanel />
        
        <Card className="glass-card border-muted">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              Testar Integração
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-phone">Número de Destino</Label>
              <Input
                id="test-phone"
                placeholder="Ex: 5527999999999"
                value={testPhoneNumber}
                onChange={(e) => setTestPhoneNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Número com código do país (ex: 55 para Brasil)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Template de Mensagem</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hello_world">hello_world (padrão)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Templates devem estar aprovados no Meta Business Manager
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={handleSimulatedTest}
                disabled={isTesting || !testPhoneNumber.trim()}
                className="gap-2"
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )}
                Simular Recebimento
              </Button>
              
              <Button
                onClick={handleSendRealMessage}
                disabled={isSendingReal || !testPhoneNumber.trim()}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                {isSendingReal ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar Real
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
              <p><strong>Simular:</strong> Cria mensagem fake no Inbox (não envia nada)</p>
              <p><strong>Enviar Real:</strong> Envia mensagem via API Meta usando o template selecionado</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <MetaWebhookConfigDialog
        open={webhookDialogOpen}
        onOpenChange={setWebhookDialogOpen}
      />

      <AddMetaNumberDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover número Meta?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá remover o número {formatPhoneNumber(numberToDelete?.phone_number)} do sistema.
              As conversas existentes serão mantidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
