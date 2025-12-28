export type PermissionKey = 
  // Dashboard
  | 'view_dashboard'
  // Instâncias
  | 'view_instances'
  | 'create_instances'
  | 'delete_instances'
  | 'connect_instances'
  // Warming
  | 'view_warming'
  | 'start_warming'
  | 'manage_warming_content'
  | 'manage_warming_contacts'
  // Inbox
  | 'view_inbox'
  | 'send_messages'
  | 'use_ai_assistant'
  | 'close_conversations'
  // Funnels
  | 'view_funnels'
  | 'manage_deals'
  | 'manage_stages'
  | 'manage_automations'
  // Calendar
  | 'view_calendar'
  | 'manage_calendar'
  // Analysis
  | 'view_analysis'
  // Contacts
  | 'view_contacts'
  | 'create_contacts'
  | 'edit_contacts'
  | 'delete_contacts'
  | 'import_contacts'
  | 'manage_tags'
  // Lead Search
  | 'search_leads'
  // Listas
  | 'view_lists'
  | 'create_lists'
  | 'send_broadcasts'
  // Templates
  | 'view_templates'
  | 'create_templates'
  | 'delete_templates'
  // Campaigns
  | 'view_campaigns'
  | 'create_campaigns'
  | 'start_campaigns'
  | 'configure_ai_agent'
  // Chatbots
  | 'view_chatbots'
  | 'create_chatbots'
  | 'manage_chatbots'
  // Settings
  | 'manage_subscription'
  | 'manage_settings'
  // Team
  | 'invite_members'
  | 'remove_members'
  | 'edit_permissions'
  | 'reset_passwords';

export type TeamRole = 'admin' | 'member';

export interface Permission {
  key: PermissionKey;
  label: string;
  description: string;
  defaultForAdmin: boolean;
  defaultForMember: boolean;
  category: PermissionCategory;
}

export type PermissionCategory = 
  | 'dashboard'
  | 'instances'
  | 'warming'
  | 'inbox'
  | 'funnels'
  | 'calendar'
  | 'analysis'
  | 'contacts'
  | 'leads'
  | 'lists'
  | 'templates'
  | 'campaigns'
  | 'chatbots'
  | 'settings'
  | 'team';

export const PERMISSION_CATEGORIES: Record<PermissionCategory, string> = {
  dashboard: 'Dashboard',
  instances: 'Instâncias',
  warming: 'Aquecimento',
  inbox: 'Inbox',
  funnels: 'Funis',
  calendar: 'Calendário',
  analysis: 'Análise',
  contacts: 'Contatos',
  leads: 'Busca de Leads',
  lists: 'Listas de Transmissão',
  templates: 'Templates',
  campaigns: 'Campanhas',
  chatbots: 'Chatbots',
  settings: 'Configurações',
  team: 'Equipe',
};

