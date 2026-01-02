import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIntegrations } from "./useIntegrations";
import { toast } from "sonner";

export interface AsaasCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
  additionalEmails?: string;
  municipalInscription?: string;
  stateInscription?: string;
  observations?: string;
  dateCreated?: string;
}

export interface AsaasPayment {
  id: string;
  customer: string;
  dateCreated: string;
  dueDate: string;
  value: number;
  netValue?: number;
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'RECEIVED_IN_CASH' | 'REFUND_REQUESTED' | 'CHARGEBACK_REQUESTED' | 'CHARGEBACK_DISPUTE' | 'AWAITING_CHARGEBACK_REVERSAL' | 'DUNNING_REQUESTED' | 'DUNNING_RECEIVED' | 'AWAITING_RISK_ANALYSIS';
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  invoiceNumber?: string;
  pixTransaction?: {
    qrCodeImage?: string;
    payload?: string;
  };
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  dateCreated: string;
  value: number;
  nextDueDate: string;
  cycle: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
  description?: string;
  externalReference?: string;
}

export interface AsaasTransfer {
  id: string;
  value: number;
  dateCreated: string;
  status: 'PENDING' | 'BANK_PROCESSING' | 'DONE' | 'CANCELLED' | 'FAILED';
  transferFee?: number;
  effectiveDate?: string;
  scheduleDate?: string;
  type: 'PIX' | 'TED';
  bankAccount?: {
    bank?: { code?: string; name?: string };
    accountName?: string;
    ownerName?: string;
    cpfCnpj?: string;
    agency?: string;
    account?: string;
    accountDigit?: string;
    pixAddressKey?: string;
  };
}

export interface AsaasBalance {
  balance: number;
}

export interface AsaasPaymentLink {
  id: string;
  name: string;
  url: string;
  value?: number;
  billingType?: string;
  active: boolean;
  dateCreated?: string;
}

