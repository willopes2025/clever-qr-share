import { useSubscriptionContext } from '@/contexts/SubscriptionContext';

export interface SubscriptionInfo {
  subscribed: boolean;
  plan: string;
  max_instances: number | null;
  max_contacts: number | null;
  max_messages: number | null;
  max_leads: number | null;
  leads_used: number | null;
  leads_reset_at: string | null;
  subscription_end: string | null;
  is_organization_member?: boolean;
  organization_id?: string;
  trial_ends_at?: string | null;
}

// Include both internal keys and external/Stripe plan names
export type PlanKey = 'free' | 'essencial' | 'profissional' | 'pro' | 'agencia' | 'business' | 'avancado';

// Map external plan names (from Stripe/DB) to internal plan keys
const PLAN_ALIASES: Record<string, PlanKey> = {
  'pro': 'profissional',
  'business': 'agencia',
};

export function normalizePlanKey(plan: string): PlanKey {
  const normalized = PLAN_ALIASES[plan.toLowerCase()];
  return (normalized || plan) as PlanKey;
}

export interface PlanConfig {
  name: string;
  price: number;
  priceId: string | null;
  productId: string | null;
  maxInstances: number | null;
  maxMessages: number | null;
  maxContacts: number | null;
  maxLeads: number;
  features: string[];
  featureKeys: string[];
}

// New plan configuration with Stripe IDs
export const PLANS: Record<PlanKey, PlanConfig> = {
  free: {
    name: 'Free Trial',
    price: 0,
    priceId: null,
    productId: null,
    maxInstances: 1,
    maxMessages: 300,
    maxContacts: 500,
    maxLeads: 50,
    features: [
      '1 Instância WhatsApp',
      '300 mensagens/mês',
      '500 contatos',
      '50 leads/mês',
      'Inbox / Chat',
      'Templates básicos',
      'Campanhas simples',
    ],
    featureKeys: ['inbox', 'templates', 'campaigns_basic', 'contacts'],
  },
  essencial: {
    name: 'Essencial',
    price: 147,
    priceId: 'price_1SijenIuIJFtamjKuzbqG8xt',
    productId: 'prod_Tg5qEVTAzaY2d1',
    maxInstances: 3,
    maxMessages: 10000,
    maxContacts: 10000,
    maxLeads: 1000,
    features: [
      '3 Instâncias WhatsApp',
      '10.000 mensagens/mês',
      '10.000 contatos',
      '1.000 leads/mês',
      'Aquecimento de Chip',
      'Listas de Transmissão',
      'Funis de Vendas (CRM)',
      'Templates com variações',
    ],
    featureKeys: ['inbox', 'templates', 'campaigns', 'contacts', 'broadcast', 'funnels', 'warming'],
  },
  profissional: {
    name: 'Profissional',
    price: 297,
    priceId: 'price_1SijezIuIJFtamjK45VHVMhV',
    productId: 'prod_Tg5qspfPups3iN',
    maxInstances: 10,
    maxMessages: null, // ilimitadas
    maxContacts: 50000,
    maxLeads: 5000,
    features: [
      '10 Instâncias WhatsApp',
      'Mensagens ilimitadas',
      '50.000 contatos',
      '5.000 leads/mês',
      'Tudo do Essencial',
      'Analysis (IA)',
      'Automações',
      'Agente IA',
      'API & Webhooks',
    ],
    featureKeys: ['inbox', 'templates', 'campaigns', 'contacts', 'broadcast', 'funnels', 'warming', 'analysis', 'automations', 'ai_agent', 'api', 'webhooks'],
  },
  agencia: {
    name: 'Agência',
    price: 597,
    priceId: 'price_1SijfBIuIJFtamjKkRlLwfkh',
    productId: 'prod_Tg5qcEw3OK7hU3',
    maxInstances: 30,
    maxMessages: null,
    maxContacts: null, // ilimitados
    maxLeads: 25000,
    features: [
      '30 Instâncias WhatsApp',
      'Mensagens ilimitadas',
      'Contatos ilimitados',
      '25.000 leads/mês',
      'Tudo do Profissional',
      'Multi-equipe',
      'Suporte Prioritário',
    ],
    featureKeys: ['all', 'multi_team', 'priority_support'],
  },
  avancado: {
    name: 'Avançado',
    price: 797,
    priceId: 'price_1SijfUIuIJFtamjKrRwGYD7o',
    productId: 'prod_Tg5rhArqyzOqTt',
    maxInstances: 50,
    maxMessages: null,
    maxContacts: null,
    maxLeads: 2000,
    features: [
      '50 Instâncias WhatsApp',
      'Mensagens ilimitadas',
      'Contatos ilimitados',
      '2.000 leads/mês',
      'Todas as features',
      'Suporte VIP',
    ],
    featureKeys: ['all'],
  },
  // Aliases for Stripe/DB plan names
  pro: {
    name: 'Profissional',
    price: 297,
    priceId: 'price_1SijezIuIJFtamjK45VHVMhV',
    productId: 'prod_Tg5qspfPups3iN',
    maxInstances: 10,
    maxMessages: null,
    maxContacts: 50000,
    maxLeads: 5000,
    features: [
      '10 Instâncias WhatsApp',
      'Mensagens ilimitadas',
      '50.000 contatos',
      '5.000 leads/mês',
      'Tudo do Essencial',
      'Analysis (IA)',
      'Automações',
      'Agente IA',
      'API & Webhooks',
    ],
    featureKeys: ['inbox', 'templates', 'campaigns', 'contacts', 'broadcast', 'funnels', 'warming', 'analysis', 'automations', 'ai_agent', 'api', 'webhooks'],
  },
  business: {
    name: 'Agência',
    price: 597,
    priceId: 'price_1SijfBIuIJFtamjKkRlLwfkh',
    productId: 'prod_Tg5qcEw3OK7hU3',
    maxInstances: 30,
    maxMessages: null,
    maxContacts: null,
    maxLeads: 25000,
    features: [
      '30 Instâncias WhatsApp',
      'Mensagens ilimitadas',
      'Contatos ilimitados',
      '25.000 leads/mês',
      'Tudo do Profissional',
      'Multi-equipe',
      'Suporte Prioritário',
    ],
    featureKeys: ['all', 'multi_team', 'priority_support'],
  },
};

