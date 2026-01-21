import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageSquare,
  Check,
  X,
  Loader2,
  Copy,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Send,
  FileText,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useIntegrations } from "@/hooks/useIntegrations";
import { useMetaTemplates } from "@/hooks/useMetaTemplates";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUPABASE_PROJECT_ID = "fgbenetdksqnvwkgnips";
const WEBHOOK_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/meta-whatsapp-webhook`;

export const MetaWhatsAppSettings = () => {
  const { integrations, connectIntegration, disconnectIntegration, updateIntegration, getIntegration } = useIntegrations();
  const { templates, syncTemplates, isSyncing } = useMetaTemplates();
  const [isConnected, setIsConnected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [formData, setFormData] = useState({
    phone_number_id: '',
    access_token: '',
    business_account_id: '',
    app_secret: '',
    verify_token: '',
  });
  const [testPhone, setTestPhone] = useState('5527999400707');
  const [testMessage, setTestMessage] = useState('Teste WhatsApp Cloud API funcionando 🚀');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [useTemplate, setUseTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // Filter only approved templates
  const approvedTemplates = templates?.filter(t => t.status === 'approved') || [];

  const integration = getIntegration('meta_whatsapp');

  useEffect(() => {
    if (integration) {
      setIsConnected(integration.is_active || false);
      const creds = integration.credentials as Record<string, string> || {};
      setFormData({
        phone_number_id: creds.phone_number_id || '',
        access_token: creds.access_token || '',
        business_account_id: creds.business_account_id || '',
        app_secret: creds.app_secret || '',
        verify_token: creds.verify_token || '',
      });
    }
  }, [integration]);

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast.success("URL do webhook copiada!");
  };

  const handleCopyVerifyToken = () => {
    if (formData.verify_token) {
      navigator.clipboard.writeText(formData.verify_token);
      toast.success("Verify Token copiado!");
    }
  };

  const handleGenerateVerifyToken = () => {
    const token = `wpp_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    setFormData(prev => ({ ...prev, verify_token: token }));
    toast.info("Token gerado! Lembre-se de salvar as configurações.");
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-whatsapp-templates', {
        body: {}
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Conexão OK! ${data.templates?.length || 0} templates encontrados.`);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Test connection error:', error);
      toast.error(`Erro na conexão: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!testPhone) {
      toast.error("Número de destino é obrigatório");
      return;
    }

    if (useTemplate && !selectedTemplate) {
      toast.error("Selecione um template para enviar");
      return;
    }

    if (!useTemplate && !testMessage) {
      toast.error("Mensagem é obrigatória");
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      // Build request body based on message type
      const templateData = approvedTemplates.find(t => t.name === selectedTemplate);
      const languageCode = templateData?.language || 'pt_BR';

      let body;
      
      if (useTemplate) {
        // Check if template has variables by looking at body_text
        const bodyText = templateData?.body_text || '';
        const variableMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
        
        // Build components array with example/test values for each variable
        const components: any[] = [];
        if (variableMatches.length > 0) {
          const parameters = variableMatches.map((_, idx) => ({
            type: 'text',
            text: `Teste${idx + 1}` // Example values for testing
          }));
          
          components.push({
            type: 'body',
            parameters
          });
        }

        body = {
          to: testPhone.replace(/\D/g, ''),
          type: 'template',
          template: {
            name: selectedTemplate,
            language: { code: languageCode },
            ...(components.length > 0 ? { components } : {})
          }
        };
      } else {
        body = {
          to: testPhone.replace(/\D/g, ''),
          type: 'text',
          text: { body: testMessage }
        };
      }

      const { data, error } = await supabase.functions.invoke('meta-whatsapp-send', { body });

      console.log('[TEST-SEND] Response:', data, error);

      if (error) throw error;

      if (data.success) {
        setTestResult({ 
          success: true, 
          message: `Mensagem enviada com sucesso! ID: ${data.messageId}` 
        });
        toast.success("Mensagem de teste enviada!");
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      console.error('[TEST-SEND] Error:', error);
      setTestResult({ 
        success: false, 
        message: `Erro: ${error.message}` 
      });
      toast.error(`Erro ao enviar: ${error.message}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSave = async () => {
    if (!formData.phone_number_id || !formData.access_token) {
      toast.error("Phone Number ID e Access Token são obrigatórios");
      return;
    }

    setIsSaving(true);
    try {
      if (integration) {
        await updateIntegration.mutateAsync({
          id: integration.id,
          credentials: formData,
          is_active: isConnected,
        });
      } else {
        await connectIntegration.mutateAsync({
          provider: 'meta_whatsapp',
          credentials: formData,
          settings: {},
        });
      }
      toast.success("Configurações salvas com sucesso!");
    } catch (error: any) {
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (integration) {
      await disconnectIntegration.mutateAsync(integration.id);
      setFormData({
        phone_number_id: '',
        access_token: '',
        business_account_id: '',
        app_secret: '',
        verify_token: '',
      });
      setIsConnected(false);
      toast.success("Integração desconectada");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <MessageSquare className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <CardTitle className="text-xl">WhatsApp Business Cloud API</CardTitle>
                <CardDescription>
                  Integração oficial da Meta para envio e recebimento de mensagens
                </CardDescription>
              </div>
            </div>
            <Badge variant={isConnected ? "default" : "outline"} className={isConnected ? "bg-green-500" : ""}>
              {isConnected ? <><Check className="h-3 w-3 mr-1" /> Conectado</> : "Desconectado"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status e Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
            <div>
              <p className="font-medium">Ativar integração</p>
              <p className="text-sm text-muted-foreground">
                Habilitar envio e recebimento via WhatsApp Cloud API
              </p>
            </div>
            <Switch
              checked={isConnected}
              onCheckedChange={setIsConnected}
            />
          </div>

          <Separator />

          {/* Webhook URL */}
          <div className="space-y-4">
            <h3 className="font-semibold">1. Configurar Webhook no Meta Developers</h3>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No painel do Meta for Developers, vá em <strong>WhatsApp → Configuração → Webhook</strong> e adicione esta URL:
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Input
                value={WEBHOOK_URL}
                readOnly
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Verify Token (para validação do webhook)</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.verify_token}
                  onChange={(e) => setFormData(prev => ({ ...prev, verify_token: e.target.value }))}
                  placeholder="Digite ou gere um token"
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={handleCopyVerifyToken} disabled={!formData.verify_token}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={handleGenerateVerifyToken}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Gerar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use este token no campo "Verify Token" ao configurar o webhook no Meta
              </p>
            </div>
          </div>

          <Separator />

          {/* Credenciais */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">2. Credenciais da API</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSecrets(!showSecrets)}
              >
                {showSecrets ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showSecrets ? "Ocultar" : "Mostrar"}
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone_number_id">Phone Number ID *</Label>
                <Input
                  id="phone_number_id"
                  value={formData.phone_number_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone_number_id: e.target.value }))}
                  placeholder="Ex: 123456789012345"
                />
                <p className="text-xs text-muted-foreground">
                  Encontre em WhatsApp → Configuração da API → Phone Number ID
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_account_id">WhatsApp Business Account ID (opcional)</Label>
                <Input
                  id="business_account_id"
                  value={formData.business_account_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, business_account_id: e.target.value }))}
                  placeholder="Deixe em branco para detectar automaticamente"
                />
                <p className="text-xs text-muted-foreground">
                  Se não informado, será detectado automaticamente usando o Phone Number ID
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="access_token">Access Token (Permanente) *</Label>
                <Input
                  id="access_token"
                  type={showSecrets ? "text" : "password"}
                  value={formData.access_token}
                  onChange={(e) => setFormData(prev => ({ ...prev, access_token: e.target.value }))}
                  placeholder="EAAG..."
                />
                <p className="text-xs text-muted-foreground">
                  Token de acesso permanente (não use o token temporário de teste)
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="app_secret">App Secret</Label>
                <Input
                  id="app_secret"
                  type={showSecrets ? "text" : "password"}
                  value={formData.app_secret}
                  onChange={(e) => setFormData(prev => ({ ...prev, app_secret: e.target.value }))}
                  placeholder="Chave secreta do app"
                />
                <p className="text-xs text-muted-foreground">
                  Usado para validar assinaturas do webhook (recomendado para segurança)
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleSave} disabled={isSaving} className="flex-1">
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Salvar Configurações
            </Button>
            
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting || !formData.access_token}
            >
              {isTesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Testar Conexão
            </Button>

            {integration && (
              <Button variant="destructive" onClick={handleDisconnect}>
                <X className="h-4 w-4 mr-2" />
                Desconectar
              </Button>
            )}
          </div>

          <Separator />

          {/* Seção de Teste de Envio */}
          <div className="space-y-4">
            <h3 className="font-semibold">3. Testar Envio de Mensagem</h3>
            
            <Alert>
              <Send className="h-4 w-4" />
              <AlertDescription>
                Envie uma mensagem de teste para verificar se a integração está funcionando corretamente.
              </AlertDescription>
            </Alert>

            {/* Toggle: Text vs Template */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Usar Template Aprovado</p>
                  <p className="text-xs text-muted-foreground">
                    Templates são obrigatórios para iniciar conversas fora da janela de 24h
                  </p>
                </div>
              </div>
              <Switch checked={useTemplate} onCheckedChange={setUseTemplate} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="test_phone">Número de Destino</Label>
                <Input
                  id="test_phone"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="5527999400707"
                />
                <p className="text-xs text-muted-foreground">
                  Formato: código do país + DDD + número (sem espaços ou símbolos)
                </p>
              </div>

              {useTemplate ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Template de Mensagem</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => syncTemplates()}
                      disabled={isSyncing}
                      className="h-7 text-xs"
                    >
                      {isSyncing ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-1" />
                      )}
                      Sincronizar
                    </Button>
                  </div>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um template aprovado" />
                    </SelectTrigger>
                    <SelectContent>
                      {approvedTemplates.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          Nenhum template aprovado encontrado.<br />
                          Clique em "Sincronizar" para buscar.
                        </div>
                      ) : (
                        approvedTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.name}>
                            {template.name} ({template.language})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Clique em "Sincronizar" para buscar templates aprovados da sua conta Meta
                  </p>
                </div>
              ) : (
                <div className="space-y-2 md:col-span-1">
                  {/* Empty for grid alignment */}
                </div>
              )}

              {!useTemplate && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="test_message">Mensagem de Teste</Label>
                  <Textarea
                    id="test_message"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Digite sua mensagem de teste..."
                    rows={3}
                  />
                </div>
              )}
            </div>

            <Button
              onClick={handleSendTestMessage}
              disabled={isSendingTest || !formData.access_token || !formData.phone_number_id}
              className="w-full"
            >
              {isSendingTest ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {useTemplate ? "Enviar Template de Teste" : "Enviar Mensagem de Teste"}
            </Button>

            {testResult && (
              <Alert className={testResult.success ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}>
                {testResult.success ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <X className="h-4 w-4 text-red-500" />
                )}
                <AlertDescription className={testResult.success ? "text-green-200" : "text-red-200"}>
                  {testResult.message}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Separator />

          {/* Link para documentação */}
          <Alert className="bg-blue-500/10 border-blue-500/30">
            <ExternalLink className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-blue-200">
              <a 
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-blue-100"
              >
                Documentação oficial da Meta WhatsApp Cloud API →
              </a>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Instruções detalhadas */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Como Configurar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">1</div>
              <div>
                <p className="font-medium">Crie um App no Meta for Developers</p>
                <p className="text-sm text-muted-foreground">
                  Acesse <a href="https://developers.facebook.com/apps/" target="_blank" className="underline">developers.facebook.com/apps</a> e crie um app do tipo "Business"
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">2</div>
              <div>
                <p className="font-medium">Adicione o produto WhatsApp</p>
                <p className="text-sm text-muted-foreground">
                  No dashboard do app, clique em "Adicionar produtos" e selecione "WhatsApp"
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">3</div>
              <div>
                <p className="font-medium">Configure o Webhook</p>
                <p className="text-sm text-muted-foreground">
                  Em WhatsApp → Configuração, adicione a URL do webhook e o verify token gerado acima
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">4</div>
              <div>
                <p className="font-medium">Inscreva-se nos eventos</p>
                <p className="text-sm text-muted-foreground">
                  Selecione os campos "messages" e "message_template_status_update" para receber eventos
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">5</div>
              <div>
                <p className="font-medium">Gere um Token Permanente</p>
                <p className="text-sm text-muted-foreground">
                  Em Configurações → Básico → Tokens de Acesso, crie um token permanente para o app
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
