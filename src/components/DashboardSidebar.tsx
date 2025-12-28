import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, QrCode, Send, Users, List, FileText, Settings, LogOut, CreditCard, Shield, MessageSquare, Flame, PanelLeftClose, PanelLeft, BarChart3, Target, ChevronRight, Building2, CalendarDays, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSubscription, PLANS, hasFeatureAccess } from "@/hooks/useSubscription";
import { useConversations } from "@/hooks/useConversations";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebarContext } from "@/contexts/SidebarContext";
import wideLogo from "@/assets/wide-logo.png";
import { motion, AnimatePresence } from "framer-motion";
import { useOrganization } from "@/hooks/useOrganization";
import { PermissionKey } from "@/config/permissions";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  permission?: PermissionKey;
  showBadge?: boolean;
  premiumOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Visão Geral",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", permission: "view_dashboard" },
    ],
  },
  {
    label: "Potencialize seu WhatsApp",
    items: [
      { icon: QrCode, label: "Instâncias", path: "/instances", permission: "view_instances" },
      { icon: Flame, label: "Aquecimento", path: "/warming", permission: "view_warming" },
    ],
  },
  {
    label: "Atendimento e Vendas",
    items: [
      { icon: MessageSquare, label: "Inbox", path: "/inbox", permission: "view_inbox", showBadge: true },
      { icon: Target, label: "Funis", path: "/funnels", permission: "view_funnels" },
      { icon: CalendarDays, label: "Calendário", path: "/calendar", permission: "view_calendar" },
      { icon: BarChart3, label: "Análise", path: "/analysis", permission: "view_analysis", premiumOnly: true },
    ],
  },
  {
    label: "Organize seus Clientes",
    items: [
      { icon: Users, label: "Contatos", path: "/contacts", permission: "view_contacts" },
      { icon: Building2, label: "Pesquisa de Leads", path: "/lead-search", permission: "search_leads" },
      { icon: List, label: "Listas", path: "/broadcast-lists", permission: "view_lists" },
    ],
  },
  {
    label: "Campanhas e Disparos",
    items: [
      { icon: FileText, label: "Templates", path: "/templates", permission: "view_templates" },
      { icon: Send, label: "Disparos", path: "/campaigns", permission: "view_campaigns" },
      { icon: Bot, label: "Chatbots", path: "/chatbots", permission: "view_chatbots" },
    ],
  },
  {
    label: "Sua Conta",
    items: [
      { icon: CreditCard, label: "Assinatura", path: "/subscription", permission: "manage_subscription" },
      { icon: Settings, label: "Configurações", path: "/settings", permission: "manage_settings" },
    ],
  },
];