// Feature access by plan (includes aliases for pro/business)
export const FEATURE_ACCESS: Record<string, PlanKey[]> = {
  inbox: ['free', 'essencial', 'profissional', 'pro', 'agencia', 'business', 'avancado'],
  templates: ['free', 'essencial', 'profissional', 'pro', 'agencia', 'business', 'avancado'],
  campaigns: ['free', 'essencial', 'profissional', 'pro', 'agencia', 'business', 'avancado'],
  contacts: ['free', 'essencial', 'profissional', 'pro', 'agencia', 'business', 'avancado'],
  broadcast: ['essencial', 'profissional', 'pro', 'agencia', 'business', 'avancado'],
  funnels: ['essencial', 'profissional', 'pro', 'agencia', 'business', 'avancado'],
  warming: ['essencial', 'profissional', 'pro', 'agencia', 'business', 'avancado'],
  analysis: ['profissional', 'pro', 'agencia', 'business', 'avancado'],
  automations: ['profissional', 'pro', 'agencia', 'business', 'avancado'],
  ai_agent: ['profissional', 'pro', 'agencia', 'business', 'avancado'],
  api: ['profissional', 'pro', 'agencia', 'business', 'avancado'],
  webhooks: ['profissional', 'pro', 'agencia', 'business', 'avancado'],
  multi_team: ['agencia', 'business', 'avancado'],
  priority_support: ['agencia', 'business', 'avancado'],
  lead_search: ['essencial', 'profissional', 'pro', 'agencia', 'business', 'avancado'],
  calendar: ['free', 'essencial', 'profissional', 'pro', 'agencia', 'business', 'avancado'],
};

export function hasFeatureAccess(plan: string, feature: string): boolean {
  const allowedPlans = FEATURE_ACCESS[feature];
  if (!allowedPlans) return true; // Feature not restricted
  
  // Normalize the plan name to handle aliases (pro -> profissional, business -> agencia)
  const normalizedPlan = normalizePlanKey(plan);
  
  // Check both the original plan name and the normalized version
  return allowedPlans.includes(plan as PlanKey) || allowedPlans.includes(normalizedPlan);
}

// Re-export the hook from context for backward compatibility
export const useSubscription = useSubscriptionContext;
