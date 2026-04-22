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
import { Loader2, Save, CreditCard, Bell, MessageSquare, FileText, CheckCircle2, Clock, XCircle, RefreshCw, Download } from "lucide-react";
import { useIntegrations } from "@/hooks/useIntegrations";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useMetaWhatsAppNumbers } from "@/hooks/useMetaWhatsAppNumbers";

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

// Mapping from reminder type to Meta template name
const REMINDER_TO_META_TEMPLATE: Record<string, string> = {
  emitted: 'cobranca_emitida',
  before_5d: 'cobranca_5dias_antes',
  due_day: 'cobranca_dia_vencimento',
  after_1d: 'cobranca_1dia_atraso',
  after_3d: 'cobranca_3dias_atraso',
  after_5d: 'cobranca_5dias_atraso',
};

const META_TEMPLATE_NAMES = Object.values(REMINDER_TO_META_TEMPLATE);

const getStatusBadge = (status: string | undefined) => {
  if (!status) return null;
  switch (status) {
    case 'APPROVED':
      return <Badge className="bg-green-500/10 text-green-600 border-green-200 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Aprovado</Badge>;
    case 'PENDING':
      return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200 text-[10px]"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    case 'REJECTED':
      return <Badge className="bg-red-500/10 text-red-600 border-red-200 text-[10px]"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }
};