export const DashboardSidebar = () => {
  const { signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentPlan, isSubscribed } = useSubscription();
  const { conversations } = useConversations();
  const { isCollapsed, toggle } = useSidebarContext();
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const { checkPermission, organization, isLoading: isLoadingOrg } = useOrganization();
  
  // Calculate total unread messages
  const totalUnread = conversations?.reduce((sum, c) => sum + c.unread_count, 0) || 0;

  // Map premiumOnly features to FEATURE_ACCESS keys
  const featureMap: Record<string, string> = {
    '/warming': 'warming',
    '/funnels': 'funnels',
    '/broadcast-lists': 'broadcast',
    '/analysis': 'analysis',
    '/lead-search': 'lead_search',
  };

  // Filter nav items based on permissions and plan access
  const filterItems = (items: NavItem[]) => {
    // Se ainda está carregando organização, não mostrar nenhum item
    if (isLoadingOrg) return [];
    
    return items.filter(item => {
      // Check plan-based feature access
      const featureKey = featureMap[item.path];
      if (featureKey && !hasFeatureAccess(currentPlan, featureKey)) {
        return false;
      }

      // Se não tem organização, permite tudo (usuário individual/legado)
      if (!organization) return true;
      // Se não tem permissão definida, mostra o item
      if (!item.permission) return true;
      // Verificar permissão do membro
      return checkPermission(item.permission);
    });
  };

  // Check if current route is in a group
  const isGroupActive = (group: NavGroup) => {
    return group.items.some(item => location.pathname === item.path);
  };

  // Check if group should be expanded (hovered or active route)
  const isGroupExpanded = (group: NavGroup) => {
    return hoveredGroup === group.label || isGroupActive(group);
  };

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Erro ao sair: " + error.message);
    } else {
      toast.success("Logout realizado com sucesso");
      navigate("/login");
    }
  };

  const renderNavItem = (item: typeof navGroups[0]['items'][0]) => {
    const linkContent = (
      <NavLink
        key={item.path}
        to={item.path}
        className={({ isActive }) =>
          cn(
            "flex items-center rounded-xl text-sm font-medium transition-all duration-200 relative",
            isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-2.5",
            isActive
              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          )
        }
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!isCollapsed && (
          <>
            <span className="flex-1">{item.label}</span>
            {item.showBadge && totalUnread > 0 && (
              <Badge 
                variant="destructive" 
                className="h-5 min-w-5 px-1.5 text-xs font-bold animate-pulse"
              >
                {totalUnread > 99 ? '99+' : totalUnread}
              </Badge>
            )}
          </>
        )}
        {isCollapsed && item.showBadge && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </NavLink>
    );

    if (isCollapsed) {
      return (
        <Tooltip key={item.path}>
          <TooltipTrigger asChild>
            {linkContent}
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            {item.label}
            {item.showBadge && totalUnread > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                {totalUnread > 99 ? '99+' : totalUnread}
              </Badge>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside 
        className={cn(
          "fixed left-0 top-0 h-screen bg-sidebar flex flex-col shadow-elevated transition-all duration-300 ease-in-out z-40",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo and Toggle */}
        <div className={cn(
          "h-16 flex items-center border-b border-sidebar-border/30",
          isCollapsed ? "justify-center px-2" : "justify-between px-4"
        )}>
          {!isCollapsed && (
            <img src={wideLogo} alt="Widezap" className="h-10 w-auto" />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {isCollapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 py-4 overflow-y-auto",
          isCollapsed ? "px-2" : "px-3"
        )}>
          {navGroups.map((group, groupIndex) => (
            <div 
              key={group.label} 
              className={cn(groupIndex > 0 && "mt-2")}
              onMouseEnter={() => !isCollapsed && setHoveredGroup(group.label)}
              onMouseLeave={() => !isCollapsed && setHoveredGroup(null)}
            >
              {/* Group Label - hidden when collapsed */}
              {!isCollapsed && (
                <div 
                  className={cn(
                    "px-4 py-2 cursor-pointer rounded-lg transition-all duration-200 flex items-center justify-between",
                    isGroupExpanded(group) 
                      ? "bg-sidebar-accent/50" 
                      : "hover:bg-sidebar-accent/30"
                  )}
                >
                  <span className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider transition-colors duration-200",
                    isGroupActive(group) 
                      ? "text-sidebar-primary" 
                      : "text-sidebar-foreground/50"
                  )}>
                    {group.label}
                  </span>
                  <motion.div
                    animate={{ rotate: isGroupExpanded(group) ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight className={cn(
                      "h-3 w-3 transition-colors duration-200",
                      isGroupActive(group) 
                        ? "text-sidebar-primary" 
                        : "text-sidebar-foreground/40"
                    )} />
                  </motion.div>
                </div>
              )}
              
              {/* Separator when collapsed */}
              {isCollapsed && groupIndex > 0 && (
                <div className="my-2 mx-2 border-t border-sidebar-border/20" />
              )}
              
              {/* Group Items - animated */}
              {isCollapsed ? (
                <div className="space-y-0.5">
                  {filterItems(group.items).map(renderNavItem)}
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {isGroupExpanded(group) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0.5 pt-1">
                        {filterItems(group.items).map(renderNavItem)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          ))}
          
          {/* Admin Link */}
          {isAdmin && (
            isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <NavLink
                    to="/admin"
                    className={({ isActive }) =>
                      cn(
                        "flex items-center justify-center p-3 rounded-xl text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-amber-500/20 text-amber-300"
                          : "text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-300"
                      )
                    }
                  >
                    <Shield className="h-5 w-5" />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">Admin</TooltipContent>
              </Tooltip>
            ) : (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-amber-500/20 text-amber-300"
                      : "text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-300"
                  )
                }
              >
                <Shield className="h-5 w-5" />
                Admin
              </NavLink>
            )
          )}
        </nav>

        {/* Bottom section */}
        <div className={cn(
          "border-t border-sidebar-border/30 space-y-2",
          isCollapsed ? "p-2" : "p-4"
        )}>
          {isCollapsed ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <NavLink to="/subscription" className="block">
                    <div className="bg-sidebar-accent/50 rounded-xl p-3 hover:bg-sidebar-accent transition-colors cursor-pointer flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-sidebar-primary" />
                    </div>
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs text-muted-foreground">Plano Ativo</p>
                  <p className="text-sm font-semibold">
                    {isSubscribed ? (PLANS[currentPlan as keyof typeof PLANS]?.name?.toUpperCase() || currentPlan.toUpperCase()) : 'NENHUM PLANO'}
                  </p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handleLogout}
                    className="w-full h-10 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-xl"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sair do Sistema</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <NavLink to="/subscription" className="block">
                <div className="bg-sidebar-accent/50 rounded-xl p-4 hover:bg-sidebar-accent transition-colors cursor-pointer">
                  <p className="text-xs text-sidebar-foreground/60 mb-1">Plano Ativo</p>
                  <p className="text-sm font-semibold text-sidebar-primary">
                    {isSubscribed ? (PLANS[currentPlan as keyof typeof PLANS]?.name?.toUpperCase() || currentPlan.toUpperCase()) : 'NENHUM PLANO'}
                  </p>
                </div>
              </NavLink>
              
              <Button 
                variant="ghost" 
                onClick={handleLogout}
                className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-xl"
              >
                <LogOut className="h-5 w-5" />
                Sair do Sistema
              </Button>
            </>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
};