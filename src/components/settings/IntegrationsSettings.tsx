import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileSpreadsheet,
  CreditCard,
  ShoppingCart,
  Users,
  Zap,
  BarChart3,
  Calendar,
  Link2,
  Check,
  X,
  ExternalLink,
  Loader2,
  Search,
  Crown,
  Phone,
} from "lucide-react";
import { useIntegrations, IntegrationProvider } from "@/hooks/useIntegrations";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface IntegrationConfig {
  id: IntegrationProvider;
  name: string;
  description: string;
  icon: React.ElementType;
  category: 'productivity' | 'payments' | 'ecommerce' | 'crm' | 'automation' | 'analytics' | 'voip';
  minPlan: 'essencial' | 'profissional' | 'agencia' | 'avancado';
  fields: {
    key: string;
    label: string;
    type: 'text' | 'password' | 'url';
    placeholder?: string;
    helpText?: string;
  }[];
  docsUrl?: string;
}

const integrationConfigs: IntegrationConfig[] = [
  // Productivity
  {
    id: 'google_sheets',
    name: 'Google Sheets',
    description: 'Exporte contatos e leads automaticamente para planilhas',
    icon: FileSpreadsheet,
    category: 'productivity',
    minPlan: 'essencial',
    fields: [
      { key: 'spreadsheet_id', label: 'ID da Planilha', type: 'text', placeholder: 'Ex: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms' },
      { key: 'api_key', label: 'Chave da API', type: 'password', helpText: 'Crie uma chave em console.cloud.google.com' },
    ],
    docsUrl: 'https://developers.google.com/sheets/api/quickstart/js',
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Sincronize agendamentos e eventos automaticamente',
    icon: Calendar,
    category: 'productivity',
    minPlan: 'profissional',
    fields: [
      { key: 'calendar_id', label: 'ID do Calendário', type: 'text', placeholder: 'primary ou email do calendário' },
      { key: 'api_key', label: 'Chave da API', type: 'password' },
    ],
    docsUrl: 'https://developers.google.com/calendar/api/quickstart/js',
  },
  // Payments
  {
    id: 'mercado_pago',
    name: 'Mercado Pago',
    description: 'Crie links de pagamento e receba notificações',
    icon: CreditCard,
    category: 'payments',
    minPlan: 'profissional',
    fields: [
      { key: 'access_token', label: 'Access Token', type: 'password', helpText: 'Token de produção do Mercado Pago' },
      { key: 'public_key', label: 'Public Key', type: 'text' },
    ],
    docsUrl: 'https://www.mercadopago.com.br/developers/pt/docs',
  },
  // E-commerce / Infoprodutos
  {
    id: 'hotmart',
    name: 'Hotmart',
    description: 'Automação para vendas e boas-vindas de infoprodutos',
    icon: ShoppingCart,
    category: 'ecommerce',
    minPlan: 'profissional',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text' },
      { key: 'client_secret', label: 'Client Secret', type: 'password' },
      { key: 'basic_auth', label: 'Basic Auth Token', type: 'password' },
    ],
    docsUrl: 'https://developers.hotmart.com/docs/pt-BR/',
  },
  {
    id: 'eduzz',
    name: 'Eduzz',
    description: 'Integre vendas da Eduzz com automações de WhatsApp',
    icon: ShoppingCart,
    category: 'ecommerce',
    minPlan: 'profissional',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'public_key', label: 'Public Key', type: 'text' },
    ],
    docsUrl: 'https://developers.eduzz.com/',
  },
  {
    id: 'kiwify',
    name: 'Kiwify',
    description: 'Receba notificações de vendas e abandono de carrinho',
    icon: ShoppingCart,
    category: 'ecommerce',
    minPlan: 'profissional',
    fields: [
      { key: 'api_token', label: 'Token da API', type: 'password' },
    ],
    docsUrl: 'https://kiwify.com.br/',
  },
  // CRM
  {
    id: 'rd_station',
    name: 'RD Station',
    description: 'Sincronize leads e dispare automações de marketing',
    icon: Users,
    category: 'crm',
    minPlan: 'profissional',
    fields: [
      { key: 'api_token', label: 'Token da API', type: 'password' },
      { key: 'client_id', label: 'Client ID (opcional)', type: 'text' },
      { key: 'client_secret', label: 'Client Secret (opcional)', type: 'password' },
    ],
    docsUrl: 'https://developers.rdstation.com/pt-BR/',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Integre seu CRM HubSpot com WhatsApp',
    icon: Users,
    category: 'crm',
    minPlan: 'agencia',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password' },
    ],
    docsUrl: 'https://developers.hubspot.com/',
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    description: 'Sincronize deals e contatos do Pipedrive',
    icon: Users,
    category: 'crm',
    minPlan: 'agencia',
    fields: [
      { key: 'api_token', label: 'API Token', type: 'password' },
      { key: 'company_domain', label: 'Domínio da Empresa', type: 'text', placeholder: 'sua-empresa' },
    ],
    docsUrl: 'https://developers.pipedrive.com/',
  },
  // Automation
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Conecte com milhares de apps via webhooks',
    icon: Zap,
    category: 'automation',
    minPlan: 'profissional',
    fields: [
      { key: 'webhook_url', label: 'URL do Webhook', type: 'url', placeholder: 'https://hooks.zapier.com/...' },
    ],
    docsUrl: 'https://zapier.com/apps/webhook/integrations',
  },
  {
    id: 'make',
    name: 'Make (Integromat)',
    description: 'Automações visuais com centenas de integrações',
    icon: Link2,
    category: 'automation',
    minPlan: 'profissional',
    fields: [
      { key: 'webhook_url', label: 'URL do Webhook', type: 'url', placeholder: 'https://hook.make.com/...' },
    ],
    docsUrl: 'https://www.make.com/en/help/tools/webhooks',
  },
  {
    id: 'n8n',
    name: 'n8n',
    description: 'Automações self-hosted com controle total',
    icon: Link2,
    category: 'automation',
    minPlan: 'profissional',
    fields: [
      { key: 'webhook_url', label: 'URL do Webhook', type: 'url', placeholder: 'https://seu-n8n.com/webhook/...' },
    ],
    docsUrl: 'https://docs.n8n.io/',
  },
  // Analytics
  {
    id: 'facebook_pixel',
    name: 'Facebook Pixel',
    description: 'Rastreie conversões e crie audiências',
    icon: BarChart3,
    category: 'analytics',
    minPlan: 'profissional',
    fields: [
      { key: 'pixel_id', label: 'Pixel ID', type: 'text' },
      { key: 'access_token', label: 'Access Token (Conversions API)', type: 'password' },
    ],
    docsUrl: 'https://developers.facebook.com/docs/meta-pixel/',
  },
  {
    id: 'google_analytics',
    name: 'Google Analytics',
    description: 'Envie eventos de conversão para o GA4',
    icon: BarChart3,
    category: 'analytics',
    minPlan: 'profissional',
    fields: [
      { key: 'measurement_id', label: 'Measurement ID', type: 'text', placeholder: 'G-XXXXXXXXXX' },
      { key: 'api_secret', label: 'API Secret', type: 'password' },
    ],
    docsUrl: 'https://developers.google.com/analytics/devguides/collection/ga4',
  },
  // VoIP
  {
    id: 'vono_voip',
    name: 'Vono VoIP',
    description: 'Faça ligações Click-to-Call direto do Inbox com IA',
    icon: Phone,
    category: 'voip',
    minPlan: 'profissional',
    fields: [
      { key: 'domain', label: 'Domínio', type: 'text', placeholder: 'vono.me ou vono3.me' },
      { key: 'api_token', label: 'API Token', type: 'password', helpText: 'Token da API Vono' },
      { key: 'api_key', label: 'API Key', type: 'password', helpText: 'Chave da API Vono' },
      { key: 'default_device_id', label: 'ID da Linha (numérico)', type: 'text', placeholder: 'Ex: 1, 2, 3...', helpText: 'ID numérico da linha no painel PABX Vono (Configurações > Linhas)' },
      { key: 'default_src_number', label: 'Número de Origem', type: 'text', placeholder: '5511999999999' },
    ],
    docsUrl: 'https://ajuda.falevono.com.br/api-click-to-call-0800-web/',
  },
];