export const AsaasSettings = () => {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { getIntegration, connectIntegration } = useIntegrations();
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingTemplates, setIsCreatingTemplates] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isSyncingReminders, setIsSyncingReminders] = useState(false);
  const [templateStatuses, setTemplateStatuses] = useState<Record<string, string>>({});
  const [hasUserTouchedBilling, setHasUserTouchedBilling] = useState(false);

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

  // Fetch Meta WhatsApp numbers respeitando escopo de organização e
  // restrições por membro (evita listar números de outras assinaturas).
  const { metaNumbers: scopedMetaNumbers = [] } = useMetaWhatsAppNumbers();
  const metaNumbers = scopedMetaNumbers
    .filter((n) => n.is_active)
    .map((n) => ({
      id: n.id,
      display_name: n.display_name,
      phone_number: n.phone_number,
      phone_number_id: n.phone_number_id,
      waba_id: n.waba_id,
    }));

  // Check if a Meta number is selected (not evolution)
  const isMetaSelected = metaPhoneNumberId && metaPhoneNumberId !== 'evolution';
  const selectedMetaNumber = metaNumbers.find((n: any) => n.phone_number_id === metaPhoneNumberId);
  const selectedWabaId = selectedMetaNumber?.waba_id;

  const existingAsaasIntegration = getIntegration('asaas');

  // Load existing config only when the saved integration actually changes
  useEffect(() => {
    if (!existingAsaasIntegration || hasUserTouchedBilling) return;

    const creds = existingAsaasIntegration.credentials as Record<string, string> || {};
    setAccessToken(creds.access_token || '');
    setEnvironment(creds.environment || 'production');

    const settings = existingAsaasIntegration.settings as Record<string, any> || {};
    setBillingEnabled(settings.billing_reminders_enabled || false);
    setMetaPhoneNumberId(settings.billing_meta_phone_number_id || '');

    if (settings.billing_templates) {
      setTemplates({ ...DEFAULT_TEMPLATES, ...settings.billing_templates });
    }
    if (settings.billing_enabled_types) {
      setEnabledReminders(prev => ({ ...prev, ...settings.billing_enabled_types }));
    }
  }, [existingAsaasIntegration?.id, existingAsaasIntegration?.updated_at, hasUserTouchedBilling]);

  // Auto-check template status when Meta number is selected
  useEffect(() => {
    if (isMetaSelected && selectedWabaId) {
      handleCheckStatus();
    }
  }, [metaPhoneNumberId, selectedWabaId]);

  const handleBillingEnabledChange = (checked: boolean) => {
    setHasUserTouchedBilling(true);
    setBillingEnabled(checked);
  };

  const handleToggleBillingEnabled = () => {
    setHasUserTouchedBilling(true);
    setBillingEnabled((prev) => !prev);
  };

  const handleCheckStatus = async () => {
    if (!selectedWabaId) return;
    setIsCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-billing-meta-templates', {
        body: { action: 'check_status', wabaId: selectedWabaId },
      });
      if (error) throw error;
      if (data?.statuses) {
        setTemplateStatuses(data.statuses);
      }
    } catch (err) {
      console.error('Error checking template status:', err);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleCreateTemplates = async () => {
    if (!selectedWabaId) {
      toast.error('Selecione um número Meta para criar os templates');
      return;
    }
    setIsCreatingTemplates(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-billing-meta-templates', {
        body: { action: 'create', wabaId: selectedWabaId },
      });
      if (error) throw error;
      
      if (data?.results) {
        const newStatuses: Record<string, string> = {};
        let created = 0;
        let errors = 0;
        for (const [name, result] of Object.entries(data.results as Record<string, any>)) {
          if (result.success) {
            newStatuses[name] = result.status || 'PENDING';
            created++;
          } else {
            errors++;
            console.error(`Template ${name} error:`, result.error);
          }
        }
        setTemplateStatuses(newStatuses);
        
        if (errors > 0) {
          toast.warning(`${created} templates enviados, ${errors} com erro`);
        } else {
          toast.success(`${created} templates enviados para aprovação da Meta!`);
        }
      }
    } catch (err) {
      toast.error('Erro ao criar templates');
      console.error(err);
    } finally {
      setIsCreatingTemplates(false);
    }
  };

  const handleSave = async () => {
    if (!accessToken) {
      toast.error('Informe a API Key do Asaas');
      return;
    }

    const isFirstConnection = !existingAsaasIntegration;

    // On first connection, auto-enable billing reminders with defaults
    const saveBillingEnabled = isFirstConnection ? true : billingEnabled;
    const saveTemplates = isFirstConnection && !hasUserTouchedBilling ? { ...DEFAULT_TEMPLATES } : templates;
    const saveEnabledReminders = isFirstConnection && !hasUserTouchedBilling ? {
      emitted: true,
      before_5d: true,
      due_day: true,
      after_1d: true,
      after_3d: true,
      after_5d: true,
    } : enabledReminders;

    // Auto-select first Meta number if available and none selected
    const saveMetaPhoneNumberId = isFirstConnection && !metaPhoneNumberId && metaNumbers.length > 0
      ? (metaNumbers[0] as any).phone_number_id
      : metaPhoneNumberId;

    setIsSaving(true);
    try {
      await connectIntegration.mutateAsync({
        provider: 'asaas',
        credentials: {
          access_token: accessToken,
          environment,
        },
        settings: {
          billing_reminders_enabled: saveBillingEnabled,
          billing_meta_phone_number_id: saveMetaPhoneNumberId,
          billing_templates: saveTemplates,
          billing_enabled_types: saveEnabledReminders,
        },
      });

      // Update local state to reflect auto-configured values
      if (isFirstConnection) {
        setBillingEnabled(saveBillingEnabled);
        setTemplates(saveTemplates);
        setEnabledReminders(saveEnabledReminders);
        if (saveMetaPhoneNumberId) setMetaPhoneNumberId(saveMetaPhoneNumberId);
      }

      // Auto-register webhook with Asaas API
      try {
        const { data: webhookData, error: webhookError } = await supabase.functions.invoke('register-asaas-webhook');
        if (webhookError) {
          console.error('Webhook registration error:', webhookError);
          toast.warning('Configurações salvas, mas não foi possível registrar o webhook automaticamente.');
        } else {
          console.log('Webhook registered:', webhookData?.webhookUrl);
        }
      } catch (webhookErr) {
        console.error('Webhook registration failed:', webhookErr);
      }

      toast.success(isFirstConnection 
        ? 'Asaas conectado! Lembretes de cobrança e webhook configurados automaticamente.' 
        : 'Configurações do Asaas salvas com sucesso!');
    } catch (err) {
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncExistingReminders = async () => {
    setIsSyncingReminders(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-existing-billing-reminders');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success(
        `${data.remindersCreated} lembretes criados para ${data.paymentsProcessed} cobranças` +
        (data.paymentsSkipped > 0 ? ` (${data.paymentsSkipped} sem lembretes pendentes)` : '')
      );
    } catch (err: any) {
      toast.error('Erro ao sincronizar: ' + (err.message || 'Erro desconhecido'));
      console.error('Sync error:', err);
    } finally {
      setIsSyncingReminders(false);
    }
  };

  // Count how many templates are approved
  const approvedCount = META_TEMPLATE_NAMES.filter(n => templateStatuses[n] === 'APPROVED').length;
  const allApproved = approvedCount === META_TEMPLATE_NAMES.length;

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
          <div
            className="flex items-center justify-between rounded-md"
            role="button"
            tabIndex={0}
            onClick={handleToggleBillingEnabled}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggleBillingEnabled();
              }
            }}
          >
            <div>
              <Label className="text-sm font-medium">Ativar lembretes automáticos</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Envia mensagens no WhatsApp quando cobranças são criadas e próximas do vencimento
              </p>
            </div>
            <div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <Switch checked={billingEnabled} onCheckedChange={handleBillingEnabledChange} />
            </div>
          </div>

          {billingEnabled && (
            <>
              {/* Sync existing payments button */}
              {existingAsaasIntegration && (
                <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Sincronizar cobranças existentes</p>
                    <p className="text-xs text-muted-foreground">
                      Cria lembretes para cobranças pendentes/vencidas já emitidas no Asaas
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncExistingReminders}
                    disabled={isSyncingReminders}
                  >
                    {isSyncingReminders ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                    {isSyncingReminders ? 'Sincronizando...' : 'Sincronizar'}
                  </Button>
                </div>
              )}

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
                        {num.phone_number} - {num.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Escolha o número oficial da Meta ou WhatsApp Lite para enviar os lembretes
                </p>
              </div>

              {/* Meta Templates Section - only show when Meta number selected */}
              {isMetaSelected && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="flex items-center gap-2 text-sm font-medium">
                          <FileText className="h-4 w-4" />
                          Templates Oficiais Meta
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Templates precisam ser aprovados pela Meta para envio fora da janela de 24h
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCheckStatus}
                          disabled={isCheckingStatus}
                        >
                          {isCheckingStatus ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          <span className="ml-1">Atualizar</span>
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleCreateTemplates}
                          disabled={isCreatingTemplates || allApproved}
                        >
                          {isCreatingTemplates ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <FileText className="h-3 w-3 mr-1" />}
                          {allApproved ? 'Todos aprovados' : 'Criar Templates'}
                        </Button>
                      </div>
                    </div>

                    {/* Template status list */}
                    <div className="rounded-md border">
                      {Object.entries(REMINDER_TO_META_TEMPLATE).map(([reminderType, templateName], idx) => (
                        <div
                          key={templateName}
                          className={`flex items-center justify-between px-4 py-2.5 text-sm ${idx < Object.keys(REMINDER_TO_META_TEMPLATE).length - 1 ? 'border-b' : ''}`}
                        >
                          <span className="text-muted-foreground">{REMINDER_LABELS[reminderType]}</span>
                          <div className="flex items-center gap-2">
                            <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{templateName}</code>
                            {getStatusBadge(templateStatuses[templateName])}
                            {!templateStatuses[templateName] && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">Não criado</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {approvedCount > 0 && !allApproved && (
                      <p className="text-xs text-muted-foreground">
                        {approvedCount} de {META_TEMPLATE_NAMES.length} templates aprovados. Templates pendentes serão enviados como texto quando possível.
                      </p>
                    )}
                  </div>
                </>
              )}

              <Separator />

              {/* Template Configuration - only for Evolution or fallback text */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {isMetaSelected ? 'Templates de Texto (fallback)' : 'Templates de Mensagem'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isMetaSelected 
                    ? 'Usados como fallback quando o template Meta não está aprovado'
                    : <>Variáveis disponíveis: <code className="bg-muted px-1 rounded">{'{nome}'}</code>{' '}
                      <code className="bg-muted px-1 rounded">{'{valor}'}</code>{' '}
                      <code className="bg-muted px-1 rounded">{'{data}'}</code>{' '}
                      <code className="bg-muted px-1 rounded">{'{url}'}</code></>
                  }
                </p>
              </div>

              <Accordion type="multiple" className="w-full">
                {Object.entries(REMINDER_LABELS).map(([type, label]) => (
                  <AccordionItem key={type} value={type}>
                    <AccordionTrigger className="text-sm">
                      <div className="flex items-center gap-3">
                        <div
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          onPointerUp={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <Switch
                            checked={enabledReminders[type]}
                            onCheckedChange={(checked) => {
                              setEnabledReminders(prev => ({ ...prev, [type]: checked }));
                            }}
                          />
                        </div>
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
