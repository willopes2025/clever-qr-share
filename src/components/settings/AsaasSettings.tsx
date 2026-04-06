import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, Save, CreditCard, Bell, MessageSquare } from "lucide-react";
import { useIntegrations } from "@/hooks/useIntegrations";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

const DEFAULT_TEMPLATES: Record<string, string> = {
  emitted: 'Olá {nome}! 😊 Sua cobrança de R${valor} foi gerada.\n\n📅 Vencimento: {data}\n🔗 Link para pagamento: {url}',
  before_5d: '⏰ Lembrete: sua cobrança de R${valor} vence em 5 dias ({data}).\n\n🔗 Link para pagamento: {url}',
  due_day: '📢 Hoje é o vencimento da sua cobrança de R${valor}. Evite juros!\n\n🔗 Pague agora: {url}',
  after_1d: '⚠️ Sua cobrança de R${valor} venceu ontem ({data}).\n\n🔗 Regularize aqui: {url}',
  after_3d: '⚠️ Cobrança de R${valor} em atraso há 3 dias (vencimento: {data}).\n\n🔗 Link para pagamento: {url}',
  after_5d: '🚨 Último lembrete: cobrança de R${valor} em atraso (vencimento: {data}).\n\nEntre em contato para regularizar.\n🔗 {url}',
};

const REMINDER_LABELS: Record<string, string> = {
  emitted: '📄 Boleto emitido',
  before_5d: '⏰ 5 dias antes do vencimento',
  due_day: '📢 No dia do vencimento',
  after_1d: '⚠️ 1 dia após o vencimento',
  after_3d: '⚠️ 3 dias após o vencimento',
  after_5d: '🚨 5 dias após o vencimento',
};

export const AsaasSettings = () => {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { getIntegration, connectIntegration } = useIntegrations();
  const [isSaving, setIsSaving] = useState(false);

  // Credentials
  const [accessToken, setAccessToken] = useState('');
  const [environment, setEnvironment] = useState('production');

  // Billing reminder settings
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState('');
  const [templates, setTemplates] = useState<Record<string, string>>({ ...DEFAULT_TEMPLATES });
  const [enabledReminders, setEnabledReminders] = useState<Record<string, boolean>>({
    emitted: true,
    before_5d: true,
    due_day: true,
    after_1d: true,
    after_3d: true,
    after_5d: true,
  });

  const targetUserId = organization?.owner_id || user?.id;

  // Fetch Meta WhatsApp numbers
  const { data: metaNumbers = [] } = useQuery({
    queryKey: ['meta-numbers-for-asaas', targetUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from('meta_whatsapp_numbers')
        .select('id, display_phone_number, verified_name, phone_number_id')
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!targetUserId,
  });

  // Load existing config
  useEffect(() => {
    const existing = getIntegration('asaas');
    if (existing) {
      const creds = existing.credentials as Record<string, string> || {};
      setAccessToken(creds.access_token || '');
      setEnvironment(creds.environment || 'production');

      const settings = existing.settings as Record<string, any> || {};
      setBillingEnabled(settings.billing_reminders_enabled || false);
      setMetaPhoneNumberId(settings.billing_meta_phone_number_id || '');
      
      if (settings.billing_templates) {
        setTemplates({ ...DEFAULT_TEMPLATES, ...settings.billing_templates });
      }
      if (settings.billing_enabled_types) {
        setEnabledReminders(prev => ({ ...prev, ...settings.billing_enabled_types }));
      }
    }
  }, [getIntegration]);

  const handleSave = async () => {
    if (!accessToken) {
      toast.error('Informe a API Key do Asaas');
      return;
    }

    setIsSaving(true);
    try {
      await connectIntegration.mutateAsync({
        provider: 'asaas',
        credentials: {
          access_token: accessToken,
          environment,
        },
        settings: {
          billing_reminders_enabled: billingEnabled,
          billing_meta_phone_number_id: metaPhoneNumberId,
          billing_templates: templates,
          billing_enabled_types: enabledReminders,
        },
      });
      toast.success('Configurações do Asaas salvas com sucesso!');
    } catch (err) {
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Credenciais do Asaas
          </CardTitle>
          <CardDescription>
            Chave de API para conectar com sua conta Asaas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Chave de produção do Asaas"
            />
            <p className="text-xs text-muted-foreground">
              Encontre em: Asaas → Minha Conta → Integrações
            </p>
          </div>
          <div className="space-y-2">
            <Label>Ambiente</Label>
            <Select value={environment} onValueChange={setEnvironment}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Produção</SelectItem>
                <SelectItem value="sandbox">Sandbox</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Billing Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Lembretes de Cobrança via WhatsApp
          </CardTitle>
          <CardDescription>
            Envie mensagens automáticas para clientes sobre cobranças do Asaas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Ativar lembretes automáticos</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Envia mensagens no WhatsApp quando cobranças são criadas e próximas do vencimento
              </p>
            </div>
            <Switch checked={billingEnabled} onCheckedChange={setBillingEnabled} />
          </div>

          {billingEnabled && (
            <>
              <Separator />
              
              {/* Meta Phone Number Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Número do WhatsApp para envio
                </Label>
                <Select value={metaPhoneNumberId} onValueChange={setMetaPhoneNumberId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o número Meta..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="evolution">
                      WhatsApp Lite (Evolution API)
                    </SelectItem>
                    {metaNumbers.map((num: any) => (
                      <SelectItem key={num.phone_number_id} value={num.phone_number_id}>
                        {num.display_phone_number} - {num.verified_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Escolha o número oficial da Meta ou WhatsApp Lite para enviar os lembretes
                </p>
              </div>

              <Separator />

              {/* Template Configuration */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Templates de Mensagem</Label>
                <p className="text-xs text-muted-foreground">
                  Variáveis disponíveis: <code className="bg-muted px-1 rounded">{'{nome}'}</code>{' '}
                  <code className="bg-muted px-1 rounded">{'{valor}'}</code>{' '}
                  <code className="bg-muted px-1 rounded">{'{data}'}</code>{' '}
                  <code className="bg-muted px-1 rounded">{'{url}'}</code>
                </p>
              </div>

              <Accordion type="multiple" className="w-full">
                {Object.entries(REMINDER_LABELS).map(([type, label]) => (
                  <AccordionItem key={type} value={type}>
                    <AccordionTrigger className="text-sm">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={enabledReminders[type]}
                          onCheckedChange={(checked) => {
                            setEnabledReminders(prev => ({ ...prev, [type]: checked }));
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className={!enabledReminders[type] ? 'text-muted-foreground' : ''}>
                          {label}
                        </span>
                        {!enabledReminders[type] && (
                          <Badge variant="outline" className="text-[10px]">Desativado</Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Textarea
                        value={templates[type] || ''}
                        onChange={(e) => setTemplates(prev => ({ ...prev, [type]: e.target.value }))}
                        rows={4}
                        className="text-sm"
                        disabled={!enabledReminders[type]}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-xs"
                        onClick={() => setTemplates(prev => ({ ...prev, [type]: DEFAULT_TEMPLATES[type] }))}
                      >
                        Restaurar padrão
                      </Button>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
};