const categoryLabels: Record<string, string> = {
  all: 'Todas',
  productivity: 'Produtividade',
  payments: 'Pagamentos',
  ecommerce: 'E-commerce',
  crm: 'CRM',
  automation: 'Automação',
  analytics: 'Analytics',
  voip: 'VoIP',
};

const planLabels: Record<string, string> = {
  essencial: 'Essencial',
  profissional: 'Profissional',
  agencia: 'Agência',
  avancado: 'Avançado',
};

const planHierarchy = ['essencial', 'profissional', 'agencia', 'avancado'];

export const IntegrationsSettings = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [configDialog, setConfigDialog] = useState<IntegrationConfig | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const { integrations, isLoading, connectIntegration, disconnectIntegration, getIntegration } = useIntegrations();
  const { subscription } = useSubscription();

  const currentPlan = subscription?.plan || 'essencial';
  const currentPlanIndex = planHierarchy.indexOf(currentPlan);

  const hasAccessToPlan = (minPlan: string) => {
    const minPlanIndex = planHierarchy.indexOf(minPlan);
    return currentPlanIndex >= minPlanIndex;
  };

  const filteredIntegrations = integrationConfigs.filter(config => {
    const matchesCategory = selectedCategory === 'all' || config.category === selectedCategory;
    const matchesSearch = config.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          config.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleOpenConfig = (config: IntegrationConfig) => {
    const existing = getIntegration(config.id);
    if (existing) {
      setFormData(existing.credentials as Record<string, string> || {});
    } else {
      setFormData({});
    }
    setConfigDialog(config);
  };

  const handleSaveConfig = async () => {
    if (!configDialog) return;
    
    setIsSaving(true);
    try {
      await connectIntegration.mutateAsync({
        provider: configDialog.id,
        credentials: formData,
        settings: {},
      });
      setConfigDialog(null);
      setFormData({});
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async (config: IntegrationConfig) => {
    const existing = getIntegration(config.id);
    if (existing) {
      await disconnectIntegration.mutateAsync(existing.id);
    }
  };

  // Validate if device_id looks like a numeric ID
  const validateDeviceId = (deviceId: string): boolean => {
    if (!deviceId) return true; // Empty is ok, will be validated on save
    const numericPattern = /^\d+$/;
    return numericPattern.test(deviceId.trim());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl">Integrações Nativas</CardTitle>
          <CardDescription>
            Conecte suas ferramentas favoritas para automatizar seu fluxo de trabalho
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar integração..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-6">
            <TabsList className="flex flex-wrap h-auto gap-1 bg-secondary/50 p-1">
              {Object.entries(categoryLabels).map(([key, label]) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="text-xs sm:text-sm data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Integrations Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredIntegrations.map((config) => {
              const Icon = config.icon;
              const isConnected = !!getIntegration(config.id)?.is_active;
              const hasAccess = hasAccessToPlan(config.minPlan);

              return (
                <Card 
                  key={config.id} 
                  className={`relative overflow-hidden transition-all hover:border-primary/40 ${
                    isConnected ? 'border-accent/50 bg-accent/5' : 'border-border/50'
                  } ${!hasAccess ? 'opacity-60' : ''}`}
                >
                  {/* Plan Badge */}
                  {config.minPlan !== 'essencial' && (
                    <Badge 
                      variant="outline" 
                      className="absolute top-3 right-3 text-[10px] border-primary/30 text-primary"
                    >
                      <Crown className="h-3 w-3 mr-1" />
                      {planLabels[config.minPlan]}+
                    </Badge>
                  )}

                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${isConnected ? 'bg-accent/20' : 'bg-secondary'}`}>
                        <Icon className={`h-5 w-5 ${isConnected ? 'text-accent' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm truncate">{config.name}</h3>
                          {isConnected && (
                            <Check className="h-4 w-4 text-accent flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {config.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isConnected ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs"
                            onClick={() => handleOpenConfig(config)}
                          >
                            Configurar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-destructive hover:text-destructive"
                            onClick={() => handleDisconnect(config)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : hasAccess ? (
                        <Button
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => handleOpenConfig(config)}
                        >
                          Conectar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs"
                          disabled
                        >
                          Upgrade Necessário
                        </Button>
                      )}
                      {config.docsUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => window.open(config.docsUrl, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredIntegrations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma integração encontrada para sua busca.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Dialog */}
      <Dialog open={!!configDialog} onOpenChange={() => setConfigDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {configDialog && <configDialog.icon className="h-5 w-5" />}
              Configurar {configDialog?.name}
            </DialogTitle>
            <DialogDescription>
              Preencha as credenciais para conectar sua conta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {configDialog?.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                
                {/* Special handling for VoIP device_id field with help text */}
                {configDialog.id === 'vono_voip' && field.key === 'default_device_id' ? (
                  <div className="space-y-2">
                    <Input
                      id={field.key}
                      type={field.type}
                      placeholder={field.placeholder}
                      value={formData[field.key] || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData(prev => ({ ...prev, [field.key]: value }));
                        // Warn if value doesn't look numeric
                        if (value && !validateDeviceId(value)) {
                          toast.warning('O ID da linha deve ser numérico (ex: 1, 2, 3). Verifique no painel PABX Vono.');
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      💡 <strong>Como encontrar:</strong> Acesse o painel PABX Vono (meuvono.falevono.com.br) → Configurações → Linhas → Anote o <strong>ID numérico</strong> da linha desejada.
                    </p>
                  </div>
                ) : (
                  <Input
                    id={field.key}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                  />
                )}
                
                {field.helpText && (
                  <p className="text-xs text-muted-foreground">{field.helpText}</p>
                )}
              </div>
            ))}

            {configDialog?.docsUrl && (
              <a
                href={configDialog.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Ver documentação
              </a>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveConfig} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
