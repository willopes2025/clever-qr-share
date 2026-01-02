import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsaas, AsaasCustomer, AsaasPayment, AsaasSubscription } from "@/hooks/useAsaas";
import { 
  User, Mail, Phone, MapPin, FileText, CreditCard, 
  ExternalLink, Copy, Loader2, Plus, RefreshCw,
  Calendar, DollarSign, AlertCircle, CheckCircle, Clock
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AsaasCustomerDetailProps {
  customer: AsaasCustomer;
  onClose: () => void;
  onCreatePayment?: (customerId: string) => void;
}

const getPaymentStatusBadge = (status: AsaasPayment['status']) => {
  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    PENDING: { label: 'Pendente', variant: 'secondary' },
    RECEIVED: { label: 'Recebido', variant: 'default' },
    CONFIRMED: { label: 'Confirmado', variant: 'default' },
    OVERDUE: { label: 'Vencido', variant: 'destructive' },
    REFUNDED: { label: 'Reembolsado', variant: 'outline' },
    RECEIVED_IN_CASH: { label: 'Recebido em Dinheiro', variant: 'default' },
    REFUND_REQUESTED: { label: 'Reembolso Solicitado', variant: 'outline' },
    CHARGEBACK_REQUESTED: { label: 'Chargeback', variant: 'destructive' },
    CHARGEBACK_DISPUTE: { label: 'Disputa', variant: 'destructive' },
    AWAITING_CHARGEBACK_REVERSAL: { label: 'Aguardando Reversão', variant: 'outline' },
    DUNNING_REQUESTED: { label: 'Cobrança Solicitada', variant: 'secondary' },
    DUNNING_RECEIVED: { label: 'Cobrança Recebida', variant: 'default' },
    AWAITING_RISK_ANALYSIS: { label: 'Análise de Risco', variant: 'outline' },
  };
  
  const config = statusConfig[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const getBillingTypeBadge = (type: string) => {
  const typeConfig: Record<string, { label: string; icon: React.ReactNode }> = {
    PIX: { label: 'PIX', icon: <DollarSign className="h-3 w-3" /> },
    BOLETO: { label: 'Boleto', icon: <FileText className="h-3 w-3" /> },
    CREDIT_CARD: { label: 'Cartão', icon: <CreditCard className="h-3 w-3" /> },
    UNDEFINED: { label: 'Indefinido', icon: null },
  };
  
  const config = typeConfig[type] || { label: type, icon: null };
  return (
    <Badge variant="outline" className="gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
};

export const AsaasCustomerDetail = ({ customer, onClose, onCreatePayment }: AsaasCustomerDetailProps) => {
  const { getCustomerPayments, getCustomerSubscriptions } = useAsaas();
  const [payments, setPayments] = useState<AsaasPayment[]>([]);
  const [subscriptions, setSubscriptions] = useState<AsaasSubscription[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState(true);

  const loadPayments = async () => {
    setIsLoadingPayments(true);
    try {
      const result = await getCustomerPayments(customer.id);
      setPayments(result?.data || []);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast.error('Erro ao carregar cobranças');
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const loadSubscriptions = async () => {
    setIsLoadingSubscriptions(true);
    try {
      const result = await getCustomerSubscriptions(customer.id);
      setSubscriptions(result?.data || []);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    } finally {
      setIsLoadingSubscriptions(false);
    }
  };

  useEffect(() => {
    loadPayments();
    loadSubscriptions();
  }, [customer.id]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  // Estatísticas rápidas
  const pendingPayments = payments.filter(p => p.status === 'PENDING').length;
  const overduePayments = payments.filter(p => p.status === 'OVERDUE').length;
  const receivedPayments = payments.filter(p => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status)).length;
  const totalReceived = payments
    .filter(p => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status))
    .reduce((sum, p) => sum + p.value, 0);

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl p-0">
        <SheetHeader className="p-6 border-b">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl">{customer.name}</SheetTitle>
              {customer.cpfCnpj && (
                <p className="text-sm text-muted-foreground mt-1">{customer.cpfCnpj}</p>
              )}
            </div>
            {onCreatePayment && (
              <Button size="sm" onClick={() => onCreatePayment(customer.id)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Cobrança
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)]">
          <div className="p-6 space-y-6">
            {/* Cards de Estatísticas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Pendentes</p>
                    <p className="text-lg font-semibold">{pendingPayments}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-xs text-muted-foreground">Vencidos</p>
                    <p className="text-lg font-semibold">{overduePayments}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Recebidos</p>
                    <p className="text-lg font-semibold">{receivedPayments}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-sm font-semibold">{formatCurrency(totalReceived)}</p>
                  </div>
                </div>
              </Card>
            </div>

            <Tabs defaultValue="payments" className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="payments">
                  <FileText className="h-4 w-4 mr-2" />
                  Cobranças ({payments.length})
                </TabsTrigger>
                <TabsTrigger value="subscriptions">
                  <Calendar className="h-4 w-4 mr-2" />
                  Assinaturas ({subscriptions.length})
                </TabsTrigger>
                <TabsTrigger value="info">
                  <User className="h-4 w-4 mr-2" />
                  Dados
                </TabsTrigger>
              </TabsList>

              {/* Cobranças */}
              <TabsContent value="payments" className="mt-4">
                <Card>
                  <CardHeader className="py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium">Histórico de Cobranças</CardTitle>
                    <Button variant="ghost" size="sm" onClick={loadPayments}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoadingPayments ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : payments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhuma cobrança encontrada
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell className="font-medium">
                                {formatDate(payment.dueDate)}
                              </TableCell>
                              <TableCell>{formatCurrency(payment.value)}</TableCell>
                              <TableCell>{getBillingTypeBadge(payment.billingType)}</TableCell>
                              <TableCell>{getPaymentStatusBadge(payment.status)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {payment.invoiceUrl && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => window.open(payment.invoiceUrl, '_blank')}
                                      title="Ver fatura"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {payment.bankSlipUrl && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => copyToClipboard(payment.bankSlipUrl!, 'Link do boleto')}
                                      title="Copiar link do boleto"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Assinaturas */}
              <TabsContent value="subscriptions" className="mt-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">Assinaturas Ativas</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoadingSubscriptions ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : subscriptions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhuma assinatura encontrada
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Ciclo</TableHead>
                            <TableHead>Próx. Vencimento</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {subscriptions.map((sub) => (
                            <TableRow key={sub.id}>
                              <TableCell className="font-medium">
                                {sub.description || 'Assinatura'}
                              </TableCell>
                              <TableCell>{formatCurrency(sub.value)}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {sub.cycle === 'MONTHLY' ? 'Mensal' : 
                                   sub.cycle === 'WEEKLY' ? 'Semanal' :
                                   sub.cycle === 'YEARLY' ? 'Anual' : sub.cycle}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatDate(sub.nextDueDate)}</TableCell>
                              <TableCell>
                                <Badge variant={sub.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                  {sub.status === 'ACTIVE' ? 'Ativa' : 
                                   sub.status === 'INACTIVE' ? 'Inativa' : 'Expirada'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Informações do Cliente */}
              <TabsContent value="info" className="mt-4">
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    {customer.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="text-sm">{customer.email}</p>
                        </div>
                      </div>
                    )}
                    
                    {(customer.phone || customer.mobilePhone) && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Telefone</p>
                          <p className="text-sm">{customer.mobilePhone || customer.phone}</p>
                        </div>
                      </div>
                    )}

                    {customer.address && (
                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Endereço</p>
                          <p className="text-sm">
                            {customer.address}
                            {customer.addressNumber && `, ${customer.addressNumber}`}
                            {customer.complement && ` - ${customer.complement}`}
                          </p>
                          {customer.province && (
                            <p className="text-sm text-muted-foreground">
                              {customer.province}
                              {customer.postalCode && ` - CEP: ${customer.postalCode}`}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {customer.externalReference && (
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Referência Externa</p>
                          <p className="text-sm">{customer.externalReference}</p>
                        </div>
                      </div>
                    )}

                    {customer.observations && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-1">Observações</p>
                        <p className="text-sm">{customer.observations}</p>
                      </div>
                    )}

                    {customer.dateCreated && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          Cliente desde {formatDate(customer.dateCreated)}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
