import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAsaas, AsaasPayment, AsaasCustomer } from '@/hooks/useAsaas';
import { CalendarClock, ExternalLink, FileText, MessageCircle, CheckCircle2, XCircle, Clock, Send } from 'lucide-react';
import { format, parseISO, isToday, startOfDay, endOfDay } from 'date-fns';
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

type ReminderStatus = 'sent' | 'failed' | 'pending' | 'cancelled' | 'paid' | 'none';

interface ReminderInfo {
  status: ReminderStatus;
  errorMessage?: string | null;
  sentAt?: string | null;
  scheduledFor?: string | null;
}

interface TodayPaymentRow {
  payment: AsaasPayment;
  customerName: string;
  reminder: ReminderInfo;
}

const reminderBadge = (info: ReminderInfo, paymentStatus: string) => {
  // If payment was paid, show "Pago" regardless of reminder
  const paidStatuses = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
  if (paidStatuses.includes(paymentStatus)) {
    return {
      icon: CheckCircle2,
      label: 'Recebido',
      className: 'bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400',
      title: 'Pagamento já recebido',
    };
  }

  switch (info.status) {
    case 'sent':
      return {
        icon: Send,
        label: 'Enviado',
        className: 'bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400',
        title: info.sentAt ? `Lembrete enviado em ${format(parseISO(info.sentAt), "dd/MM HH:mm", { locale: ptBR })}` : 'Lembrete enviado',
      };
    case 'failed':
      return {
        icon: XCircle,
        label: 'Não enviado',
        className: 'bg-destructive/10 text-destructive border-destructive/30',
        title: info.errorMessage || 'Falha no envio do lembrete',
      };
    case 'cancelled':
      return {
        icon: XCircle,
        label: 'Cancelado',
        className: 'bg-muted text-muted-foreground border-border',
        title: info.errorMessage || 'Lembrete cancelado (pago antes do envio)',
      };
    case 'pending':
      return {
        icon: Clock,
        label: 'Agendado',
        className: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400',
        title: info.scheduledFor ? `Agendado para ${format(parseISO(info.scheduledFor), "dd/MM HH:mm", { locale: ptBR })}` : 'Lembrete agendado',
      };
    case 'paid':
      return {
        icon: CheckCircle2,
        label: 'Recebido',
        className: 'bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400',
        title: 'Pagamento confirmado',
      };
    default:
      return {
        icon: Clock,
        label: 'Sem lembrete',
        className: 'bg-muted text-muted-foreground border-border',
        title: 'Nenhum lembrete configurado',
      };
  }
};

