import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAsaas, AsaasPayment, AsaasCustomer } from '@/hooks/useAsaas';
import { CalendarClock, ExternalLink, FileText, MessageCircle, AlertCircle } from 'lucide-react';
import { format, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: 'Pendente', variant: 'outline' },
  RECEIVED: { label: 'Recebido', variant: 'default' },
  CONFIRMED: { label: 'Confirmado', variant: 'default' },
  OVERDUE: { label: 'Vencido', variant: 'destructive' },
  RECEIVED_IN_CASH: { label: 'Recebido em dinheiro', variant: 'default' },
  REFUNDED: { label: 'Estornado', variant: 'secondary' },
};

interface TodayPaymentRow {
  payment: AsaasPayment;
  customerName: string;
}

export const TodayDuePayments = () => {
  const { payments, customers, isLoadingPayments, isLoadingCustomers } = useAsaas();

  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((c: AsaasCustomer) => map.set(c.id, c.name));
    return map;
  }, [customers]);

  const todayPayments: TodayPaymentRow[] = useMemo(() => {
    return payments
      .filter((p: AsaasPayment) => {
        try {
          return isToday(parseISO(p.dueDate));
        } catch {
          return false;
        }
      })
      .map((p: AsaasPayment) => ({
        payment: p,
        customerName: customerMap.get(p.customer) || p.customer,
      }))
      .sort((a, b) => {
        // Pendentes/vencidos primeiro
        const order: Record<string, number> = { OVERDUE: 0, PENDING: 1, RECEIVED: 2, CONFIRMED: 2 };
        return (order[a.payment.status] ?? 3) - (order[b.payment.status] ?? 3);
      });
  }, [payments, customerMap]);

  const isLoading = isLoadingPayments || isLoadingCustomers;

  const handleSendWhatsApp = async (row: TodayPaymentRow) => {
    try {
      // Find contact by customer name/phone
      const customer = customers.find((c: AsaasCustomer) => c.id === row.payment.customer);
      if (!customer) {
        toast.error('Cliente não encontrado');
        return;
      }

      const phone = customer.mobilePhone || customer.phone;
      if (!phone) {
        toast.error('Cliente sem telefone cadastrado');
        return;
      }

      // Build message
      const invoiceLink = row.payment.invoiceUrl || row.payment.bankSlipUrl || '';
      const message = `Olá ${customer.name}! 👋\n\nSegue o lembrete da sua cobrança no valor de ${formatCurrency(row.payment.value)} com vencimento hoje (${format(parseISO(row.payment.dueDate), 'dd/MM/yyyy')}).\n\n${invoiceLink ? `📎 Link para pagamento: ${invoiceLink}` : 'Entre em contato para mais detalhes.'}`;

      // Try to find existing conversation
      const normalizedPhone = phone.replace(/\D/g, '');
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, phone')
        .or(`phone.eq.${normalizedPhone},phone.like.%${normalizedPhone.slice(-8)}%`)
        .limit(1)
        .single();

      if (contact) {
        // Navigate to inbox with pre-filled message
        const encodedMsg = encodeURIComponent(message);
        window.open(`/inbox?contact=${contact.id}&message=${encodedMsg}`, '_blank');
      } else {
        // Open WhatsApp web directly
        const waPhone = normalizedPhone.startsWith('55') ? normalizedPhone : `55${normalizedPhone}`;
        window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`, '_blank');
      }
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      toast.error('Erro ao preparar mensagem');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Vencimentos de Hoje
            </CardTitle>
            <CardDescription>
              {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </CardDescription>
          </div>
          {!isLoading && (
            <Badge variant="secondary" className="text-sm">
              {todayPayments.length} cobrança{todayPayments.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        ) : todayPayments.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CalendarClock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma cobrança com vencimento hoje</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {todayPayments.map((row) => {
              const status = statusMap[row.payment.status] || { label: row.payment.status, variant: 'secondary' as const };
              return (
                <div
                  key={row.payment.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{row.customerName}</span>
                      <Badge variant={status.variant} className="text-xs shrink-0">
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-semibold">{formatCurrency(row.payment.value)}</span>
                      {row.payment.description && (
                        <span className="text-xs text-muted-foreground truncate">
                          — {row.payment.description}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {row.payment.invoiceUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Ver fatura"
                        onClick={() => window.open(row.payment.invoiceUrl, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    {row.payment.bankSlipUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Ver boleto"
                        onClick={() => window.open(row.payment.bankSlipUrl, '_blank')}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                      title="Cobrar via WhatsApp"
                      onClick={() => handleSendWhatsApp(row)}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
