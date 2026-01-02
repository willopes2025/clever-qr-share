import { useMemo } from 'react';
import { useAsaas, AsaasPayment, AsaasSubscription } from './useAsaas';
import { startOfDay, endOfDay, subDays, differenceInDays, isWithinInterval, parseISO, addDays, format } from 'date-fns';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface AgingCategory {
  count: number;
  value: number;
  payments: AsaasPayment[];
}

export interface Aging {
  days0to30: AgingCategory;
  days31to60: AgingCategory;
  days61to90: AgingCategory;
  days90plus: AgingCategory;
}

export interface TopDebtor {
  customer: string;
  name: string;
  value: number;
  daysOverdue: number;
  paymentsCount: number;
  customerCpfCnpj: string;
  overduePaymentIds: string[];
}

export interface PaymentMethodStats {
  pix: { count: number; value: number };
  boleto: { count: number; value: number };
  creditCard: { count: number; value: number };
  other: { count: number; value: number };
}

export interface DailyData {
  date: string;
  value: number;
  count: number;
}

export interface FinancialMetrics {
  // KPIs principais
  balance: number;
  receivedInPeriod: number;
  receivedCountInPeriod: number;
  pendingInPeriod: number;
  pendingCountInPeriod: number;
  overdueTotal: number;
  overdueCount: number;
  
  // Comparativo
  receivedPreviousPeriod: number;
  receivedGrowth: number;
  
  // Inadimplência
  delinquencyRate: number;
  aging: Aging;
  topDebtors: TopDebtor[];
  
  // MRR
  currentMRR: number;
  activeSubscriptionsCount: number;
  
  // Por tipo de pagamento
  byPaymentMethod: PaymentMethodStats;
  
  // Previsão
  forecast30Days: number;
  forecast30DaysCount: number;
  
  // Dados para gráficos
  dailyReceived: DailyData[];
  dailyPending: DailyData[];
  
  // Totais gerais
  totalPaymentsValue: number;
  totalPaymentsCount: number;
  
  // Loading states
  isLoading: boolean;
}

const getPaymentDate = (payment: AsaasPayment): Date => {
  if (payment.paymentDate) return parseISO(payment.paymentDate);
  return parseISO(payment.dueDate);
};

const isPaymentInRange = (payment: AsaasPayment, range: DateRange, usePaymentDate: boolean = true): boolean => {
  const date = usePaymentDate ? getPaymentDate(payment) : parseISO(payment.dueDate);
  return isWithinInterval(date, { start: range.start, end: range.end });
};