export const TodayDuePayments = () => {
  const { payments, customers, isLoadingPayments, isLoadingCustomers } = useAsaas();

  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((c: AsaasCustomer) => map.set(c.id, c.name));
    return map;
  }, [customers]);

  // Get today's payments
  const todayPaymentsBase = useMemo(() => {
    return payments
      .filter((p: AsaasPayment) => {
        try {
          return isToday(parseISO(p.dueDate));
        } catch {
          return false;
        }
      });
  }, [payments]);

  const todayPaymentIds = useMemo(
    () => todayPaymentsBase.map((p) => p.id),
    [todayPaymentsBase]
  );

  // Fetch reminders for today's payments
  const { data: remindersByPaymentId = {} } = useQuery({
    queryKey: ['today-billing-reminders', todayPaymentIds.sort().join(',')],
    enabled: todayPaymentIds.length > 0,
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      const { data, error } = await supabase
        .from('billing_reminders')
        .select('asaas_payment_id, status, error_message, sent_at, scheduled_for, reminder_type')
        .in('asaas_payment_id', todayPaymentIds)
        .gte('scheduled_for', todayStart)
        .lte('scheduled_for', todayEnd)
        .order('scheduled_for', { ascending: false });

      if (error) {
        console.error('Error fetching billing reminders:', error);
        return {};
      }

      // Group by payment_id, prefer the most recent meaningful status
      const map: Record<string, ReminderInfo> = {};
      const priority: Record<string, number> = {
        sent: 5,
        failed: 4,
        pending: 3,
        cancelled: 2,
        skipped: 1,
        paid: 6,
      };

      for (const r of data || []) {
        const current = map[r.asaas_payment_id];
        const incomingPriority = priority[r.status as string] ?? 0;
        const currentPriority = current ? (priority[current.status as string] ?? 0) : -1;

        if (incomingPriority > currentPriority) {
          // Map skipped to failed for display
          const displayStatus: ReminderStatus =
            r.status === 'skipped' ? 'failed' : (r.status as ReminderStatus);
          map[r.asaas_payment_id] = {
            status: displayStatus,
            errorMessage: r.error_message,
            sentAt: r.sent_at,
            scheduledFor: r.scheduled_for,
          };
        }
      }

      return map;
    },
    staleTime: 30_000,
  });

  const todayPayments: TodayPaymentRow[] = useMemo(() => {
    return todayPaymentsBase
      .map((p: AsaasPayment) => ({
        payment: p,
        customerName: customerMap.get(p.customer) || p.customer,
        reminder: remindersByPaymentId[p.id] || { status: 'none' as ReminderStatus },
      }))
      .sort((a, b) => {
        // Pendentes/vencidos primeiro
        const order: Record<string, number> = { OVERDUE: 0, PENDING: 1, RECEIVED: 2, CONFIRMED: 2 };
        return (order[a.payment.status] ?? 3) - (order[b.payment.status] ?? 3);
      });
  }, [todayPaymentsBase, customerMap, remindersByPaymentId]);

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

  // Counters
  const counts = useMemo(() => {
    const c = { sent: 0, failed: 0, pending: 0, received: 0 };
    const paidStatuses = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
    for (const row of todayPayments) {
      if (paidStatuses.includes(row.payment.status)) {
        c.received++;
      } else if (row.reminder.status === 'sent') {
        c.sent++;
      } else if (row.reminder.status === 'failed') {
        c.failed++;
      } else if (row.reminder.status === 'pending') {
        c.pending++;
      }
    }
    return c;
  }, [todayPayments]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
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
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {todayPayments.length} cobrança{todayPayments.length !== 1 ? 's' : ''}
              </Badge>
              {counts.received > 0 && (
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {counts.received} recebida{counts.received !== 1 ? 's' : ''}
                </Badge>
              )}
              {counts.sent > 0 && (
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400">
                  <Send className="h-3 w-3 mr-1" />
                  {counts.sent} enviada{counts.sent !== 1 ? 's' : ''}
                </Badge>
              )}
              {counts.failed > 0 && (
                <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                  <XCircle className="h-3 w-3 mr-1" />
                  {counts.failed} falha{counts.failed !== 1 ? 's' : ''}
                </Badge>
              )}
              {counts.pending > 0 && (
                <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400">
                  <Clock className="h-3 w-3 mr-1" />
                  {counts.pending} agendada{counts.pending !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
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
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {todayPayments.map((row) => {
              const status = statusMap[row.payment.status] || { label: row.payment.status, variant: 'secondary' as const };
              const reminder = reminderBadge(row.reminder, row.payment.status);
              const ReminderIcon = reminder.icon;
              return (
                <div
                  key={row.payment.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{row.customerName}</span>
                      <Badge variant={status.variant} className="text-xs shrink-0">
                        {status.label}
                      </Badge>
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${reminder.className}`}
                        title={reminder.title}
                      >
                        <ReminderIcon className="h-3 w-3" />
                        {reminder.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-semibold">{formatCurrency(row.payment.value)}</span>
                      {row.payment.description && (
                        <span className="text-xs text-muted-foreground truncate">
                          — {row.payment.description}
                        </span>
                      )}
                    </div>
                    {row.reminder.status === 'failed' && row.reminder.errorMessage && (
                      <p className="text-xs text-destructive mt-1 truncate" title={row.reminder.errorMessage}>
                        ⚠️ {row.reminder.errorMessage}
                      </p>
                    )}
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
