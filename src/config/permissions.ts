export type PermissionKey = 
  | 'view_dashboard'
  | 'manage_instances'
  | 'manage_warming'
  | 'view_inbox'
  | 'view_funnels'
  | 'view_analysis'
  | 'view_contacts'
  | 'search_leads'
  | 'view_lists'
  | 'manage_templates'
  | 'manage_campaigns'
  | 'manage_subscription'
  | 'manage_settings'
  | 'manage_team';

export type TeamRole = 'admin' | 'member';

export interface Permission {
  key: PermissionKey;
  label: string;
  description: string;
  defaultForAdmin: boolean;
  defaultForMember: boolean;
}

export const PERMISSIONS: Permission[] = [
  { key: 'view_dashboard', label: 'Dashboard', description: 'Ver dashboard e métricas', defaultForAdmin: true, defaultForMember: true },
  { key: 'manage_instances', label: 'Instâncias', description: 'Gerenciar instâncias do WhatsApp', defaultForAdmin: true, defaultForMember: false },
  { key: 'manage_warming', label: 'Aquecimento', description: 'Gerenciar aquecimento de números', defaultForAdmin: true, defaultForMember: false },
  { key: 'view_inbox', label: 'Inbox', description: 'Acessar e responder conversas', defaultForAdmin: true, defaultForMember: true },
  { key: 'view_funnels', label: 'Funis', description: 'Ver e gerenciar funis de vendas', defaultForAdmin: true, defaultForMember: true },
  { key: 'view_analysis', label: 'Análise', description: 'Ver análises de conversas', defaultForAdmin: true, defaultForMember: false },
  { key: 'view_contacts', label: 'Contatos', description: 'Ver e gerenciar contatos', defaultForAdmin: true, defaultForMember: true },
  { key: 'search_leads', label: 'Buscar Leads', description: 'Buscar empresas e leads', defaultForAdmin: true, defaultForMember: false },
  { key: 'view_lists', label: 'Listas', description: 'Ver listas de transmissão', defaultForAdmin: true, defaultForMember: true },
  { key: 'manage_templates', label: 'Templates', description: 'Gerenciar templates de mensagem', defaultForAdmin: true, defaultForMember: false },
  { key: 'manage_campaigns', label: 'Campanhas', description: 'Criar e gerenciar campanhas', defaultForAdmin: true, defaultForMember: false },
  { key: 'manage_subscription', label: 'Assinatura', description: 'Gerenciar plano e pagamentos', defaultForAdmin: true, defaultForMember: false },
  { key: 'manage_settings', label: 'Configurações', description: 'Acessar configurações do sistema', defaultForAdmin: true, defaultForMember: false },
  { key: 'manage_team', label: 'Equipe', description: 'Gerenciar membros da equipe', defaultForAdmin: true, defaultForMember: false },
];

export interface SidebarItem {
  path: string;
  permission: PermissionKey;
}

export const SIDEBAR_PERMISSIONS: SidebarItem[] = [
  { path: '/dashboard', permission: 'view_dashboard' },
  { path: '/instances', permission: 'manage_instances' },
  { path: '/warming', permission: 'manage_warming' },
  { path: '/inbox', permission: 'view_inbox' },
  { path: '/funnels', permission: 'view_funnels' },
  { path: '/analysis', permission: 'view_analysis' },
  { path: '/contacts', permission: 'view_contacts' },
  { path: '/lead-search', permission: 'search_leads' },
  { path: '/broadcast-lists', permission: 'view_lists' },
  { path: '/templates', permission: 'manage_templates' },
  { path: '/campaigns', permission: 'manage_campaigns' },
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
