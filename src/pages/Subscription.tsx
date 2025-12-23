import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  CreditCard, 
  Crown, 
  Zap, 
  Rocket, 
  Check, 
  ArrowUpRight, 
  Download, 
  ExternalLink,
  RefreshCw,
  Calendar,
  Receipt,
  ArrowLeftRight,
  X
} from "lucide-react";
import { useSubscription, PLANS } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: string;
  created: string;
  period_start: string | null;
  period_end: string | null;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
}

const planIcons = {
  free: Zap,
  starter: Zap,
  pro: Crown,
  business: Rocket,
};

const planColors = {
  free: "text-muted-foreground",
  starter: "text-primary",
  pro: "text-neon-magenta",
  business: "text-neon-green",
};

const Subscription = () => {
  const { subscription, loading, checkSubscription, createCheckout, openCustomerPortal, currentPlan, isSubscribed } = useSubscription();
  const { session } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState<string | null>(null);

  const openPortalWithFlow = async (flow: 'cancel' | 'update_plan' | 'payment_method') => {
    if (!session?.access_token) {
      toast.error("Você precisa estar logado");
      return;
    }
    
    setPortalLoading(flow);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        body: { flow },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      toast.error("Erro ao abrir o portal de gerenciamento");
    } finally {
      setPortalLoading(null);
    }
  };

  const fetchInvoices = async () => {
    if (!session?.access_token) return;
    
    setInvoicesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-invoices', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) throw error;
      setInvoices(data?.invoices || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setInvoicesLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [session?.access_token]);

  const handleUpgrade = async (plan: 'starter' | 'pro' | 'business') => {
    setUpgradeLoading(plan);
    try {
      await createCheckout(plan);
    } finally {
      setUpgradeLoading(null);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-neon-green/20 text-neon-green border-neon-green/30">Pago</Badge>;
      case 'open':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Pendente</Badge>;
      case 'void':
        return <Badge className="bg-muted text-muted-foreground">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const PlanIcon = planIcons[currentPlan as keyof typeof planIcons] || Zap;

  return (
    <DashboardLayout className="p-8 cyber-grid">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold mb-2 text-glow-cyan">Assinatura</h1>
        <p className="text-muted-foreground">
          Gerencie seu plano e visualize o histórico de faturas
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Current Plan Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="lg:col-span-2"
        >
          <Card className="glass-card neon-border h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center bg-gradient-neon shadow-glow-cyan`}>
                  <PlanIcon className="h-6 w-6 text-background" />
                </div>
                <div>
                  <span className="text-2xl">Plano {PLANS[currentPlan as keyof typeof PLANS]?.name || 'Gratuito'}</span>
                  {isSubscribed && (
                    <Badge className="ml-3 bg-neon-green/20 text-neon-green border-neon-green/30">Ativo</Badge>
                  )}
                </div>
              </CardTitle>
              <CardDescription>
                {isSubscribed 
                  ? `Sua assinatura está ativa até ${subscription?.subscription_end ? format(new Date(subscription.subscription_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'renovação automática'}`
                  : 'Você não possui uma assinatura ativa'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-36" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Current plan features */}
                  {isSubscribed && PLANS[currentPlan as keyof typeof PLANS] && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-3">Incluído no seu plano:</p>
                      <ul className="grid sm:grid-cols-2 gap-2">
                        {PLANS[currentPlan as keyof typeof PLANS].features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-neon-green" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Usage stats */}
                  <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t border-border/50">
                    <div className="p-4 rounded-lg bg-secondary/30">
                      <p className="text-sm text-muted-foreground">Instâncias</p>
                      <p className="text-2xl font-display font-bold text-primary">
                        {subscription?.max_instances === null ? 'Ilimitadas' : `${subscription?.max_instances || 0}`}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/30">
                      <p className="text-sm text-muted-foreground">Mensagens/mês</p>
                      <p className="text-2xl font-display font-bold text-primary">
                        {subscription?.max_messages === null ? 'Ilimitadas' : `${subscription?.max_messages || 0}`}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/30">
                      <p className="text-sm text-muted-foreground">Contatos</p>
                      <p className="text-2xl font-display font-bold text-primary">
                        {subscription?.max_contacts === null ? 'Ilimitados' : `${subscription?.max_contacts || 0}`}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3 pt-4">
                    {isSubscribed && (
                      <>
                        {/* Trocar Plano */}
                        <Button 
                          onClick={() => openPortalWithFlow('update_plan')} 
                          variant="outline" 
                          className="neon-border"
                          disabled={portalLoading === 'update_plan'}
                        >
                          {portalLoading === 'update_plan' ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <ArrowLeftRight className="h-4 w-4 mr-2" />
                          )}
                          Trocar Plano
                        </Button>
                        
                        {/* Atualizar Cartão */}
                        <Button 
                          onClick={() => openPortalWithFlow('payment_method')} 
                          variant="outline"
                          disabled={portalLoading === 'payment_method'}
                        >
                          {portalLoading === 'payment_method' ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CreditCard className="h-4 w-4 mr-2" />
                          )}
                          Atualizar Cartão
                        </Button>
                        
                        {/* Cancelar Assinatura */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={portalLoading === 'cancel'}
                            >
                              {portalLoading === 'cancel' ? (
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <X className="h-4 w-4 mr-2" />
                              )}
                              Cancelar Assinatura
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Sua assinatura continuará ativa até o final do período atual 
                                ({subscription?.subscription_end ? format(new Date(subscription.subscription_end), "dd/MM/yyyy") : 'data de renovação'}). 
                                Após isso, você será movido para o plano gratuito com limites reduzidos.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Voltar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => openPortalWithFlow('cancel')}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Sim, cancelar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                    <Button onClick={() => checkSubscription()} variant="ghost" size="icon">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="glass-card h-full">
            <CardHeader>
              <CardTitle className="text-lg">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <span className="text-sm text-muted-foreground">Plano</span>
                <span className={`font-semibold ${planColors[currentPlan as keyof typeof planColors] || 'text-foreground'}`}>
                  {PLANS[currentPlan as keyof typeof PLANS]?.name || 'Gratuito'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <span className="text-sm text-muted-foreground">Valor mensal</span>
                <span className="font-semibold">
                  {isSubscribed ? `R$${PLANS[currentPlan as keyof typeof PLANS]?.price || 0}` : 'R$0'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <span className="text-sm text-muted-foreground">Status</span>
                {isSubscribed ? (
                  <Badge className="bg-neon-green/20 text-neon-green border-neon-green/30">Ativo</Badge>
                ) : (
                  <Badge variant="outline">Inativo</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Upgrade Options */}
      {currentPlan !== 'business' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="text-xl font-display font-bold mb-4">Fazer Upgrade</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {Object.entries(PLANS)
              .filter(([key]) => key !== 'free') // Don't show free plan in upgrade options
              .map(([key, plan]) => {
              const isCurrentPlan = key === currentPlan;
              const PIcon = planIcons[key as keyof typeof planIcons] || Zap;
              
              return (
                <Card 
                  key={key} 
                  className={`glass-card transition-all duration-300 ${
                    isCurrentPlan ? 'ring-2 ring-primary' : 'hover:shadow-glow-cyan'
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        isCurrentPlan ? 'bg-gradient-neon' : 'bg-secondary'
                      }`}>
                        <PIcon className={`h-5 w-5 ${isCurrentPlan ? 'text-background' : 'text-primary'}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{plan.name}</h3>
                        <p className="text-2xl font-display font-bold">R${plan.price}<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-4">
                      {plan.maxInstances === null ? 'Instâncias ilimitadas' : `Até ${plan.maxInstances} instância${plan.maxInstances > 1 ? 's' : ''}`}
                      {plan.maxMessages === null ? ' • Mensagens ilimitadas' : ` • ${plan.maxMessages} msgs/mês`}
                    </p>

                    <Button 
                      onClick={() => handleUpgrade(key as 'starter' | 'pro' | 'business')}
                      disabled={isCurrentPlan || upgradeLoading === key}
                      className={`w-full ${
                        isCurrentPlan 
                          ? 'bg-neon-green/20 text-neon-green border border-neon-green/30' 
                          : 'bg-gradient-neon text-background'
                      }`}
                    >
                      {upgradeLoading === key ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : isCurrentPlan ? (
                        'Plano Atual'
                      ) : (
                        <>
                          <ArrowUpRight className="h-4 w-4 mr-2" />
                          Assinar
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Invoice History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Histórico de Faturas
          </h2>
          <Button onClick={fetchInvoices} variant="ghost" size="sm">
            <RefreshCw className={`h-4 w-4 ${invoicesLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        <Card className="glass-card">
          <CardContent className="p-0">
            {invoicesLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-12 text-center">
                <Receipt className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhuma fatura encontrada</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="p-4 flex items-center justify-between hover:bg-secondary/20 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-secondary/50 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{invoice.number || 'Fatura'}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(invoice.created), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(invoice.amount, invoice.currency)}</p>
                        {getStatusBadge(invoice.status)}
                      </div>
                      
                      <div className="flex gap-2">
                        {invoice.invoice_pdf && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => window.open(invoice.invoice_pdf!, '_blank')}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {invoice.hosted_invoice_url && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => window.open(invoice.hosted_invoice_url!, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
};

export default Subscription;