export const useFinancialMetrics = (dateRange: DateRange): FinancialMetrics => {
  const {
    balance,
    payments,
    subscriptions,
    customers,
    isLoadingBalance,
    isLoadingPayments,
    isLoadingSubscriptions,
    isLoadingCustomers,
  } = useAsaas();

  const metrics = useMemo(() => {
    const today = startOfDay(new Date());
    const periodDays = differenceInDays(dateRange.end, dateRange.start) + 1;
    
    // Período anterior para comparação
    const previousRange: DateRange = {
      start: subDays(dateRange.start, periodDays),
      end: subDays(dateRange.start, 1),
    };

    // Pagamentos recebidos no período
    const receivedPayments = payments.filter(
      p => ['RECEIVED', 'CONFIRMED'].includes(p.status) && isPaymentInRange(p, dateRange)
    );
    const receivedInPeriod = receivedPayments.reduce((sum, p) => sum + p.value, 0);
    
    // Pagamentos recebidos no período anterior
    const receivedPreviousPayments = payments.filter(
      p => ['RECEIVED', 'CONFIRMED'].includes(p.status) && isPaymentInRange(p, previousRange)
    );
    const receivedPreviousPeriod = receivedPreviousPayments.reduce((sum, p) => sum + p.value, 0);
    
    // Crescimento
    const receivedGrowth = receivedPreviousPeriod > 0 
      ? ((receivedInPeriod - receivedPreviousPeriod) / receivedPreviousPeriod) * 100 
      : 0;
    
    // Pendentes no período (vencimento no período)
    const pendingPayments = payments.filter(
      p => p.status === 'PENDING' && isPaymentInRange(p, dateRange, false)
    );
    const pendingInPeriod = pendingPayments.reduce((sum, p) => sum + p.value, 0);
    
    // Vencidos total
    const overduePayments = payments.filter(p => p.status === 'OVERDUE');
    const overdueTotal = overduePayments.reduce((sum, p) => sum + p.value, 0);
    
    // Taxa de inadimplência
    const totalBilled = receivedInPeriod + overdueTotal;
    const delinquencyRate = totalBilled > 0 ? (overdueTotal / totalBilled) * 100 : 0;
    
    // Aging
    const aging: Aging = {
      days0to30: { count: 0, value: 0, payments: [] },
      days31to60: { count: 0, value: 0, payments: [] },
      days61to90: { count: 0, value: 0, payments: [] },
      days90plus: { count: 0, value: 0, payments: [] },
    };
    
    overduePayments.forEach(payment => {
      const daysOverdue = differenceInDays(today, parseISO(payment.dueDate));
      
      if (daysOverdue <= 30) {
        aging.days0to30.count++;
        aging.days0to30.value += payment.value;
        aging.days0to30.payments.push(payment);
      } else if (daysOverdue <= 60) {
        aging.days31to60.count++;
        aging.days31to60.value += payment.value;
        aging.days31to60.payments.push(payment);
      } else if (daysOverdue <= 90) {
        aging.days61to90.count++;
        aging.days61to90.value += payment.value;
        aging.days61to90.payments.push(payment);
      } else {
        aging.days90plus.count++;
        aging.days90plus.value += payment.value;
        aging.days90plus.payments.push(payment);
      }
    });
    
    // Top devedores
    const debtorMap = new Map<string, { value: number; maxDaysOverdue: number; count: number; paymentIds: string[] }>();
    
    overduePayments.forEach(payment => {
      const customerId = payment.customer;
      const daysOverdue = differenceInDays(today, parseISO(payment.dueDate));
      
      if (debtorMap.has(customerId)) {
        const existing = debtorMap.get(customerId)!;
        debtorMap.set(customerId, {
          value: existing.value + payment.value,
          maxDaysOverdue: Math.max(existing.maxDaysOverdue, daysOverdue),
          count: existing.count + 1,
          paymentIds: [...existing.paymentIds, payment.id],
        });
      } else {
        debtorMap.set(customerId, { 
          value: payment.value, 
          maxDaysOverdue: daysOverdue, 
          count: 1,
          paymentIds: [payment.id],
        });
      }
    });
    
    const topDebtors: TopDebtor[] = Array.from(debtorMap.entries())
      .map(([customerId, data]) => {
        const customer = customers.find(c => c.id === customerId);
        return {
          customer: customerId,
          name: customer?.name || 'Cliente não encontrado',
          value: data.value,
          daysOverdue: data.maxDaysOverdue,
          paymentsCount: data.count,
          customerCpfCnpj: customer?.cpfCnpj || '',
          overduePaymentIds: data.paymentIds,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    
    // MRR
    const activeSubscriptions = subscriptions.filter(s => s.status === 'ACTIVE');
    const currentMRR = activeSubscriptions.reduce((sum, s) => {
      // Normalizar para mensal
      const cycle = s.cycle || 'MONTHLY';
      let monthlyValue = s.value;
      
      switch (cycle) {
        case 'WEEKLY':
          monthlyValue = s.value * 4;
          break;
        case 'BIWEEKLY':
          monthlyValue = s.value * 2;
          break;
        case 'QUARTERLY':
          monthlyValue = s.value / 3;
          break;
        case 'SEMIANNUALLY':
          monthlyValue = s.value / 6;
          break;
        case 'YEARLY':
          monthlyValue = s.value / 12;
          break;
      }
      
      return sum + monthlyValue;
    }, 0);
    
    // Por tipo de pagamento (recebidos no período)
    const byPaymentMethod: PaymentMethodStats = {
      pix: { count: 0, value: 0 },
      boleto: { count: 0, value: 0 },
      creditCard: { count: 0, value: 0 },
      other: { count: 0, value: 0 },
    };
    
    receivedPayments.forEach(payment => {
      const type = payment.billingType;
      
      if (type === 'PIX') {
        byPaymentMethod.pix.count++;
        byPaymentMethod.pix.value += payment.value;
      } else if (type === 'BOLETO') {
        byPaymentMethod.boleto.count++;
        byPaymentMethod.boleto.value += payment.value;
      } else if (type === 'CREDIT_CARD') {
        byPaymentMethod.creditCard.count++;
        byPaymentMethod.creditCard.value += payment.value;
      } else {
        byPaymentMethod.other.count++;
        byPaymentMethod.other.value += payment.value;
      }
    });
    
    // Previsão 30 dias
    const next30Days: DateRange = {
      start: today,
      end: addDays(today, 30),
    };
    
    const forecast30DaysPayments = payments.filter(
      p => p.status === 'PENDING' && isPaymentInRange(p, next30Days, false)
    );
    const forecast30Days = forecast30DaysPayments.reduce((sum, p) => sum + p.value, 0);
    
    // Dados diários para gráficos
    const dailyReceived: DailyData[] = [];
    const dailyPending: DailyData[] = [];
    
    for (let i = 0; i <= differenceInDays(dateRange.end, dateRange.start); i++) {
      const date = addDays(dateRange.start, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const dayReceived = receivedPayments.filter(p => {
        const paymentDate = getPaymentDate(p);
        return format(paymentDate, 'yyyy-MM-dd') === dateStr;
      });
      
      const dayPending = pendingPayments.filter(p => {
        return format(parseISO(p.dueDate), 'yyyy-MM-dd') === dateStr;
      });
      
      dailyReceived.push({
        date: dateStr,
        value: dayReceived.reduce((sum, p) => sum + p.value, 0),
        count: dayReceived.length,
      });
      
      dailyPending.push({
        date: dateStr,
        value: dayPending.reduce((sum, p) => sum + p.value, 0),
        count: dayPending.length,
      });
    }
    
    return {
      balance: balance || 0,
      receivedInPeriod,
      receivedCountInPeriod: receivedPayments.length,
      pendingInPeriod,
      pendingCountInPeriod: pendingPayments.length,
      overdueTotal,
      overdueCount: overduePayments.length,
      receivedPreviousPeriod,
      receivedGrowth,
      delinquencyRate,
      aging,
      topDebtors,
      currentMRR,
      activeSubscriptionsCount: activeSubscriptions.length,
      byPaymentMethod,
      forecast30Days,
      forecast30DaysCount: forecast30DaysPayments.length,
      dailyReceived,
      dailyPending,
      totalPaymentsValue: payments.reduce((sum, p) => sum + p.value, 0),
      totalPaymentsCount: payments.length,
      isLoading: isLoadingBalance || isLoadingPayments || isLoadingSubscriptions || isLoadingCustomers,
    };
  }, [balance, payments, subscriptions, customers, dateRange, isLoadingBalance, isLoadingPayments, isLoadingSubscriptions, isLoadingCustomers]);

  return metrics;
};