export const PERMISSIONS: Permission[] = [
  // Dashboard
  { key: 'view_dashboard', label: 'Ver Dashboard', description: 'Visualizar dashboard e métricas', defaultForAdmin: true, defaultForMember: true, category: 'dashboard' },
  
  // Instâncias
  { key: 'view_instances', label: 'Ver Instâncias', description: 'Visualizar instâncias do WhatsApp', defaultForAdmin: true, defaultForMember: false, category: 'instances' },
  { key: 'create_instances', label: 'Criar Instâncias', description: 'Criar novas instâncias', defaultForAdmin: true, defaultForMember: false, category: 'instances' },
  { key: 'delete_instances', label: 'Excluir Instâncias', description: 'Excluir instâncias existentes', defaultForAdmin: true, defaultForMember: false, category: 'instances' },
  { key: 'connect_instances', label: 'Conectar Instâncias', description: 'Conectar/desconectar instâncias', defaultForAdmin: true, defaultForMember: false, category: 'instances' },
  
  // Warming
  { key: 'view_warming', label: 'Ver Aquecimento', description: 'Visualizar status de aquecimento', defaultForAdmin: true, defaultForMember: false, category: 'warming' },
  { key: 'start_warming', label: 'Iniciar Aquecimento', description: 'Iniciar/pausar aquecimento', defaultForAdmin: true, defaultForMember: false, category: 'warming' },
  { key: 'manage_warming_content', label: 'Gerenciar Conteúdo', description: 'Gerenciar conteúdo de aquecimento', defaultForAdmin: true, defaultForMember: false, category: 'warming' },
  { key: 'manage_warming_contacts', label: 'Gerenciar Contatos', description: 'Gerenciar contatos de aquecimento', defaultForAdmin: true, defaultForMember: false, category: 'warming' },
  
  // Inbox
  { key: 'view_inbox', label: 'Ver Inbox', description: 'Visualizar conversas', defaultForAdmin: true, defaultForMember: true, category: 'inbox' },
  { key: 'send_messages', label: 'Enviar Mensagens', description: 'Enviar mensagens nas conversas', defaultForAdmin: true, defaultForMember: true, category: 'inbox' },
  { key: 'use_ai_assistant', label: 'Usar IA', description: 'Usar assistente de IA no inbox', defaultForAdmin: true, defaultForMember: false, category: 'inbox' },
  { key: 'close_conversations', label: 'Fechar Conversas', description: 'Fechar/arquivar conversas', defaultForAdmin: true, defaultForMember: true, category: 'inbox' },
  
  // Funnels
  { key: 'view_funnels', label: 'Ver Funis', description: 'Visualizar funis de vendas', defaultForAdmin: true, defaultForMember: true, category: 'funnels' },
  { key: 'manage_deals', label: 'Gerenciar Deals', description: 'Criar/editar negócios', defaultForAdmin: true, defaultForMember: true, category: 'funnels' },
  { key: 'manage_stages', label: 'Gerenciar Etapas', description: 'Criar/editar etapas do funil', defaultForAdmin: true, defaultForMember: false, category: 'funnels' },
  { key: 'manage_automations', label: 'Gerenciar Automações', description: 'Configurar automações do funil', defaultForAdmin: true, defaultForMember: false, category: 'funnels' },
  
  // Calendar
  { key: 'view_calendar', label: 'Ver Calendário', description: 'Visualizar calendário de tarefas', defaultForAdmin: true, defaultForMember: true, category: 'calendar' },
  { key: 'manage_calendar', label: 'Gerenciar Calendário', description: 'Criar/editar tarefas no calendário', defaultForAdmin: true, defaultForMember: true, category: 'calendar' },
  
  // Analysis
  { key: 'view_analysis', label: 'Ver Análises', description: 'Visualizar análises de conversas', defaultForAdmin: true, defaultForMember: false, category: 'analysis' },
  
  // Contacts
  { key: 'view_contacts', label: 'Ver Contatos', description: 'Visualizar lista de contatos', defaultForAdmin: true, defaultForMember: true, category: 'contacts' },
  { key: 'create_contacts', label: 'Criar Contatos', description: 'Adicionar novos contatos', defaultForAdmin: true, defaultForMember: true, category: 'contacts' },
  { key: 'edit_contacts', label: 'Editar Contatos', description: 'Editar contatos existentes', defaultForAdmin: true, defaultForMember: true, category: 'contacts' },
  { key: 'delete_contacts', label: 'Excluir Contatos', description: 'Excluir contatos', defaultForAdmin: true, defaultForMember: false, category: 'contacts' },
  { key: 'import_contacts', label: 'Importar Contatos', description: 'Importar contatos em massa', defaultForAdmin: true, defaultForMember: false, category: 'contacts' },
  { key: 'manage_tags', label: 'Gerenciar Tags', description: 'Criar/editar tags de contatos', defaultForAdmin: true, defaultForMember: false, category: 'contacts' },
  
  // Lead Search
  { key: 'search_leads', label: 'Buscar Leads', description: 'Buscar empresas e leads', defaultForAdmin: true, defaultForMember: false, category: 'leads' },
  
  // Lists
  { key: 'view_lists', label: 'Ver Listas', description: 'Visualizar listas de transmissão', defaultForAdmin: true, defaultForMember: true, category: 'lists' },
  { key: 'create_lists', label: 'Criar Listas', description: 'Criar novas listas', defaultForAdmin: true, defaultForMember: false, category: 'lists' },
  { key: 'send_broadcasts', label: 'Enviar Transmissões', description: 'Enviar mensagens em massa', defaultForAdmin: true, defaultForMember: false, category: 'lists' },
  
  // Templates
  { key: 'view_templates', label: 'Ver Templates', description: 'Visualizar templates de mensagem', defaultForAdmin: true, defaultForMember: true, category: 'templates' },
  { key: 'create_templates', label: 'Criar Templates', description: 'Criar novos templates', defaultForAdmin: true, defaultForMember: false, category: 'templates' },
  { key: 'delete_templates', label: 'Excluir Templates', description: 'Excluir templates', defaultForAdmin: true, defaultForMember: false, category: 'templates' },
  
  // Campaigns
  { key: 'view_campaigns', label: 'Ver Campanhas', description: 'Visualizar campanhas', defaultForAdmin: true, defaultForMember: true, category: 'campaigns' },
  { key: 'create_campaigns', label: 'Criar Campanhas', description: 'Criar novas campanhas', defaultForAdmin: true, defaultForMember: false, category: 'campaigns' },
  { key: 'start_campaigns', label: 'Iniciar Campanhas', description: 'Iniciar/pausar campanhas', defaultForAdmin: true, defaultForMember: false, category: 'campaigns' },
  { key: 'configure_ai_agent', label: 'Configurar Agente IA', description: 'Configurar agente de IA das campanhas', defaultForAdmin: true, defaultForMember: false, category: 'campaigns' },
  
  // Chatbots
  { key: 'view_chatbots', label: 'Ver Chatbots', description: 'Visualizar chatbots', defaultForAdmin: true, defaultForMember: true, category: 'chatbots' },
  { key: 'create_chatbots', label: 'Criar Chatbots', description: 'Criar novos chatbots', defaultForAdmin: true, defaultForMember: false, category: 'chatbots' },
  { key: 'manage_chatbots', label: 'Gerenciar Chatbots', description: 'Editar e excluir chatbots', defaultForAdmin: true, defaultForMember: false, category: 'chatbots' },
  
  // Settings
  { key: 'manage_subscription', label: 'Gerenciar Assinatura', description: 'Gerenciar plano e pagamentos', defaultForAdmin: true, defaultForMember: false, category: 'settings' },
  { key: 'manage_settings', label: 'Gerenciar Configurações', description: 'Acessar configurações do sistema', defaultForAdmin: true, defaultForMember: false, category: 'settings' },
  
  // Team
  { key: 'invite_members', label: 'Convidar Membros', description: 'Convidar novos membros', defaultForAdmin: true, defaultForMember: false, category: 'team' },
  { key: 'remove_members', label: 'Remover Membros', description: 'Remover membros da equipe', defaultForAdmin: true, defaultForMember: false, category: 'team' },
  { key: 'edit_permissions', label: 'Editar Permissões', description: 'Editar permissões de membros', defaultForAdmin: true, defaultForMember: false, category: 'team' },
  { key: 'reset_passwords', label: 'Redefinir Senhas', description: 'Redefinir senhas de membros', defaultForAdmin: true, defaultForMember: false, category: 'team' },
];