export const useAsaas = () => {
  const { isConnected, getIntegration } = useIntegrations();
  const queryClient = useQueryClient();
  const hasAsaas = isConnected('asaas');

  const callAsaasApi = async (action: string, params?: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('asaas-api', {
      body: { action, ...params }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  // Balance
  const { data: balance, isLoading: isLoadingBalance, refetch: refetchBalance } = useQuery({
    queryKey: ['asaas', 'balance'],
    queryFn: () => callAsaasApi('get-balance'),
    enabled: hasAsaas,
  });

  // Customers
  const { data: customersData, isLoading: isLoadingCustomers, refetch: refetchCustomers } = useQuery({
    queryKey: ['asaas', 'customers'],
    queryFn: () => callAsaasApi('list-customers', { limit: 100 }),
    enabled: hasAsaas,
  });

  // Payments
  const { data: paymentsData, isLoading: isLoadingPayments, refetch: refetchPayments } = useQuery({
    queryKey: ['asaas', 'payments'],
    queryFn: () => callAsaasApi('list-payments', { limit: 100 }),
    enabled: hasAsaas,
  });

  // Subscriptions
  const { data: subscriptionsData, isLoading: isLoadingSubscriptions, refetch: refetchSubscriptions } = useQuery({
    queryKey: ['asaas', 'subscriptions'],
    queryFn: () => callAsaasApi('list-subscriptions', { limit: 100 }),
    enabled: hasAsaas,
  });

  // Transfers
  const { data: transfersData, isLoading: isLoadingTransfers, refetch: refetchTransfers } = useQuery({
    queryKey: ['asaas', 'transfers'],
    queryFn: () => callAsaasApi('list-transfers', { limit: 100 }),
    enabled: hasAsaas,
  });

  // Payment Links
  const { data: paymentLinksData, isLoading: isLoadingPaymentLinks, refetch: refetchPaymentLinks } = useQuery({
    queryKey: ['asaas', 'payment-links'],
    queryFn: () => callAsaasApi('list-payment-links', { limit: 100 }),
    enabled: hasAsaas,
  });

  // Mutations
  const createCustomer = useMutation({
    mutationFn: (customer: Partial<AsaasCustomer>) => callAsaasApi('create-customer', { customer }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas', 'customers'] });
      toast.success('Cliente criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar cliente: ' + error.message);
    }
  });

  const updateCustomer = useMutation({
    mutationFn: ({ id, customer }: { id: string; customer: Partial<AsaasCustomer> }) => 
      callAsaasApi('update-customer', { id, customer }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas', 'customers'] });
      toast.success('Cliente atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar cliente: ' + error.message);
    }
  });

  const deleteCustomer = useMutation({
    mutationFn: (id: string) => callAsaasApi('delete-customer', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas', 'customers'] });
      toast.success('Cliente removido!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover cliente: ' + error.message);
    }
  });

  const createPayment = useMutation({
    mutationFn: (payment: Partial<AsaasPayment> & { customer: string; billingType: string; dueDate: string; value: number }) => 
      callAsaasApi('create-payment', { payment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas', 'payments'] });
      toast.success('Cobrança criada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar cobrança: ' + error.message);
    }
  });

  const deletePayment = useMutation({
    mutationFn: (id: string) => callAsaasApi('delete-payment', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas', 'payments'] });
      toast.success('Cobrança removida!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover cobrança: ' + error.message);
    }
  });

  const refundPayment = useMutation({
    mutationFn: ({ id, value, description }: { id: string; value?: number; description?: string }) => 
      callAsaasApi('refund-payment', { id, value, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas', 'payments'] });
      toast.success('Reembolso solicitado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao solicitar reembolso: ' + error.message);
    }
  });

  const getPixQrCode = useMutation({
    mutationFn: (id: string) => callAsaasApi('get-pix-qrcode', { id }),
  });

  const createSubscription = useMutation({
    mutationFn: (subscription: Partial<AsaasSubscription> & { customer: string; billingType: string; nextDueDate: string; value: number; cycle: string }) => 
      callAsaasApi('create-subscription', { subscription }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas', 'subscriptions'] });
      toast.success('Assinatura criada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar assinatura: ' + error.message);
    }
  });

  const updateSubscription = useMutation({
    mutationFn: ({ id, subscription }: { id: string; subscription: Partial<AsaasSubscription> }) => 
      callAsaasApi('update-subscription', { id, subscription }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas', 'subscriptions'] });
      toast.success('Assinatura atualizada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar assinatura: ' + error.message);
    }
  });

  const deleteSubscription = useMutation({
    mutationFn: (id: string) => callAsaasApi('delete-subscription', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas', 'subscriptions'] });
      toast.success('Assinatura cancelada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cancelar assinatura: ' + error.message);
    }
  });

  const createTransfer = useMutation({
    mutationFn: (transfer: { value: number; pixAddressKey?: string; bankAccount?: Record<string, unknown> }) => 
      callAsaasApi('create-transfer', { transfer }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas', 'transfers'] });
      queryClient.invalidateQueries({ queryKey: ['asaas', 'balance'] });
      toast.success('Transferência criada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar transferência: ' + error.message);
    }
  });

  const createPaymentLink = useMutation({
    mutationFn: (paymentLink: { name: string; value?: number; billingType?: string; description?: string }) => 
      callAsaasApi('create-payment-link', { paymentLink }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas', 'payment-links'] });
      toast.success('Link de pagamento criado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar link de pagamento: ' + error.message);
    }
  });

  return {
    hasAsaas,
    // Balance
    balance: balance?.balance as number | undefined,
    isLoadingBalance,
    refetchBalance,
    // Customers
    customers: (customersData?.data || []) as AsaasCustomer[],
    isLoadingCustomers,
    refetchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    // Payments
    payments: (paymentsData?.data || []) as AsaasPayment[],
    isLoadingPayments,
    refetchPayments,
    createPayment,
    deletePayment,
    refundPayment,
    getPixQrCode,
    // Subscriptions
    subscriptions: (subscriptionsData?.data || []) as AsaasSubscription[],
    isLoadingSubscriptions,
    refetchSubscriptions,
    createSubscription,
    updateSubscription,
    deleteSubscription,
    // Transfers
    transfers: (transfersData?.data || []) as AsaasTransfer[],
    isLoadingTransfers,
    refetchTransfers,
    createTransfer,
    // Payment Links
    paymentLinks: (paymentLinksData?.data || []) as AsaasPaymentLink[],
    isLoadingPaymentLinks,
    refetchPaymentLinks,
    createPaymentLink,
  };
};