export interface SidebarItem {
  path: string;
  permission: PermissionKey;
}

export const SIDEBAR_PERMISSIONS: SidebarItem[] = [
  { path: '/dashboard', permission: 'view_dashboard' },
  { path: '/instances', permission: 'view_instances' },
  { path: '/warming', permission: 'view_warming' },
  { path: '/inbox', permission: 'view_inbox' },
  { path: '/funnels', permission: 'view_funnels' },
  { path: '/calendar', permission: 'view_calendar' },
  { path: '/analysis', permission: 'view_analysis' },
  { path: '/contacts', permission: 'view_contacts' },
  { path: '/lead-search', permission: 'search_leads' },
  { path: '/broadcast-lists', permission: 'view_lists' },
  { path: '/templates', permission: 'view_templates' },
  { path: '/campaigns', permission: 'view_campaigns' },
  { path: '/chatbots', permission: 'view_chatbots' },
  { path: '/subscription', permission: 'manage_subscription' },
  { path: '/settings', permission: 'manage_settings' },
];

export function getDefaultPermissions(role: TeamRole): Record<PermissionKey, boolean> {
  const permissions: Partial<Record<PermissionKey, boolean>> = {};
  
  PERMISSIONS.forEach(p => {
    permissions[p.key] = role === 'admin' ? p.defaultForAdmin : p.defaultForMember;
  });
  
  return permissions as Record<PermissionKey, boolean>;
}

export function hasPermission(
  userPermissions: Record<string, boolean> | null | undefined,
  permission: PermissionKey,
  role: TeamRole
): boolean {
  // Admin always has all permissions
  if (role === 'admin') return true;
  
  // Check custom permissions
  if (userPermissions && typeof userPermissions[permission] === 'boolean') {
    return userPermissions[permission];
  }
  
  // Fall back to default permissions for the role
  const defaults = getDefaultPermissions(role);
  return defaults[permission];
}

export function getPermissionsByCategory(): Record<PermissionCategory, Permission[]> {
  const grouped: Record<PermissionCategory, Permission[]> = {} as Record<PermissionCategory, Permission[]>;
  
  PERMISSIONS.forEach(p => {
    if (!grouped[p.category]) {
      grouped[p.category] = [];
    }
    grouped[p.category].push(p);
  });
  
  return grouped;
}
